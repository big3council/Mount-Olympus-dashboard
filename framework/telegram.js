/**
 * telegram.js — Mount Olympus Telegram bot integration
 *
 * Three bots mirror the dashboard routing:
 *   Zeus bot     → full B3C (tier-classified) or ZEUS PROTOCOL direct
 *                  Also handles War Room group chat (B3C, reply to group)
 *   Poseidon bot → direct Poseidon
 *   Hades bot    → direct Hades
 *
 * Gaia's Telegram is managed exclusively by her own OpenClaw gateway.
 * Only messages from approved user IDs are processed.
 *
 * Reply routing has two paths (tried in order):
 *   1. Pending map  — exact chatId + bot stored when the message arrived
 *   2. Channel name — parsed from the channel string on request_complete,
 *                     handles restarts and API-initiated Telegram missions
 */

import TelegramBot from 'node-telegram-bot-api';
import { subscribe } from './olympus-ws.js';

// ── Approved senders ──────────────────────────────────────────────────────────
const APPROVED_USERS = new Map([
  [8150818650, 'Carson'],
  [874345067,  'Tyler'],
]);

// Telegram DM chatId equals userId for private chats
const USER_CHAT_IDS = new Map([
  ['carson', 8150818650],
  ['tyler',  874345067],
]);

// ── Bot configuration ─────────────────────────────────────────────────────────
// The forge entry is a SEND-ONLY instance sharing @olympusforge_bot's token.
// The polling side of that bot runs in the separate olympus-build-bot PM2
// process (flywheel/build-bot.js); this entry exists only so routeComplete
// can deliver synthesized output back to "forge · <sender>" channels.
const BOT_CONFIGS = [
  { name: 'zeus',     tokenEnv: 'TELEGRAM_BOT_TOKEN',    target: 'zeus',     polling: true  },
  { name: 'poseidon', tokenEnv: 'POSEIDON_BOT_TOKEN',    target: 'poseidon', polling: false },
  { name: 'hades',    tokenEnv: 'HADES_BOT_TOKEN',       target: 'hades',    polling: false },
  { name: 'forge',    tokenEnv: 'BUILD_BOT_TOKEN',       target: 'zeus',     polling: false },
];

// ── Active bot instances (name → bot) ─────────────────────────────────────────
const activeBots = new Map();

// ── Pending reply map: requestId → { chatId, bot } ───────────────────────────
// Populated by the bot message handler as soon as /request returns an id.
// Primary return path — has the exact chatId from the incoming Telegram message.
const pending = new Map();

// ── Deduplication guard: prevent double delivery ──────────────────────────────
// Tracks requestIds that have already been delivered. Entries auto-expire after 5 minutes.
const deliveredIds = new Map(); // requestId → timestamp
const DEDUP_TTL = 5 * 60 * 1000; // 5 minutes

// ── Telegram message length limit ─────────────────────────────────────────────
const TG_LIMIT = 4096;
const TG_SAFE  = 4000; // split point — leaves buffer for Markdown formatting

// Split long text into ≤ TG_LIMIT chunks at natural boundaries.
function splitMessage(text) {
  if (text.length <= TG_LIMIT) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > TG_LIMIT) {
    let splitAt = remaining.lastIndexOf('\n\n', TG_SAFE); // paragraph boundary
    if (splitAt < 200) splitAt = remaining.lastIndexOf('\n', TG_SAFE); // line boundary
    if (splitAt < 200) splitAt = TG_SAFE;                              // hard split
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

// ── Send a message (Markdown → plain text fallback) ───────────────────────────
function sendReply(bot, chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
    .catch(() =>
      bot.sendMessage(chatId, text)
        .catch(e => console.error('[Telegram] Failed to send reply:', e.message))
    );
}

// ── Send a long message, splitting into chunks if needed ──────────────────────
async function sendChunked(bot, chatId, text) {
  const chunks = splitMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 500)); // rate limit: ~1 msg/sec
    await sendReply(bot, chatId, chunks[i]);
  }
}

// ── Resolve delivery destination from channel string ─────────────────────────
// Channel formats:
//   "Telegram · Carson"   → DM to Carson (chatId = 8150818650)
//   "Telegram · Tyler"    → DM to Tyler  (chatId = 874345067)
//   "War Room · Carson"   → War Room group chat
//   "War Room · Tyler"    → War Room group chat
//   "dashboard"           → no Telegram delivery
// directTarget (from event.direct) selects the bot for agent-targeted missions.
function resolveDestination(channel, directTarget) {
  const lower = channel.toLowerCase();

  // War Room → reply to group chat via Zeus bot
  if (lower.includes('war room')) {
    const warRoomId = Number(process.env.WAR_ROOM_CHAT_ID);
    if (!warRoomId) {
      console.warn('[Telegram] WAR_ROOM_CHAT_ID not set — cannot route War Room reply');
      return null;
    }
    const bot = activeBots.get('zeus') ?? [...activeBots.values()][0];
    if (!bot) { console.warn('[Telegram] No bot for War Room reply'); return null; }
    return { bot, chatId: warRoomId };
  }

  // Telegram DM → route by user name embedded in channel string
  if (lower.includes('telegram')) {
    let chatId = null;
    for (const [name, id] of USER_CHAT_IDS) {
      if (lower.includes(name)) { chatId = id; break; }
    }
    if (!chatId) {
      console.warn(`[Telegram] Cannot resolve chatId from channel "${channel}"`);
      return null;
    }
    // Bot: match direct target agent if set, else Zeus for B3C responses
    const botName = directTarget === 'poseidon' ? 'poseidon'
                  : directTarget === 'hades'    ? 'hades'
                  : 'zeus';
    const bot = activeBots.get(botName) ?? activeBots.get('zeus') ?? [...activeBots.values()][0];
    if (!bot) { console.warn(`[Telegram] No bot available for ${botName} reply`); return null; }
    return { bot, chatId };
  }

  // dashboard or unknown — no Telegram delivery needed
  return null;
}

// ── Deliver request_complete output back to the right chat ────────────────────
function routeComplete(event) {
  const output = event.output;
  if (!output) return;

  // Dedup guard: skip if already delivered for this requestId
  if (deliveredIds.has(event.id)) {
    console.log(`[Telegram] Dedup: already delivered id=${event.id}, skipping`);
    return;
  }
  deliveredIds.set(event.id, Date.now());
  // Prune expired entries (older than 5 min)
  const now = Date.now();
  for (const [id, ts] of deliveredIds) {
    if (now - ts > DEDUP_TTL) deliveredIds.delete(id);
  }

  // Path 1: pending map — exact chatId from the incoming Telegram message
  const entry = pending.get(event.id);
  if (entry) {
    pending.delete(event.id);
    console.log(`[Telegram] Reply via pending map → chatId=${entry.chatId} (id=${event.id})`);
    sendChunked(entry.bot, entry.chatId, output).catch(e =>
      console.error('[Telegram] Path 1 delivery failed:', e.message)
    );
    return;
  }

  // Path 2: userId-based delivery — handles dashboard missions and restart recovery.
  // userId is now included in request_complete by b3c.js, direct.js, and gaia.js,
  // and by the forge channel (build-bot.js posts /request with userId).
  const userId = event.userId ? Number(event.userId) : null;

  const channel = event.channel || '';
  const lowerCh = channel.toLowerCase();
  const isForge   = lowerCh.startsWith('forge');
  const isWarRoom = lowerCh.includes('war room');

  // For forge (@olympusforge_bot) we trust the caller's userId as the chatId
  // directly — the Telegram bot has its own BUILD_BOT_USERS allowlist at the
  // polling side, so we don't re-check APPROVED_USERS here. For every other
  // channel keep the approved-user gate.
  const userName = userId ? APPROVED_USERS.get(userId) : null;
  if (!isForge && !userName) return; // unrecognized user → no delivery

  // Select bot: forge channel → forge bot; direct agent → that agent's bot;
  // otherwise the default Zeus bot.
  const botName = isForge ? 'forge'
                : event.direct === 'poseidon' ? 'poseidon'
                : event.direct === 'hades'    ? 'hades'
                : 'zeus';
  const bot = activeBots.get(botName) ?? activeBots.get('zeus') ?? [...activeBots.values()][0];

  // Deliver to user's DM (Telegram DM chatId === userId for private chats)
  if (bot) {
    const whom = userName || (isForge ? 'forge-user' : String(userId));
    console.log(`[Telegram] Reply via userId → ${whom} chatId=${userId} bot=${botName} (id=${event.id})`);
    sendChunked(bot, userId, output).catch(e =>
      console.error('[Telegram] Path 2 DM delivery failed:', e.message)
    );
  }

  // Also deliver to War Room group chat if that was the origin channel
  if (isWarRoom) {
    const warRoomId = Number(process.env.WAR_ROOM_CHAT_ID);
    const wrBot = activeBots.get('zeus') ?? [...activeBots.values()][0];
    if (warRoomId && wrBot) {
      console.log(`[Telegram] Also delivering to War Room chatId=${warRoomId} (id=${event.id})`);
      sendChunked(wrBot, warRoomId, output).catch(e =>
        console.error('[Telegram] Path 2 War Room delivery failed:', e.message)
      );
    }
  }
}

// ── Deliver queue acknowledgment to Telegram ──────────────────────────────────
function deliverAck(event) {
  const userId   = event.userId ? Number(event.userId) : null;
  const userName = userId ? APPROVED_USERS.get(userId) : null;
  if (!userName || !event.ackText) return;

  const channel    = event.channel || '';
  const isWarRoom  = channel.toLowerCase().includes('war room');
  const botName    = event.target === 'poseidon' ? 'poseidon'
                   : event.target === 'hades'    ? 'hades'
                   : 'zeus';
  const bot = activeBots.get(botName) ?? activeBots.get('zeus') ?? [...activeBots.values()][0];
  if (!bot) return;

  // DM the user
  sendReply(bot, userId, event.ackText).catch(e =>
    console.error('[Telegram] Ack DM delivery failed:', e.message)
  );

  // Also post to War Room if that was the origin
  if (isWarRoom) {
    const warRoomId = Number(process.env.WAR_ROOM_CHAT_ID);
    const wrBot = activeBots.get('zeus') ?? [...activeBots.values()][0];
    if (warRoomId && wrBot) {
      sendReply(wrBot, warRoomId, event.ackText).catch(e =>
        console.error('[Telegram] Ack War Room delivery failed:', e.message)
      );
    }
  }
}

// ── Internal broadcast subscriber ─────────────────────────────────────────────
subscribe((event) => {
  if (event.type === 'queue_ack') { deliverAck(event); return; }
  if (event.type !== 'request_complete') return;
  routeComplete(event);
});

// ── Send a message to the Growth Grid group chat ──────────────────────────────
export function sendToGrowthGrid(text) {
  const chatId = Number(process.env.GROWTH_GRID_CHAT_ID);
  if (!chatId) { console.warn('[Telegram] GROWTH_GRID_CHAT_ID not set'); return; }
  const bot = activeBots.get('zeus') ?? [...activeBots.values()][0];
  if (!bot) { console.warn('[Telegram] No bot available for Growth Grid'); return; }
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
    .catch(() => bot.sendMessage(chatId, text)
      .catch(e => console.error('[Telegram] Growth Grid send error:', e.message)));
}

// ── Start all configured bots ─────────────────────────────────────────────────
export function initTelegram() {
  if (activeBots.size > 0) {
    console.warn('[Telegram] initTelegram called again — already initialized, skipping');
    return;
  }
  let started = 0;

  for (const cfg of BOT_CONFIGS) {
    const token = process.env[cfg.tokenEnv];
    if (!token) {
      console.warn(`[Telegram] ${cfg.tokenEnv} not set — skipping ${cfg.name} bot`);
      continue;
    }

    let bot;
    try {
      bot = new TelegramBot(token, { polling: cfg.polling !== false });
    } catch (err) {
      console.error(`[Telegram] Failed to init ${cfg.name} bot:`, err.message);
      continue;
    }

    console.log(`[Telegram] ${cfg.name} bot started (${cfg.polling !== false ? 'polling' : 'send-only'})`);
    activeBots.set(cfg.name, bot);
    started++;

    if (cfg.polling !== false) bot.on('message', async (msg) => {
      const userId  = msg.from?.id;
      const chatId  = msg.chat.id;
      const rawText = msg.text?.trim();

      if (!rawText) return;

      const userName = APPROVED_USERS.get(userId);
      if (!userName) {
        console.log(`[Telegram] Blocked userId=${userId} (not approved)`);
        return;
      }

      // ── War Room group chat (Zeus bot only) ──────────────────────────────
      const warRoomId = Number(process.env.WAR_ROOM_CHAT_ID);
      const isWarRoom = cfg.name === 'zeus' && warRoomId && chatId === warRoomId;

      // Non-Zeus bots ignore group chats
      if (cfg.name !== 'zeus' && msg.chat.type !== 'private') return;

      // Build route
      const routeTarget = isWarRoom ? 'zeus' : cfg.target;

      const identityPrefix = isWarRoom
        ? `Message from ${userName} in the War Room: `
        : `Message from ${userName}: `;

      let routeText;
      if (cfg.name === 'zeus' && !isWarRoom && rawText.toUpperCase().startsWith('ZEUS PROTOCOL')) {
        const stripped = rawText.replace(/^ZEUS PROTOCOL[:\s]*/i, '').trim();
        routeText = `ZEUS PROTOCOL: ${identityPrefix}${stripped}`;
      } else {
        routeText = identityPrefix + rawText;
      }

      const channel = isWarRoom ? `War Room · ${userName}` : `Telegram · ${userName}`;

      console.log(`[Telegram] ${isWarRoom ? 'war-room' : cfg.name} ← ${userName} (${userId}): ${rawText.slice(0, 60)}`);

      try {
        const res = await fetch('http://127.0.0.1:18780/request', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text:      routeText,
            channel,
            target:    routeTarget,
            userId:    String(userId),
            isWarRoom: isWarRoom || undefined,
          }),
        });

        const data = await res.json();

        if (data.ok && data.id) {
          // Store exact chatId + bot for primary return routing
          pending.set(data.id, { chatId, bot });
        } else {
          await bot.sendMessage(chatId, '⚠️ Council unavailable. Try again.');
        }
      } catch (err) {
        console.error(`[Telegram] Route error (${cfg.name}):`, err.message);
        await bot.sendMessage(chatId, '⚠️ Framework unreachable.').catch(() => {});
      }
    });

    if (cfg.polling !== false) bot.on('polling_error', (err) => {
      console.error(`[Telegram] ${cfg.name} polling error:`, err.message);
    });
  }

  if (started === 0) {
    console.log('[Telegram] No bot tokens configured — Telegram integration disabled');
  }
}

// ── Graceful shutdown — stop polling before process exits ─────────────────────
export function shutdownTelegram() {
  const promises = [];
  for (const [name, bot] of activeBots) {
    if (bot.isPolling()) {
      console.log(`[Telegram] Stopping ${name} polling...`);
      promises.push(bot.stopPolling().catch(() => {}));
    }
  }
  activeBots.clear();
  return Promise.all(promises);
}
