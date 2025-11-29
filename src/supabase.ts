/**
 * Supabase database module for storing ingested messages
 * Handles all database operations for message storage and user opt-out management
 *
 * Requires the following tables to exist:
 * - conversations: stores ingested messages with optional vector embeddings
 * - opt_out_users: stores users who have opted out of data collection
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConversationRecord, OptOutUser } from './types.js';
import { logger } from './logger.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client for database operations
 * @param url Supabase project URL
 * @param key Supabase anonymous or service role key
 * @returns Initialized Supabase client
 */
export function initSupabase(url: string, key: string): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(url, key);
  logger.info('✅ Supabase client initialized');
  return supabaseClient;
}

/**
 * Get the Supabase client (must be initialized first)
 * @returns Initialized Supabase client
 * @throws Error if client not initialized
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase client not initialized. Call initSupabase first.'
    );
  }
  return supabaseClient;
}

/**
 * Ensure database tables exist and are properly configured
 * Attempts to verify both conversations and opt_out_users tables
 * @throws No error thrown; logs warnings if tables cannot be verified
 */
export async function ensureTables(): Promise<void> {
  const client = getSupabaseClient();

  try {
    logger.info('Ensuring database tables exist...');

    // Check if conversations table exists and is accessible
    const { data: conversationsData, error: conversationsError } = await client
      .from('conversations')
      .select('count', { count: 'exact', head: true });

    if (conversationsError) {
      logger.warn(
        '⚠️  Could not verify conversations table:',
        conversationsError.message
      );
      logger.info(
        'Please ensure the table exists in Supabase using the migration script.'
      );
    } else {
      logger.info('✅ conversations table is accessible');
    }

    // Check if opt_out_users table exists and is accessible
    const { data: optOutData, error: optOutError } = await client
      .from('opt_out_users')
      .select('count', { count: 'exact', head: true });

    if (optOutError) {
      logger.warn(
        '⚠️  Could not verify opt_out_users table:',
        optOutError.message
      );
      logger.info(
        'Please ensure the table exists in Supabase using the migration script.'
      );
    } else {
      logger.info('✅ opt_out_users table is accessible');
    }
  } catch (error) {
    logger.error('Error checking tables:', error);
  }
}

/**
 * Insert a message into the conversations table
 * @param record Conversation record to insert
 * @returns Inserted record or null on error
 */
export async function insertMessage(
  record: ConversationRecord
): Promise<ConversationRecord | null> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('conversations')
      .insert([record])
      .select();

    if (error) {
      logger.error('Error inserting message into conversations:', error);
      return null;
    }

    logger.debug(
      `✅ Message inserted (ID: ${record.message_id}, Group: ${record.group_id})`
    );
    return data?.[0] || null;
  } catch (error) {
    logger.error('Unexpected error inserting message:', error);
    return null;
  }
}

/**
 * Check if a user has opted out of data collection
 * @param userId Telegram user ID to check
 * @returns True if user is in opt-out list, false otherwise
 */
export async function isUserOptedOut(userId: number): Promise<boolean> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('opt_out_users')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (normal case)
      logger.error('Error checking opt-out status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    logger.error('Unexpected error checking opt-out:', error);
    return false;
  }
}

/**
 * Add a user to the opt-out list
 * @param userId Telegram user ID to opt out
 * @returns True if successfully added, false on error
 */
export async function addUserOptOut(userId: number): Promise<boolean> {
  const client = getSupabaseClient();

  try {
    const { error } = await client.from('opt_out_users').insert([
      {
        user_id: userId,
        opted_out_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      logger.error('Error adding user to opt-out list:', error);
      return false;
    }

    logger.info(`✅ User ${userId} opted out`);
    return true;
  } catch (error) {
    logger.error('Unexpected error during opt-out:', error);
    return false;
  }
}

/**
 * Get total count of ingested messages from conversations table
 * Useful for monitoring and statistics
 * @returns Number of messages stored, 0 on error
 */
export async function getMessageCount(): Promise<number> {
  const client = getSupabaseClient();

  try {
    const { count, error } = await client
      .from('conversations')
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.error('Error getting message count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    logger.error('Unexpected error getting message count:', error);
    return 0;
  }
}

/**
 * Clear all messages for a specific user
 * @param userId Telegram user ID whose messages to delete
 * @returns Number of messages deleted, 0 on error
 */
export async function clearUserMessages(userId: number): Promise<number> {
  const client = getSupabaseClient();

  try {
    const { count, error } = await client
      .from('conversations')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Error clearing user messages:', error);
      return 0;
    }

    logger.info(`✅ Cleared ${count} messages for user ${userId}`);
    return count || 0;
  } catch (error) {
    logger.error('Unexpected error clearing messages:', error);
    return 0;
  }
}
