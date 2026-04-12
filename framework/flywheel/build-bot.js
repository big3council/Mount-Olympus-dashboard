// ~/olympus/framework/flywheel/build-bot.js
// Mount Olympus — Build Bot (Telegram)
// Every message = a flywheel job. Zeus classifies, not the bot.
// Bot creates job → wakes Zeus → Zeus handles everything.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const TOKEN        = process.env.BUILD_BOT_TOKEN;
const FLYWHEEL_URL = process.env.BUILD_BOT_FLYWHEEL_URL || 'http://127.0.0.1:18780/flywheel';

if (!TOKEN) {
  console.error('[build-bot] BUILD_BOT_TOKEN missing in env — exiting');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const log = (...args) => console.log('[build-bot]', new Date().toISOString(), ...args);

log('started — polling Telegram, flywheel =', FLYWHEEL_URL);

// ---------------------------------------------------------------------------
// Every text message → create job → wake Zeus
// ---------------------------------------------------------------------------
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  const sender = msg.from?.username || String(msg.from?.id || 'unknown');
  log(`msg from ${sender} (chat ${chatId}): ${text.slice(0, 120)}`);

  // First line = title, rest = description
  const lines = text.split('\n');
  const title = lines[0].trim();
  const description = lines.slice(1).join('\n').trim();

  try {
    // Step 1: Create job with pending_classification — Zeus will classify
    const jobResp = await fetch(`${FLYWHEEL_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        submitter: sender,
        routing_class: 'pending_classification',
      }),
    });

    if (!jobResp.ok) {
      const errText = await jobResp.text();
      throw new Error(`create job ${jobResp.status}: ${errText}`);
    }
    const job = await jobResp.json();
    log('job created:', job.id);

    // Step 2: Wake Zeus — fire and forget
    fetch(`${FLYWHEEL_URL}/wake-zeus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        prompt: text,
        chat_id: String(chatId),
      }),
    }).catch(err => log('wake-zeus call error:', err.message));

    // Step 3: Acknowledge
    await bot.sendMessage(chatId, `\u26A1 Job received. Zeus is on it.\n\n${job.id}`);

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
