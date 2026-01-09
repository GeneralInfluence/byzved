# Telegram Ingestion Bot

A production-ready MVP for ingesting messages from Telegram groups and channels into Supabase with optional OpenAI or Google Gemini embeddings for semantic search.

## 🎯 Features

- **Message Ingestion**: Capture text messages from Telegram groups/channels
- **Database Storage**: Store raw data in Supabase with pgvector support
- **Dual Embedding Support**: OpenAI or Google Gemini with automatic provider selection
- **Graceful Fallback**: Works without embeddings if neither API key is provided
- **Privacy Controls**: User opt-out command (`/optout`)
- **Webhook Ready**: Express-based webhook support for production
- **Polling Mode**: Development-friendly polling for local testing
- **Error Handling**: Robust error handling with logging
- **TypeScript**: Fully typed for reliability

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Supabase account (free tier works)
- Telegram bot token from [@BotFather](https://t.me/botfather)
- OpenAI API key OR Google Gemini API key (optional, for embeddings)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Fill in your credentials
# TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY, etc.

# 4. Set up Supabase tables (see SETUP.md)

# 5. Run in development mode
npm run dev
```

## 📋 Setup Instructions

For complete setup guide including:
- Supabase project creation
- Database table setup with SQL scripts
- Telegram bot configuration
- Environment variable setup
- Testing procedures
- Deployment options

**See [SETUP.md](./SETUP.md)**

## 📁 Project Structure

```
byzved/
├── bot.ts                    # Main bot logic
├── src/
│   ├── types.ts             # TypeScript interfaces
│   ├── supabase.ts          # Database client & operations
│   └── embeddings.ts        # OpenAI embeddings service
├── dist/                    # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
├── SETUP.md                 # Detailed setup guide
├── .env.example             # Environment template
└── README.md
```

## 🤖 Bot Commands

```
/start   - Welcome message and bot information
/optout  - Remove yourself from data collection
/stats   - View ingestion statistics
/ask     - Ask a question (private chat only)
```

## 💾 Database Schema

### `conversations` table
```sql
- id: BIGINT (primary key)
- message_id: BIGINT (unique)
- text: TEXT (message content)
- user_id: BIGINT (Telegram user ID)
- group_id: BIGINT (Telegram chat ID)
- timestamp: TIMESTAMP (message time)
- vector: vector(1536) (OpenAI embedding, optional)
- user_name: TEXT
- user_first_name: TEXT
- user_last_name: TEXT
- created_at: TIMESTAMP (ingestion time)
```

### `opt_out_users` table
```sql
- id: BIGINT (primary key)
- user_id: BIGINT (unique)
- opted_out_at: TIMESTAMP
```

## 🔧 Development

### Running in Dev Mode (Polling)

```bash
npm run dev
```

The bot will start in polling mode and automatically fetch updates from Telegram.

### Building for Production

```bash
npm run build
```

Compiles TypeScript to `dist/bot.js`

### Production Mode (Webhook)

```bash
export BOT_MODE=webhook
export WEBHOOK_URL=https://your-domain.com/webhook
export PORT=3000

npm run build
npm start
```

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `grammy` | ^1.38.4 | Telegram bot framework |
| `@supabase/supabase-js` | ^2.38.5 | Database client |
| `openai` | ^4.24.1 | Embeddings API |
| `express` | ^5.1.0 | Webhook server |
| `dotenv` | ^17.2.3 | Environment variables |
| `typescript` | ^5.9.3 | Language & compilation |

## 🌍 Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token       # From @BotFather
SUPABASE_URL=https://...                # Project URL
SUPABASE_KEY=eyJ...                     # Anon key

# Optional (choose one for embeddings)
OPENAI_API_KEY=sk-proj-...              # Priority 1: OpenAI
GEMINI_API_KEY=...                      # Priority 2: Google Gemini
BOT_MODE=polling                        # 'polling' or 'webhook'
WEBHOOK_URL=https://your-domain.com     # For webhook mode
PORT=3000                               # Server port
```

## 🧪 Testing

1. **Create a test group** in Telegram
2. **Add the bot** to your group
3. **Run the bot** locally:
   ```bash
   npm run dev
   ```
4. **Send messages** in the test group
5. **Check Supabase** dashboard to see messages ingested
6. **Try commands:**
   ```
   /start
   /stats
   /optout
   ```

## 📢 Adding the Bot to a Channel

To ingest messages from a Telegram channel:

1. **Add the bot as an admin** to your channel:
   - Open your channel in Telegram.
   - Go to *Channel Info* → *Administrators* → *Add Admin*.
   - Search for your bot by username and add it.
   - Grant at least the "Read Messages" permission.
2. **(Optional) Set up a test message** in your channel to verify ingestion.

*Note: The bot cannot read messages in private channels unless it is an admin.*

## 💬 Interacting with the Bot

You can interact with the bot in any group, channel, or private chat where it is present. Use the following commands:

- `/start` — Get a welcome message and bot info
- `/optout` — Remove yourself from data collection (only works in groups)
- `/stats` — View ingestion statistics (group/channel context)
- `/ask` — Ask a question and get a response (only in private chat)

**In Channels:**
- The bot works passively and does not respond to commands in channels, but will ingest messages if it has admin rights.

**In Groups:**
- To interact with the bot, mention it directly using its username, e.g. `/stats@YourBotUsername`.
- The bot will reply in the group if mentioned.

**In Private Chat:**
- Send commands directly to the bot as messages.
- The `/ask` command is only available in private chat.
- The bot will reply with information or perform the requested action.

---

## 🚀 Deployment

### Vercel (Webhook)
```bash
npm install -g vercel
vercel
# Set environment variables in Vercel dashboard
```

### Railway / Render
1. Connect your GitHub repository
2. Set environment variables
3. Deploy with `npm run build && npm start`

### Self-hosted
1. Set up on any Node.js hosting
2. Configure environment variables
3. Set webhook URL in Telegram
4. Use process manager like `pm2`

## 🛡️ Privacy & Ethics

- ✅ Only collects public group messages
- ✅ Users can opt-out anytime via `/optout`
- ✅ No tracking of opted-out users
- ✅ Transparent about data collection
- ✅ User metadata (name, ID) stored for context

## 🔮 Future Enhancements

- [ ] Semantic search using embeddings
- [ ] Lead recognition and qualification
- [ ] Analytics dashboard
- [ ] Topic clustering
- [ ] Real-time alerts
- [ ] Multi-bot management
- [ ] Custom embedding models
- [ ] Message deduplication

## 🐛 Troubleshooting

**Bot doesn't start:**
- Check all required env vars are set
- Verify TELEGRAM_BOT_TOKEN is valid
- Check Supabase credentials

**Messages not being ingested:**
- Verify bot has read permissions in group
- Check bot is actually added to group
- Check user hasn't opted out
- Review console logs

**No embeddings:**
- Neither OpenAI nor Gemini API key provided
- Check bot logs for configuration status
- Review bot logs for API errors
- Messages still ingested with `vector: null`

**See [SETUP.md](./SETUP.md) for more troubleshooting steps**

## 📄 License

MIT

## 🤝 Contributing

Feel free to open issues and PRs for improvements!

---

**Built with TypeScript, Grammy.js, Supabase & OpenAI** 🚀
