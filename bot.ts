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
import { loadConfig, getMaskedConfig } from './src/config.js';
import { initSupabase, ensureTables, insertMessage, isUserOptedOut } from './src/supabase.js';
import { initEmbeddings, generateEmbedding, areEmbeddingsAvailable } from './src/embeddings.js';
import {
  handleStartCommand,
  handleOptoutCommand,
  handleStatsCommand,
  handleCallbackQuery,
  handleAskCommand,
} from './src/handlers.js';
import { TelegramMessage, ConversationRecord, BotConfig } from './src/types.js';
import { logger } from './src/logger.js';

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

/**
 * Register callback query handler for menu interactions
 */
bot.on('callback_query', handleCallbackQuery);

/**
 * Handle incoming messages
 * Checks opt-out status, generates embeddings, and stores in database
 */
bot.on('message', async (ctx: Context) => {
  try {
    const message = ctx.message;
    if (!message?.text) {
      return;
    }

    const user = ctx.from;
    if (!user) {
      return;
    }

    // Check if user has opted out
    const optedOut = await isUserOptedOut(user.id);
    if (optedOut) {
      logger.debug(`User ${user.id} is opted out, skipping message.`);
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
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

    // Generate embedding if available
    let vector: number[] | null = null;
    if (areEmbeddingsAvailable()) {
      const embeddingResult = await generateEmbedding(message.text);
      vector = embeddingResult.embedding;
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

    // Store in database
    await insertMessage(dbRecord);
  } catch (error) {
    logger.error('Error processing message:', error);
  }
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
  logger.info(`🚀 Starting bot in WEBHOOK mode on port ${config.port}`);

  const app: Express = express();
  app.use(bodyParser.json());

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', mode: 'webhook' });
  });

  // Webhook endpoint for Telegram updates
  app.post('/webhook', webhookCallback(bot, 'express'));

  const listener = app.listen(config.port, () => {
    logger.info(`✅ Webhook server listening on port ${config.port}`);
    logger.info(`📡 Webhook URL: ${config.webhookUrl}`);

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
  logger.info('🚀 Starting bot in POLLING mode');

  await bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: (botInfo) => {
      logger.info(`✅ Bot started as @${botInfo.username}`);
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

