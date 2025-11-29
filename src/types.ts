/**
 * Type definitions for the Telegram Ingestion Bot
 * Provides strict typing for all major data structures
 */

/**
 * Represents a raw Telegram message
 */
export interface TelegramMessage {
  /** Unique message ID from Telegram */
  messageId: number;
  /** Message content text */
  text: string;
  /** User ID who sent the message */
  userId: number;
  /** Group/channel ID where message was sent */
  groupId: number;
  /** Timestamp when message was received */
  timestamp: Date;
  /** Optional username of the sender */
  userName?: string;
  /** Optional first name of the sender */
  userFirstName?: string;
  /** Optional last name of the sender */
  userLastName?: string;
}

/**
 * Represents a message stored in the database
 */
export interface ConversationRecord {
  /** Optional unique database ID */
  id?: string;
  /** Original Telegram message ID */
  message_id: number;
  /** Message content text */
  text: string;
  /** User ID who sent the message */
  user_id: number;
  /** Group/channel ID where message was sent */
  group_id: number;
  /** ISO format timestamp */
  timestamp: string;
  /** Optional vector embedding for semantic search */
  vector?: number[] | null;
  /** Optional username of the sender */
  user_name?: string;
  /** Optional first name of the sender */
  user_first_name?: string;
  /** Optional last name of the sender */
  user_last_name?: string;
  /** Record creation timestamp */
  created_at?: string;
}

/**
 * Represents a user opted out from data collection
 */
export interface OptOutUser {
  /** Optional unique database ID */
  id?: string;
  /** Telegram user ID */
  user_id: number;
  /** Timestamp when user opted out */
  opted_out_at?: string;
}

/**
 * Result from embedding generation
 */
export interface EmbeddingResult {
  /** Original text that was embedded */
  text: string;
  /** Generated vector embedding or null if unavailable */
  embedding: number[] | null;
}

/**
 * Bot configuration from environment variables
 */
export interface BotConfig {
  /** Telegram bot token from @BotFather */
  telegramBotToken: string;
  /** Supabase project URL */
  supabaseUrl: string;
  /** Supabase anonymous or service role key */
  supabaseKey: string;
  /** Optional OpenAI API key for embeddings (priority 1) */
  openaiApiKey?: string;
  /** Optional Google Gemini API key for embeddings (priority 2) */
  geminiApiKey?: string;
  /** Optional webhook URL for production mode */
  webhookUrl?: string;
  /** Port for webhook server (default: 3000) */
  port?: number;
  /** Bot operation mode: 'polling' for dev, 'webhook' for production */
  mode: 'polling' | 'webhook';
}

