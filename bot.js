import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import { Bot, webhookCallback } from "grammy";
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const INGEST_ENDPOINT = process.env.INGEST_ENDPOINT;
if (!BOT_TOKEN || !WEBHOOK_SECRET || !PUBLIC_BASE_URL || !INGEST_ENDPOINT) {
    throw new Error("Missing env vars");
}
const bot = new Bot(BOT_TOKEN);
// --- helper: send to your backend ---
async function forwardToBackend(payload) {
    await fetch(INGEST_ENDPOINT, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-webhook-secret": WEBHOOK_SECRET, // your own auth between bot->backend
        },
        body: JSON.stringify(payload),
    });
}
// --- channel posts ---
bot.on("channel_post", async (ctx) => {
    const m = ctx.channelPost;
    const chat = m.chat;
    const payload = {
        event: "channel_post",
        telegram_channel_id: chat.id,
        telegram_channel_username: chat.username ?? null,
        telegram_channel_title: chat.title ?? null,
        telegram_message_id: m.message_id,
        timestamp: m.date,
        text: m.text ?? null,
        caption: m.caption ?? null,
        entities: m.entities ?? m.caption_entities ?? [],
        author_signature: m.author_signature ?? null,
        forward_from_chat: m.forward_from_chat ?? null,
        media: [
            ...(m.photo ? m.photo.map(p => ({ type: "photo", file_id: p.file_id })) : []),
            ...(m.video ? [{ type: "video", file_id: m.video.file_id }] : []),
            ...(m.document ? [{ type: "document", file_id: m.document.file_id }] : []),
        ],
        permalink: chat.username
            ? `https://t.me/${chat.username}/${m.message_id}`
            : null,
    };
    await forwardToBackend(payload);
});
// --- edited channel posts ---
bot.on("edited_channel_post", async (ctx) => {
    const m = ctx.editedChannelPost;
    const chat = m.chat;
    const payload = {
        event: "edited_channel_post",
        telegram_channel_id: chat.id,
        telegram_message_id: m.message_id,
        timestamp: m.edit_date ?? m.date,
        text: m.text ?? null,
        caption: m.caption ?? null,
        entities: m.entities ?? m.caption_entities ?? [],
    };
    await forwardToBackend(payload);
});
// Optional: detect bot added/removed, permission changes
bot.on("my_chat_member", async (ctx) => {
    const upd = ctx.myChatMember;
    await forwardToBackend({
        event: "my_chat_member",
        telegram_channel_id: upd.chat.id,
        status: upd.new_chat_member.status,
        prev_status: upd.old_chat_member.status,
    });
});
// ---- Express webhook server ----
const app = express();
app.use(bodyParser.json());
// Telegram will sign webhook origin w/ secret token header if you set it. :contentReference[oaicite:2]{index=2}
app.post(`/telegram/${WEBHOOK_SECRET}`, webhookCallback(bot, "express"));
app.get("/health", (_, res) => res.send("ok"));
const port = process.env.PORT || 3000;
app.listen(port, async () => {
    console.log(`Bot listening on ${port}`);
    const webhookUrl = `${PUBLIC_BASE_URL}/telegram/${WEBHOOK_SECRET}`;
    // Limit update types to what you need
    await bot.api.setWebhook(webhookUrl, {
        secret_token: WEBHOOK_SECRET, // Telegram will echo this in header
        allowed_updates: ["channel_post", "edited_channel_post", "my_chat_member"],
    });
    console.log("Webhook set:", webhookUrl);
});
