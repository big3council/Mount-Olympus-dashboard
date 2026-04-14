// ~/olympus/framework/flywheel/build-bot.js
// Mount Olympus — Build Bot (Telegram)
// Every message is forwarded into the unified B3C pipeline via POST /request.
// Zeus classifies (T1 vs T2); direct-agent targets bypass the classifier.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TOKEN       = process.env.BUILD_BOT_TOKEN;
const REQUEST_URL = process.env.BUILD_BOT_REQUEST_URL || 'http://127.0.0.1:18780/request';

if (!TOKEN) {
  console.error('[build-bot] BUILD_BOT_TOKEN missing in env — exiting');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const log = (...args) => console.log('[build-bot]', new Date().toISOString(), ...args);

// Auth gate — set BUILD_BOT_USERS in .env as comma-separated usernames or IDs
const ALLOWED_USERS = (process.env.BUILD_BOT_USERS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

if (ALLOWED_USERS.length === 0) {
  log('WARNING: BUILD_BOT_USERS not set — accepting all senders (set BUILD_BOT_USERS in .env to restrict)');
} else {
  log('auth gate active — allowed users:', ALLOWED_USERS.join(', '));
}

log('started — polling Telegram, request =', REQUEST_URL);

// ---------------------------------------------------------------------------
// Every text message → create job → wake Zeus
// ---------------------------------------------------------------------------
// War Room group chat id (for routing replies back through framework
// telegram.js's War Room delivery branch). Optional — only set this if
// the forge bot is a member of a group designated as the War Room.
const WAR_ROOM_CHAT_ID = process.env.WAR_ROOM_CHAT_ID
  ? String(process.env.WAR_ROOM_CHAT_ID)
  : null;

bot.on('message', async (msg) => {
  const chatId    = msg.chat.id;
  const chatType  = msg.chat.type;          // 'private' | 'group' | 'supergroup' | 'channel'
  const text      = (msg.text || '').trim();
  if (!text) return;

  const sender    = msg.from?.username || String(msg.from?.id || 'unknown');
  const isGroup   = chatType === 'group' || chatType === 'supergroup';
  const isWarRoom = isGroup && WAR_ROOM_CHAT_ID && String(chatId) === WAR_ROOM_CHAT_ID;

  log(`msg from ${sender} (chat ${chatId}, ${chatType}${isWarRoom ? ', WAR ROOM' : ''}): ${text.slice(0, 120)}`);

  // Auth gate. Always applies to DMs. For War Room (a group everyone in it
  // is implicitly trusted), skip the per-user gate — Carson controls group
  // membership directly. For other groups (none expected today), still
  // enforce BUILD_BOT_USERS as a safety net.
  if (ALLOWED_USERS.length > 0 && !isWarRoom) {
    const senderLower = sender.toLowerCase();
    const senderId = String(msg.from?.id || '');
    if (!ALLOWED_USERS.includes(senderLower) && !ALLOWED_USERS.includes(senderId)) {
      log(`BLOCKED: ${sender} (id: ${senderId}) not in BUILD_BOT_USERS`);
      await bot.sendMessage(chatId, 'Access denied. Contact the admin to be added to BUILD_BOT_USERS.');
      return;
    }
  }

  try {
    // Forward into the unified pipeline. The framework's Telegram delivery
    // hook (telegram.js routeComplete) ships the synthesized reply back via
    // the forge bot to either the user's DM or the War Room group, based on
    // channel + isWarRoom flag.
    const channel = isWarRoom ? `war room · ${sender}` : `forge · ${sender}`;

    const reqResp = await fetch(REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        channel,
        target:    'zeus',
        userId:    String(msg.from?.id || chatId),
        ...(isWarRoom ? { isWarRoom: true } : {}),
      }),
    });

    if (!reqResp.ok) {
      const errText = await reqResp.text();
      throw new Error(`create request ${reqResp.status}: ${errText}`);
    }
    const req = await reqResp.json();
    log('request created:', req.id);

    await bot.sendMessage(chatId, '\u26A1 Council receiving...');

  } catch (e) {
    log('error:', e.message);
    await bot.sendMessage(chatId, `Error: ${e.message}`);
  }
});

// ---------------------------------------------------------------------------
bot.on('polling_error', (err) => {
  console.error('[build-bot] polling_error', err.code, err.message);
});

function shutdown() {
  log('shutting down');
  bot.stopPolling().finally(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
