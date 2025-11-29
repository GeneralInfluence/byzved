-- Migration: 001_create_initial_schema.sql
-- Purpose: Initialize database schema for Telegram Ingestion Bot
-- Created: 2025-11-29
-- Description: Creates conversations and opt_out_users tables with pgvector support

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create conversations table for storing ingested messages
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  vector vector(1536) DEFAULT NULL,
  user_name TEXT,
  user_first_name TEXT,
  user_last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_group_id ON conversations(group_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_message_id ON conversations(message_id);

-- Create opt_out_users table for tracking users who have opted out
CREATE TABLE IF NOT EXISTS opt_out_users (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  opted_out_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for opt-out lookups
CREATE INDEX IF NOT EXISTS idx_opt_out_users_user_id ON opt_out_users(user_id);

-- Add comments to tables for documentation
COMMENT ON TABLE conversations IS 'Stores all ingested messages from Telegram groups/channels with optional embeddings';
COMMENT ON TABLE opt_out_users IS 'Tracks users who have opted out from data collection';
COMMENT ON COLUMN conversations.vector IS 'Vector embedding of the message text (1536-dim from OpenAI or 768-dim from Gemini)';
COMMENT ON COLUMN conversations.message_id IS 'Unique Telegram message identifier';
COMMENT ON COLUMN opt_out_users.user_id IS 'Telegram user ID of opted-out user';
