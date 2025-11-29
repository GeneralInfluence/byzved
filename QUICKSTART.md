# Quick Start Cheat Sheet

## 5-Minute Setup

### Step 1: Install & Configure
```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Step 2: Get Your Credentials

**Telegram Bot Token:**
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`
3. Follow instructions, copy token

**Supabase:**
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → API
4. Copy `Project URL` and `anon key`

### Step 3: Configure .env
```bash
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
BOT_MODE=polling
```

### Step 4: Set Up Database
In Supabase SQL Editor, run:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create conversations table
CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  vector vector(1536),
  user_name TEXT,
  user_first_name TEXT,
  user_last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create opt_out_users table
CREATE TABLE opt_out_users (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  opted_out_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_group_id ON conversations(group_id);
CREATE INDEX idx_conversations_timestamp ON conversations(timestamp DESC);
```

### Step 5: Run the Bot
```bash
npm run dev
```

Expected output:
```
✅ Configuration validated
✅ Supabase client initialized
✅ conversations table is accessible
✅ opt_out_users table is accessible
⚠️  OpenAI API key not provided. Embeddings will be disabled.
🚀 Starting bot in POLLING mode
✅ Bot started as @YourBotName
```

### Step 6: Test
1. Create a Telegram group or channel
2. Add the bot to your group
3. Send a message: "Hello, this is a test"
4. Check Supabase **conversations** table → Should see your message!

---

## Testing Commands

In your Telegram chat with the bot:

```
/start     # See welcome message
/stats     # View statistics
/optout    # Opt out (won't collect your messages)
```

---

## Common Commands

### Development
```bash
npm run dev       # Start in polling mode
npm run build     # Compile TypeScript
npm start         # Run compiled version
```

### Production Setup
```bash
export BOT_MODE=webhook
export WEBHOOK_URL=https://your-domain.com/webhook
npm run build
npm start
```

---

## Environment Variables

```bash
# REQUIRED
TELEGRAM_BOT_TOKEN        # From @BotFather
SUPABASE_URL              # From Supabase project settings
SUPABASE_KEY              # From Supabase project settings

# OPTIONAL
OPENAI_API_KEY            # For vector embeddings
BOT_MODE                  # 'polling' (default) or 'webhook'
WEBHOOK_URL               # For webhook mode
PORT                      # Server port (default: 3000)
```

---

## Troubleshooting

### Bot won't start
```bash
# Check env vars are set
cat .env

# Verify bot token is valid
# (test by running a curl command to Telegram API)
```

### Messages not appearing
```sql
-- Check if table exists
SELECT * FROM conversations LIMIT 1;

-- Check opt-out status
SELECT * FROM opt_out_users;
```

### Database connection error
- Verify SUPABASE_URL is correct
- Verify SUPABASE_KEY is correct
- Check Supabase project is active
- Ensure tables were created

---

## File Structure

```
byzved/
├── bot.ts                  # Main bot code
├── src/
│   ├── types.ts           # Interfaces
│   ├── supabase.ts        # Database client
│   └── embeddings.ts      # Embeddings service
├── .env                   # Your config (local only)
├── .env.example           # Template
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── SETUP.md               # Detailed guide
├── README.md              # Project info
└── LICENSE
```

---

## Database Schema Quick Ref

### conversations
- `id`: Auto-increment primary key
- `message_id`: Unique Telegram message ID
- `text`: Message content
- `user_id`: Telegram user ID
- `group_id`: Telegram group/channel ID
- `timestamp`: When message was sent
- `vector`: OpenAI embedding (1536 dimensions)
- `user_name`: Telegram username
- `user_first_name`: User's first name
- `user_last_name`: User's last name
- `created_at`: When ingested

### opt_out_users
- `id`: Auto-increment primary key
- `user_id`: Telegram user ID
- `opted_out_at`: When user opted out

---

## Next Steps

1. ✅ Get API credentials
2. ✅ Configure `.env`
3. ✅ Create database tables
4. ✅ Run bot with `npm run dev`
5. ✅ Test with messages
6. 🚀 Deploy to production

---

## Useful Links

- 🤖 [Telegram BotFather](https://t.me/botfather)
- 📊 [Supabase Dashboard](https://app.supabase.com)
- 📖 [Grammy.js Docs](https://grammy.dev)
- 🔌 [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- 🤖 [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

---

## Support

For detailed setup, see **SETUP.md**
For project overview, see **README.md**
For implementation details, see **IMPLEMENTATION_SUMMARY.md**

---

**Ready to ingest! 🚀**
