/**
 * Configuration management module
 * Loads and validates environment variables with type safety
 */

import { BotConfig } from './types.js';
import { logger } from './logger.js';

/**
 * Load and validate bot configuration from environment variables
 * @returns Validated bot configuration
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): BotConfig {
  const config: BotConfig = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    webhookUrl: process.env.WEBHOOK_URL,
    port: parseInt(process.env.PORT || '3000', 10),
    mode: (process.env.BOT_MODE as 'polling' | 'webhook') || 'polling',
  };

  validateConfig(config);
  return config;
}

/**
 * Validate that all required configuration is present
 * @param config The configuration to validate
 * @throws Error if any required configuration is missing
 */
export function validateConfig(config: BotConfig): void {
  const required: (keyof BotConfig)[] = [
    'telegramBotToken',
    'supabaseUrl',
    'supabaseKey',
  ];

  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    const missingVars = missing
      .map((key) => key.toUpperCase())
      .join(', ');
    throw new Error(
      `Missing required environment variables: ${missingVars}`
    );
  }

  // Validate embedding configuration (at least one should be present for production)
  if (!config.openaiApiKey && !config.geminiApiKey) {
    logger.warn(
      'No embedding provider configured. Messages will be ingested without vector embeddings.'
    );
  }

  // Validate webhook configuration if using webhook mode
  if (config.mode === 'webhook' && !config.webhookUrl) {
    throw new Error(
      'Webhook mode requires WEBHOOK_URL environment variable'
    );
  }

  logger.info('✅ Configuration validated successfully');
}

/**
 * Get configuration with masked sensitive values for logging
 * @param config The configuration to mask
 * @returns Configuration with masked API keys
 */
export function getMaskedConfig(config: BotConfig): Record<string, unknown> {
  return {
    mode: config.mode,
    port: config.port,
    supabaseUrl: config.supabaseUrl,
    embeddings: {
      openai: !!config.openaiApiKey,
      gemini: !!config.geminiApiKey,
    },
    webhook: config.mode === 'webhook' ? config.webhookUrl : 'N/A',
  };
}
