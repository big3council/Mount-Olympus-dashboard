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
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  const sender = msg.from?.username || String(msg.from?.id || 'unknown');
  log(`msg from ${sender} (chat ${chatId}): ${text.slice(0, 120)}`);

  // Enforce auth gate if BUILD_BOT_USERS is configured
  if (ALLOWED_USERS.length > 0) {
    const senderLower = sender.toLowerCase();
    const senderId = String(msg.from?.id || '');
    if (!ALLOWED_USERS.includes(senderLower) && !ALLOWED_USERS.includes(senderId)) {
      log(`BLOCKED: ${sender} (id: ${senderId}) not in BUILD_BOT_USERS`);
      await bot.sendMessage(chatId, 'Access denied. Contact the admin to be added to BUILD_BOT_USERS.');
      return;
    }
  }

  try {
    // Forward straight into the unified pipeline. Zeus (or a direct-agent
    // target when user prefixes "ZEUS PROTOCOL:") handles routing and the
    // result is delivered via the framework's existing Telegram delivery path.
    const reqResp = await fetch(REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        channel: `forge · ${sender}`,
        target:  'zeus',
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
