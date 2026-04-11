// ~/olympus/framework/flywheel/build-bot.js
// Mount Olympus — Build Bot (Telegram)
// Runs as PM2 process `olympus-build-bot`.
// Posts build jobs into the Flywheel via POST /flywheel/jobs.
// ADDITIVE ONLY — isolated from existing bot handlers, uses its own token.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';

// .env lives one dir up at ~/olympus/framework/.env (shared with server.js).
// build-bot.js sits in framework/flywheel/, so load the parent .env explicitly
// rather than relying on cwd (PM2 sets cwd to this dir, not the framework dir).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TOKEN         = process.env.BUILD_BOT_TOKEN;
const FLYWHEEL_URL  = process.env.BUILD_BOT_FLYWHEEL_URL || 'http://127.0.0.1:18780/flywheel';
const ALLOWED_CHATS = (process.env.BUILD_BOT_ALLOWED_CHATS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (!TOKEN) {
  console.error('[build-bot] BUILD_BOT_TOKEN missing in env — exiting');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

function log(...args) {
  console.log('[build-bot]', new Date().toISOString(), ...args);
}

log('started — polling Telegram, flywheel =', FLYWHEEL_URL);

function authorized(chatId) {
  if (ALLOWED_CHATS.length === 0) return true; // lax mode, accept all
  return ALLOWED_CHATS.includes(String(chatId));
}

async function submitJob({ title, description, submitter, routing_class }) {
  const resp = await fetch(`${FLYWHEEL_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, submitter, routing_class }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`flywheel ${resp.status}: ${text}`);
  }
  return resp.json();
}

function parsePayload(match) {
  const payload = (match[1] || '').trim();
  if (!payload) return null;
  const lines = payload.split('\n');
  return {
    title: lines[0].trim(),
    description: lines.slice(1).join('\n').trim(),
  };
}

bot.onText(/^\/build(?:\s+([\s\S]*))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!authorized(chatId)) {
    return bot.sendMessage(chatId, 'Not authorized for /build.');
  }
  const parsed = parsePayload(match);
  if (!parsed) {
    return bot.sendMessage(chatId,
      'Usage: /build <title>\\n<optional description>\\n\\nFirst line = title. Routing class = standard.');
  }
  const submitter = `telegram:${msg.from?.username || msg.from?.id}`;
  try {
    const job = await submitJob({
      title: parsed.title,
      description: parsed.description,
      submitter,
      routing_class: 'standard',
    });
    log('submitted standard job', job.id, 'for', submitter);
    await bot.sendMessage(chatId,
      `Job submitted: ${job.id}\nStatus: ${job.status}\nClass: ${job.routing_class}`);
  } catch (e) {
    log('submit error', e.message);
    await bot.sendMessage(chatId, `Flywheel error: ${e.message}`);
  }
});

bot.onText(/^\/trivial(?:\s+([\s\S]*))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!authorized(chatId)) {
    return bot.sendMessage(chatId, 'Not authorized for /trivial.');
  }
  const parsed = parsePayload(match);
  if (!parsed) {
    return bot.sendMessage(chatId, 'Usage: /trivial <title>\\n<optional description>');
  }
  const submitter = `telegram:${msg.from?.username || msg.from?.id}`;
  try {
    const job = await submitJob({
      title: parsed.title,
      description: parsed.description,
      submitter,
      routing_class: 'trivial',
    });
    log('submitted trivial job', job.id, 'for', submitter);
    await bot.sendMessage(chatId,
      `Trivial job: ${job.id}\nStatus: ${job.status}\nWP: ${(job.work_package_ids || []).join(', ') || '(none)'}`);
  } catch (e) {
    log('submit error', e.message);
    await bot.sendMessage(chatId, `Flywheel error: ${e.message}`);
  }
});

bot.onText(/^\/strategic(?:\s+([\s\S]*))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!authorized(chatId)) {
    return bot.sendMessage(chatId, 'Not authorized for /strategic.');
  }
  const parsed = parsePayload(match);
  if (!parsed) {
    return bot.sendMessage(chatId, 'Usage: /strategic <title>\\n<optional description>');
  }
  const submitter = `telegram:${msg.from?.username || msg.from?.id}`;
  try {
    const job = await submitJob({
      title: parsed.title,
      description: parsed.description,
      submitter,
      routing_class: 'strategic',
    });
    log('submitted strategic job', job.id, 'for', submitter);
    await bot.sendMessage(chatId,
      `Strategic job submitted: ${job.id}\nStatus: ${job.status}\nAwaiting routing plan.`);
  } catch (e) {
    log('submit error', e.message);
    await bot.sendMessage(chatId, `Flywheel error: ${e.message}`);
  }
});

bot.on('polling_error', (err) => {
  console.error('[build-bot] polling_error', err.code, err.message);
});

// Graceful shutdown — stop polling before exit to avoid 409 Conflict on restart.
function shutdown() {
  log('shutting down');
  bot.stopPolling().finally(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
