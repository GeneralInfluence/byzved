# Database Migrations

This directory contains SQL migration files for initializing and maintaining the Telegram Ingestion Bot database schema.

## Migration Files

- `001_create_initial_schema.sql` - Creates initial tables (conversations, opt_out_users) with indexes and pgvector extension

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended for Development)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy the entire content of `001_create_initial_schema.sql`
5. Paste into the query editor
6. Click **Run**

### Option 2: Using Migration Runner Script

```bash
npx ts-node migrations/run.ts
```

This will display all migration SQL that needs to be executed.

### Option 3: Command Line (Requires CLI)

```bash
# Install Supabase CLI
npm install -g supabase

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

## Migration Naming Convention

Migrations follow the naming pattern: `NNN_description.sql`

- `NNN` - Zero-padded sequence number (001, 002, 003, etc.)
- `description` - Descriptive name in snake_case

Examples:
- `001_create_initial_schema.sql`
- `002_add_conversation_metadata.sql`
- `003_create_analytics_views.sql`

## Schema Overview

### conversations Table
Stores all ingested Telegram messages:
```sql
id              BIGSERIAL PRIMARY KEY
message_id      BIGINT UNIQUE (Telegram message ID)
text            TEXT (Message content)
user_id         BIGINT (Telegram user ID)
group_id        BIGINT (Telegram group/channel ID)
timestamp       TIMESTAMP (When message was posted)
vector          vector(1536) (Embedding vector - nullable)
user_name       TEXT (Telegram username)
user_first_name TEXT
user_last_name  TEXT
created_at      TIMESTAMP (When ingested)
```

**Indexes:**
- `idx_conversations_user_id` - Quick lookup by user
- `idx_conversations_group_id` - Quick lookup by group
- `idx_conversations_timestamp` - Quick lookup by time
- `idx_conversations_message_id` - Quick lookup by message

### opt_out_users Table
Tracks users who have opted out:
```sql
id          BIGSERIAL PRIMARY KEY
user_id     BIGINT UNIQUE (Telegram user ID)
opted_out_at TIMESTAMP (When they opted out)
```

**Indexes:**
- `idx_opt_out_users_user_id` - Quick lookup for opt-out checks

## Prerequisites

### Enable pgvector Extension

The migrations automatically enable the `vector` extension for pgvector support. This allows storing and querying vector embeddings.

To verify it's enabled:
1. Go to Supabase Dashboard → Extensions
2. Search for "vector"
3. Should see "pgvector" listed as enabled

## Rolling Back

To rollback to a previous state:

1. **Using Supabase Dashboard:**
   - Go to SQL Editor
   - Run `DROP TABLE IF EXISTS conversations CASCADE;`
   - Run `DROP TABLE IF EXISTS opt_out_users CASCADE;`
   - Re-run the migration

2. **Using Migration Script:**
   - Create a rollback file (e.g., `001_rollback.sql`)
   - Execute it via Supabase Dashboard

## Future Migrations

When adding new features, create new migration files:

1. Create `NNN_new_feature.sql` in this directory
2. Document the changes
3. Test in development first
4. Deploy to production

Example for adding a new table:
```sql
-- Migration: 002_add_user_analytics.sql
-- Purpose: Track user engagement analytics
-- Created: 2025-11-30

CREATE TABLE IF NOT EXISTS user_analytics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  message_count BIGINT DEFAULT 0,
  last_seen TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) 
    REFERENCES opt_out_users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id 
  ON user_analytics(user_id);
```

## Troubleshooting

### "Extension pgvector not found"
- Go to Supabase Dashboard → Extensions
- Search for "vector" and enable it
- Then re-run migrations

### "Table already exists"
- Migrations use `IF NOT EXISTS` clauses
- Safe to run multiple times
- No data loss

### Migration won't execute
- Check SUPABASE_URL and SUPABASE_KEY are set
- Verify you're using the correct API key (anon key works for basic operations)
- For complex migrations, use service_role key via backend

## Best Practices

1. **Test First**: Always test migrations in a development environment
2. **Version Control**: Keep migrations in git for tracking changes
3. **Document**: Add comments explaining what each migration does
4. **Idempotent**: Use `IF NOT EXISTS` to make migrations safe to re-run
5. **Atomic**: Keep migrations focused on single features
6. **Backwards Compatible**: Avoid breaking changes if possible

## Schema Documentation

See comments on tables and columns:

```sql
-- View table comments
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- View column comments
SELECT column_name, col_description 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'conversations';
```

## Integration with Bot

The bot automatically verifies tables exist on startup via `ensureTables()` in `src/supabase.ts`. If tables are missing, it logs a warning and suggests running migrations.

## Support

For issues with migrations:
1. Check Supabase status page
2. Review migration SQL syntax
3. Verify pgvector extension is enabled
4. Check API key permissions
