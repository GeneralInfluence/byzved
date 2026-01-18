import { Bot, webhookCallback } from 'grammy';
import { loadConfig, getMaskedConfig } from '../src/config.js';
import { initSupabase, ensureTables, insertMessage, isUserOptedOut } from '../src/supabase.js';
import { initEmbeddings } from '../src/embeddings.js';
import { areEmbeddingsAvailable, generateEmbedding } from '../src/embeddings.js';
import { handleStartCommand, handleOptoutCommand, handleStatsCommand, handleCallbackQuery, handleAskCommand, handleMentionAsk } from '../src/handlers.js';
import { logger } from '../src/logger.js';

let bot: Bot | null = null;

async function getBot() {
  if (bot) return bot;
  const config = loadConfig();
  bot = new Bot(config.telegramBotToken);
  bot.command('start', handleStartCommand);
  bot.command('optout', handleOptoutCommand);
  bot.command('stats', handleStatsCommand);
  bot.command('ask', handleAskCommand);
  bot.hears(/^\/ask\b/, handleAskCommand);
  bot.on('callback_query', handleCallbackQuery);
  // Register catch-all message logger for debugging
  bot.on('message', (ctx, next) => {
    logger.debug("[CATCH-ALL] Received message:", {
      chatType: ctx.chat?.type,
      chatId: ctx.chat?.id,
      fromId: ctx.from?.id,
      text: ctx.message?.text,
      entities: ctx.message?.entities,
      raw: ctx.message,
    });
    return next();
  });
  // Register ingestion handler (async)
  bot.on('message', async (ctx, next) => {
    try {
      logger.debug('[ASYNC] Ingestion handler triggered for message:', ctx.message);
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
      let optedOut = false;
      try {
        optedOut = await isUserOptedOut(user.id);
        logger.debug(`[ASYNC] User ${user.id} optedOut: ${optedOut}`);
      } catch (err) {
        logger.warn(`[ASYNC] Opt-out check failed for user ${user.id}:`, err);
      }
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
      const telegramMessage = {
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
      let vector = null;
      if (areEmbeddingsAvailable()) {
        try {
          const embeddingResult = await generateEmbedding(message.text);
          vector = embeddingResult.embedding;
          logger.debug('[ASYNC] Generated embedding:', vector);
        } catch (err) {
          logger.warn('[ASYNC] Embedding generation failed:', err);
        }
      }
      // Prepare database record
      const dbRecord = {
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
      // Extra logging for message_id and identifying info
      logger.info('[ASYNC] Insert attempt:', {
        message_id: dbRecord.message_id,
        group_id: dbRecord.group_id,
        user_id: dbRecord.user_id,
        text: dbRecord.text,
        timestamp: dbRecord.timestamp,
      });
      // Store in database with detailed logging
      logger.debug('[ASYNC] Attempting insertMessage with:', dbRecord);
      try {
        const result = await insertMessage(dbRecord);
        logger.debug('[ASYNC] insertMessage result:', result);
        if (!result) {
          logger.error('[ASYNC] insertMessage failed for dbRecord:', dbRecord);
        }
      } catch (err) {
        // Handle duplicate message error (409 Conflict)
        const errorObj = err as any;
        const code = errorObj?.code ?? errorObj?.status ?? undefined;
        const message = errorObj?.message ?? String(errorObj);
        if (code === '409' || code === 409 || (message && message.includes('duplicate'))) {
          logger.warn('[ASYNC] Duplicate message detected, skipping insert:', {
            dbRecord,
            error: message,
          });
        } else {
          logger.error('[ASYNC] Unexpected error inserting message:', {
            error: message,
            dbRecord,
          });
        }
      }
    } catch (error) {
      logger.error('Error processing message:', error);
    }
    return next();
  });
  // Register mention handler (for group/channel questions)
  bot.on('message', handleMentionAsk);
  await initSupabase(config.supabaseUrl, config.supabaseKey);
  await ensureTables();
  await initEmbeddings(config.openaiApiKey, config.geminiApiKey);
  return bot;
}

export default async function handler(req: any, res: any) {
  const botInstance = await getBot();
  const callback = webhookCallback(botInstance, 'http');
  return callback(req, res);
}
