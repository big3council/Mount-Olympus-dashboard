// ~/olympus/framework/flywheel/build-bot.js
// Mount Olympus — Build Bot (Telegram)
// Runs as PM2 process `olympus-build-bot`.
// Every message = a build job. No commands required.
// First line = title, remaining lines = description.
// Routing class auto-detected from keywords.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TOKEN        = process.env.BUILD_BOT_TOKEN;
const FLYWHEEL_URL = process.env.BUILD_BOT_FLYWHEEL_URL || 'http://127.0.0.1:18780/flywheel';

// User mapping: BUILD_BOT_USERS=carson:tg_username,tyler:tg_username
// Maps Telegram usernames to submitter names. If not set, accepts all
// senders in lax mode (uses raw Telegram username as submitter).
const USER_MAP = new Map();
for (const pair of (process.env.BUILD_BOT_USERS || '').split(',')) {
  const [name, tgUser] = pair.trim().split(':');
  if (name && tgUser) USER_MAP.set(tgUser.toLowerCase(), name.toLowerCase());
}

if (!TOKEN) {
  console.error('[build-bot] BUILD_BOT_TOKEN missing in env — exiting');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const log = (...args) => console.log('[build-bot]', new Date().toISOString(), ...args);

log('started — polling Telegram, flywheel =', FLYWHEEL_URL);
if (USER_MAP.size) {
  log('authorized users:', [...USER_MAP.entries()].map(([tg, name]) => `${name}(${tg})`).join(', '));
} else {
  log('lax mode — accepting all senders (set BUILD_BOT_USERS to restrict)');
}

// ---------------------------------------------------------------------------
// Routing class detection — keyword-based
// ---------------------------------------------------------------------------
const STRATEGIC_WORDS = [
  'architect', 'redesign', 'overhaul', 'migrate', 'infrastructure',
  'refactor', 'strategic', 'rethink', 'rebuild from scratch', 'full rewrite',
  'rearchitect', 'replatform',
];
const TRIVIAL_WORDS = [
  'quick', 'simple', 'minor', 'fix', 'typo', 'small', 'tweak', 'trivial',
  'bump', 'rename', 'update text', 'change label', 'cleanup', 'lint',
];

function classifyRouting(text) {
  const lower = text.toLowerCase();
  if (STRATEGIC_WORDS.some((w) => lower.includes(w))) return 'strategic';
  if (TRIVIAL_WORDS.some((w) => lower.includes(w))) return 'trivial';
  return 'standard';
}

// ---------------------------------------------------------------------------
// Sender resolution
// ---------------------------------------------------------------------------
function resolveSender(msg) {
  const tgUser = (msg.from?.username || '').toLowerCase();
  const tgId = String(msg.from?.id || '');
  if (USER_MAP.size === 0) return tgUser || tgId; // lax mode
  if (USER_MAP.has(tgUser)) return USER_MAP.get(tgUser);
  return null; // unknown → reject
}

// ---------------------------------------------------------------------------
// Flywheel submission
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Universal handler — every text message becomes a build job.
// First line = title. Remaining lines = description.
// ---------------------------------------------------------------------------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();

  // Ignore non-text messages (stickers, photos, voice, etc.)
  if (!text) return;

  log(`msg from ${msg.from?.username || msg.from?.id} (chat ${chatId}): ${text.slice(0, 120)}`);

  // Auth check
  const sender = resolveSender(msg);
  if (sender === null) {
    log('rejected — unknown user', msg.from?.username || msg.from?.id);
    return bot.sendMessage(chatId, 'Not authorized. Contact Carson.');
  }

  // Parse input
  const lines = text.split('\n');
  const title = lines[0].trim();
  const description = lines.slice(1).join('\n').trim();
  const routing_class = classifyRouting(text);

  // Submit to flywheel
  try {
    const job = await submitJob({ title, description, submitter: sender, routing_class });
    log('submitted', routing_class, 'job', job.id, 'for', sender);
    await bot.sendMessage(chatId,
      `\u26A1 Job received [${routing_class}]. Routing to the family now.\n\n${job.id}`);
  } catch (e) {
    log('submit error', e.message);
    await bot.sendMessage(chatId, `Flywheel error: ${e.message}`);
  }
});

// ---------------------------------------------------------------------------
// Error handling + graceful shutdown
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
