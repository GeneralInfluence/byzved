/**
 * Database Migration Runner
 * Executes SQL migration files directly against Supabase PostgreSQL
 *
 * Migrations are executed in alphabetical order (e.g., 001_*, 002_*, etc.)
 * Each migration is executed as individual SQL statements.
 *
 * Usage: npm run migrate
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import pg from 'pg';
const { Client } = pg;

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

/**
 * Parse Supabase connection string from environment
 * Extracts host from URL: https://abc123.supabase.co -> abc123.supabase.co
 */
const hostMatch = SUPABASE_URL.match(/https:\/\/([^\/]+)/);
if (!hostMatch) {
  console.error('❌ Invalid SUPABASE_URL format');
  process.exit(1);
}

const host = hostMatch[1];
const connectionString = `postgresql://postgres:${SUPABASE_KEY}@${host}:5432/postgres`;

/**
 * Get all migration files sorted by name
 * Migrations should follow pattern: \d+_description.sql (e.g., 001_create_initial_schema.sql)
 *
 * @returns Array of migration filenames sorted alphabetically
 */
function getMigrationFiles(): string[] {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir);
  return files
    .filter((f) => f.endsWith('.sql') && f.match(/^\d+_/))
    .sort();
}

/**
 * Read migration file content
 *
 * @param filename Name of migration file to read
 * @returns SQL content of the migration file
 * @throws Error if file cannot be read
 */
function readMigrationFile(filename: string): string {
  const filepath = path.join(__dirname, filename);
  return fs.readFileSync(filepath, 'utf-8');
}

/**
 * Execute SQL directly via PostgreSQL client
 * Splits SQL into individual statements and executes sequentially
 *
 * @param sql SQL content to execute
 * @returns Result with success status and optional error message
 */
async function executeSql(sql: string): Promise<{ success: boolean; error?: string }> {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('  ✅ Connected to Supabase PostgreSQL');

    // Split statements and execute them
    const statements = sql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`  Executing ${statements.length} statement(s)...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await client.query(statement);
        console.log(`    ✅ Statement ${i + 1}/${statements.length} completed`);
      } catch (err: any) {
        console.error(`    ❌ Statement ${i + 1} failed:`);
        console.error(`       ${err.message}`);
        return { success: false, error: err.message };
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('  ❌ Connection failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    await client.end();
  }
}

/**
 * Run all pending migrations
 * Executes each migration file sequentially and reports results
 */
async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Starting database migrations...\n');

    const migrations = getMigrationFiles();

    if (migrations.length === 0) {
      console.log('✅ No migrations to run');
      return;
    }

    console.log(`📋 Found ${migrations.length} migration(s)\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const migration of migrations) {
      const sql = readMigrationFile(migration);
      console.log(`📄 Running migration: ${migration}\n`);

      const result = await executeSql(sql);

      if (result.success) {
        console.log(`✅ Migration "${migration}" completed successfully\n`);
        successCount++;
      } else {
        console.error(`❌ Migration "${migration}" failed: ${result.error}\n`);
        failureCount++;
      }
    }

    console.log('='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log('='.repeat(60));
    console.log('');

    if (failureCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  await runMigrations();
}

main().catch(console.error);

