import { Bot, webhookCallback } from 'grammy';
import { loadConfig, getMaskedConfig } from '../src/config';
import { initSupabase, ensureTables } from '../src/supabase';
import { initEmbeddings } from '../src/embeddings';
import { handleStartCommand, handleOptoutCommand, handleStatsCommand, handleCallbackQuery, handleAskCommand, handleMentionAsk } from '../src/handlers';
import { logger } from '../src/logger';

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
  bot.on('message', handleMentionAsk); // You may want to add other handlers as needed
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
