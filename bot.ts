/**
 * Main Telegram Ingestion Bot Entry Point
 *
 * Monitors public Telegram groups/channels and stores messages in Supabase.
 * Supports both polling (development) and webhook (production) modes.
 *
 * Embedding providers (optional):
 * - OpenAI (1536-dimensional vectors) - Priority 1
 * - Google Gemini (768-dimensional vectors) - Priority 2
 * - None (messages ingested without embeddings) - Fallback
 *
 * Privacy: Users can opt-out via /optout command
 */

import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import { Bot, Context, webhookCallback } from 'grammy';
import { loadConfig, getMaskedConfig } from './src/config';
import { initSupabase, ensureTables, insertMessage, isUserOptedOut } from './src/supabase';
import { initEmbeddings, generateEmbedding, areEmbeddingsAvailable } from './src/embeddings';
import {
  handleStartCommand,
  handleOptoutCommand,
  handleStatsCommand,
  handleCallbackQuery,
  handleAskCommand,
  handleMentionAsk,
} from './src/handlers';
import { TelegramMessage, ConversationRecord, BotConfig } from './src/types';
import { logger } from './src/logger';

// Load and validate configuration
let config: BotConfig;
try {
  config = loadConfig();
  logger.info('✅ Configuration loaded', getMaskedConfig(config));
} catch (error) {
  logger.error('❌ Configuration error:', error);
  process.exit(1);
}

// Initialize Grammy bot
const bot = new Bot(config.telegramBotToken);


/**
 * Register command handlers
 */
bot.command('start', handleStartCommand);
bot.command('optout', handleOptoutCommand);
bot.command('stats', handleStatsCommand);
bot.command('ask', handleAskCommand);
bot.hears(/^\/ask\b/, handleAskCommand);

// Catch-all message logger for debugging
bot.on('message', (ctx: Context, next) => {
  logger.debug("[CATCH-ALL] Received message:", {
    chatType: ctx.chat?.type,
    chatId: ctx.chat?.id,
    fromId: ctx.from?.id,
    text: ctx.message?.text,
    entities: ctx.message?.entities,
    raw: ctx.message,
  });
  return next(); // Allow other handlers to process this message
});


/**
 * Respond to @mentions in groups/channels
 * Also handle bot being added via new_chat_member(s) in message event
 */
bot.on('message', async (ctx, next) => {
  // Handle @mention
  if (
    (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') &&
    ctx.message?.entities?.some(
      (e) =>
        e.type === 'mention' &&
        ctx.message.text?.substring(e.offset, e.offset + e.length).toLowerCase() ===
          (ctx.me?.username ? `@${ctx.me.username}`.toLowerCase() : '')
    )
  ) {
    await handleMentionAsk(ctx);
    // Do not return; allow ingestion handler to run
  }

  // Handle bot being added via new_chat_member(s)
  const botId = ctx.me?.id;
  const newMembers = ctx.message?.new_chat_members;
  if (
    (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') &&
    Array.isArray(newMembers) &&
    newMembers.some((m) => m.id === botId)
  ) {
    const notice =
      'Thank you for including RaidGuild in your conversations. Our bot can not read past messages, so make sure important conversations or warm introductions are reposted.\n\n' +
      "If you would like to ask the RaidGuild_bot a question, you can either DM it, or you can @ mention it in the channel, '@RaidGuild_bot who is involved in the Avengers Initiative?'\n\n" +
      'Thank you :)';
    try {
      await ctx.api.sendMessage(ctx.chat.id, notice, { parse_mode: 'HTML' });
    } catch (err) {
      logger.warn('[new_chat_member] Could not post public notice in group:', err);
    }
    // Do not return; allow ingestion handler to run
  }

  return next();
});

/**
 * Register callback query handler for menu interactions
 */
bot.on('callback_query', handleCallbackQuery);

/**
 * Handle bot being added to a group/channel (my_chat_member event)
 * When added, fetch recent messages and ingest them
 */
bot.on('my_chat_member', async (ctx) => {
  try {
    const chat = ctx.chat;
    const newStatus = ctx.myChatMember?.new_chat_member?.status;
    const oldStatus = ctx.myChatMember?.old_chat_member?.status;
    logger.info(`[my_chat_member] Chat ${chat?.id} status changed: ${oldStatus} -> ${newStatus}`);

    // Only act if bot was added (became member or admin)
    if (['member', 'administrator'].includes(newStatus)) {
      // Telegram API limitation: bots cannot fetch message history after being added.
      // The bot will only ingest new messages from this point forward.
      logger.info(`[my_chat_member] Bot added to chat ${chat?.id}. Due to Telegram API limitations, only new messages will be ingested from now on.`);

      // Notify group about this limitation
      if (chat?.type === 'group' || chat?.type === 'supergroup') {
        const notice =
          'Thank you for including RaidGuild in your conversations. Our bot can not read past messages, so make sure important conversations or warm introductions are reposted.\n\n' +
          "If you would like to ask the RaidGuild_bot a question, you can either DM it, or you can @ mention it in the channel, '@RaidGuild_bot who is involved in the Avengers Initiative?'\n\n" +
          'Thank you :)';
        // Post public message in the group
        try {
          await ctx.api.sendMessage(chat.id, notice, { parse_mode: 'HTML' });
        } catch (err) {
          logger.warn('[my_chat_member] Could not post public notice in group:', err);
        }
        // Also try to DM admins (best effort)
        try {
          const admins = await ctx.api.getChatAdministrators(chat.id);
          const adminIds = admins.map(a => a.user.id);
          for (const adminId of adminIds) {
            try {
              await ctx.api.sendMessage(adminId, notice, { parse_mode: 'HTML' });
            } catch (err) {
              logger.warn(`[my_chat_member] Could not notify admin ${adminId}:`, err);
            }
          }
        } catch (err) {
          logger.warn('[my_chat_member] Could not fetch or notify group admins:', err);
        }
      }
    }
  } catch (error) {
    logger.error('[my_chat_member] Error handling event:', error);
  }
});

/**
 * Handle incoming messages
 * Checks opt-out status, generates embeddings, and stores in database
 */
bot.on('message', async (ctx: Context, next) => {
  try {
    const message = ctx.message;
    logger.debug("[ASYNC] Received message:", message);
    if (!message?.text) {
      logger.debug('[ASYNC] No text in message, skipping.');
      return next();
    }

    const user = ctx.from;
    if (!user) {
      logger.debug('[ASYNC] No user in message, skipping.');
      return next();
    }

    // Check if user has opted out
    const optedOut = await isUserOptedOut(user.id);
    logger.debug(`[ASYNC] User ${user.id} optedOut: ${optedOut}`);
    if (optedOut) {
      logger.debug(`[ASYNC] User ${user.id} is opted out, skipping message.`);
      return next();
    }

    const chatId = ctx.chat?.id;
    if (!chatId) {
      logger.debug('[ASYNC] No chatId, skipping.');
      return next();
    }

    // Parse Telegram message
    const telegramMessage: TelegramMessage = {
      messageId: message.message_id,
      text: message.text,
      userId: user.id,
      groupId: chatId,
      timestamp: new Date(message.date * 1000),
      userName: user.username,
      userFirstName: user.first_name,
      userLastName: user.last_name,
    };
    logger.debug('[ASYNC] Parsed TelegramMessage:', telegramMessage);

    // Generate embedding if available
    let vector: number[] | null = null;
    if (areEmbeddingsAvailable()) {
      const embeddingResult = await generateEmbedding(message.text);
      vector = embeddingResult.embedding;
      logger.debug('[ASYNC] Generated embedding:', vector);
    }

    // Prepare database record
    const dbRecord: ConversationRecord = {
      message_id: telegramMessage.messageId,
      text: telegramMessage.text,
      user_id: telegramMessage.userId,
      group_id: telegramMessage.groupId,
      timestamp: telegramMessage.timestamp.toISOString(),
      vector: vector,
      user_name: telegramMessage.userName,
      user_first_name: telegramMessage.userFirstName,
      user_last_name: telegramMessage.userLastName,
    };
    logger.debug('[ASYNC] Prepared dbRecord:', dbRecord);

    // Store in database with detailed logging
    logger.debug('[ASYNC] Attempting insertMessage with:', dbRecord);
    const result = await insertMessage(dbRecord);
    logger.debug('[ASYNC] insertMessage result:', result);
    if (!result) {
      logger.error('[ASYNC] insertMessage failed for dbRecord:', dbRecord);
    }
  } catch (error) {
    logger.error('Error processing message:', error);
  }
  return next();
});

/**
 * Start bot in configured mode (polling or webhook)
 */
async function start(): Promise<void> {
  try {
    // Initialize Supabase
    initSupabase(config.supabaseUrl, config.supabaseKey);
    await ensureTables();
    logger.info('✅ Database initialized');

    // Initialize embeddings provider
    await initEmbeddings(config.openaiApiKey, config.geminiApiKey);

    // Start bot in configured mode
    if (config.mode === 'webhook' && config.webhookUrl) {
      startWebhookMode();
    } else {
      startPollingMode();
    }
  } catch (error) {
    logger.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

/**
 * Start bot in webhook mode (production)
 * @private
 */
function startWebhookMode(): void {
  logger.info("Starting bot in WEBHOOK mode on port " + config.port);

  const app: Express = express();
  app.use(bodyParser.json());

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', mode: 'webhook' });
  });

  // Webhook endpoint for Telegram updates
  app.post('/webhook', webhookCallback(bot, 'express'));

  const listener = app.listen(config.port, () => {
    logger.info("Webhook server listening on port " + config.port);
    logger.info("Webhook URL: " + config.webhookUrl);

    // Register webhook with Telegram
    if (config.webhookUrl) {
      bot.api
        .setWebhook(config.webhookUrl)
        .then(() => {
          logger.info('✅ Webhook registered with Telegram');
        })
        .catch((err) => {
          logger.error('Failed to register webhook:', err);
        });
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    listener.close(() => {
      logger.info('Webhook server closed');
      process.exit(0);
    });
  });
}

/**
 * Start bot in polling mode (development)
 * @private
 */
async function startPollingMode(): Promise<void> {
  logger.info('Starting bot in POLLING mode');

  await bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: (botInfo) => {
      logger.info("Bot started as @ " + botInfo.username);
    },
  });
}

/**
 * Process error handlers
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise: String(promise) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
start();

