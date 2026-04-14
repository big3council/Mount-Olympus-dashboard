/**
 * telegram.js — Mount Olympus Telegram bot integration
 *
 * Three Telegram surfaces, three different owners:
 *   • @olympusforge_bot (forge)  — smart front door. Polling lives in the
 *                                   separate olympus-build-bot PM2 process;
 *                                   this file holds only a send-only instance
 *                                   used by routeComplete for pipeline replies.
 *   • @zeusbot                   — direct-to-Zeus bot. Polling lives HERE.
 *                                   The inbound handler calls gateway.callAgent
 *                                   synchronously and replies with Zeus's
 *                                   response text. No queue, no classifier, no
 *                                   mission. Use when you already know you
 *                                   want to talk to Zeus.
 *   • @poseidonbot / @hadesbot   — direct-to-Poseidon/Hades. Polled by each
 *                                   agent's OWN OpenClaw gateway on its own
 *                                   node (NOT by the framework). Don't add
 *                                   them to BOT_CONFIGS here — Telegram will
 *                                   return 409 Conflict on token collision.
 *
 * Gaia's Telegram is managed exclusively by her own OpenClaw gateway.
 * Only messages from approved user IDs are processed.
 *
 * Reply routing for pipeline (forge) missions:
 *   1. Pending map  — exact chatId + bot stored when the message arrived
 *   2. Channel name — parsed from the channel string on request_complete,
 *                     handles restarts and API-initiated Telegram missions
 */

import TelegramBot from 'node-telegram-bot-api';
import { subscribe } from './olympus-ws.js';
import { callAgent } from './gateway.js';

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
// Telegram topology — three surfaces, three owners:
//   1) @olympusforge_bot      → polled by olympus-build-bot PM2 process.
//                                POSTs to /request (smart pipeline routing).
//                                Send-only instance below delivers replies.
//   2) @zeusbot                → polled HERE (this file). Direct-to-Zeus:
//                                handler calls gateway.callAgent("zeus", ...)
//                                and replies synchronously. No pipeline.
//   3) @poseidonbot / @hadesbot → polled by each agent's own OpenClaw
//                                instance on their own node. NOT touched by
//                                the framework (would cause 409 conflicts).
//                                Carson's intentional design.
const BOT_CONFIGS = [
  { name: 'forge', tokenEnv: 'BUILD_BOT_TOKEN',    target: 'zeus', polling: false                },
  { name: 'zeus',  tokenEnv: 'TELEGRAM_BOT_TOKEN', target: 'zeus', polling: true,  direct: true  },
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

  // War Room → reply to group chat via the forge bot
  if (lower.includes('war room')) {
    const warRoomId = Number(process.env.WAR_ROOM_CHAT_ID);
    if (!warRoomId) {
      console.warn('[Telegram] WAR_ROOM_CHAT_ID not set — cannot route War Room reply');
      return null;
    }
    const bot = activeBots.get('forge') ?? [...activeBots.values()][0];
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
    // Single front door: forge bot delivers all DMs.
    const bot = activeBots.get('forge') ?? [...activeBots.values()][0];
    if (!bot) { console.warn('[Telegram] No bot available for DM reply'); return null; }
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

  // Single front door: every reply (DM + War Room) ships through the forge bot.
  const bot = activeBots.get('forge') ?? [...activeBots.values()][0];

  // Deliver to user's DM (Telegram DM chatId === userId for private chats).
  // Skip the DM if this is purely a War Room mission — group chat delivery
  // below handles it. (For mixed cases — e.g. Telegram DM that mentions War
  // Room — both send.)
  if (bot && !isWarRoom) {
    const whom = userName || (isForge ? 'forge-user' : String(userId));
    console.log(`[Telegram] Reply → ${whom} chatId=${userId} bot=forge (id=${event.id})`);
    sendChunked(bot, userId, output).catch(e =>
      console.error('[Telegram] DM delivery failed:', e.message)
    );
  }

  // Deliver to War Room group chat if that was the origin channel.
  if (isWarRoom) {
    const warRoomId = Number(process.env.WAR_ROOM_CHAT_ID);
    if (warRoomId && bot) {
      console.log(`[Telegram] Reply → War Room chatId=${warRoomId} bot=forge (id=${event.id})`);
      sendChunked(bot, warRoomId, output).catch(e =>
        console.error('[Telegram] War Room delivery failed:', e.message)
      );
    } else if (!warRoomId) {
      console.warn('[Telegram] WAR_ROOM_CHAT_ID not set — skipping War Room delivery');
    }
  }
}

// ── Deliver queue acknowledgment to Telegram ──────────────────────────────────
function deliverAck(event) {
  const userId   = event.userId ? Number(event.userId) : null;
  if (!event.ackText) return;
  // Allow forge-bot users (BUILD_BOT_USERS gates them at ingest); only
  // require APPROVED_USERS for non-forge channels.
  const channel   = event.channel || '';
  const lowerCh   = channel.toLowerCase();
  const isForge   = lowerCh.startsWith('forge');
  const isWarRoom = lowerCh.includes('war room');
  const userName  = userId ? APPROVED_USERS.get(userId) : null;
  if (!isForge && !isWarRoom && !userName) return;

  const bot = activeBots.get('forge') ?? [...activeBots.values()][0];
  if (!bot) return;

  // DM the user (skip if War Room — group delivery covers it)
  if (userId && !isWarRoom) {
    sendReply(bot, userId, event.ackText).catch(e =>
      console.error('[Telegram] Ack DM delivery failed:', e.message)
    );
  }

  // War Room ack
  if (isWarRoom) {
    const warRoomId = Number(process.env.WAR_ROOM_CHAT_ID);
    if (warRoomId) {
      sendReply(bot, warRoomId, event.ackText).catch(e =>
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
        console.log(`[Telegram] Blocked userId=${userId} (not approved for ${cfg.name})`);
        return;
      }

      // Direct bots (zeus / poseidon / hades) only handle private DMs.
      // War Room runs through @olympusforge_bot (see build-bot.js). Skip
      // group-chat messages on the direct bots to avoid double-handling.
      if (msg.chat.type !== 'private') {
        return;
      }

      console.log(`[Telegram] ${cfg.name} ← ${userName} (${userId}): ${rawText.slice(0, 60)}`);

      // ── Direct bots: bypass the pipeline entirely ─────────────────────────
      // Call the agent's OpenClaw instance directly; reply with the response
      // text. No queue, no classifier, no mission state. userId flows through
      // so gateway.userSessionKey produces a stable per-(user, agent) session
      // key and the agent's OpenClaw threads conversation history per user.
      if (cfg.direct) {
        try {
          await bot.sendChatAction(chatId, 'typing').catch(() => {});
          const prompt = `Message from ${userName}: ${rawText}`;
          const reply = await callAgent({
            node:       cfg.target,
            prompt,
            sessionKey: `user-${userName.toLowerCase()}-${cfg.target}`,
          });
          await sendChunked(bot, chatId, reply || '…');
        } catch (err) {
          console.error(`[Telegram] ${cfg.name} direct error:`, err.message);
          await bot.sendMessage(chatId, `⚠️ ${cfg.target[0].toUpperCase() + cfg.target.slice(1)} is unreachable right now.`).catch(() => {});
        }
        return;
      }

      // ── Pipeline path (not used today — forge is send-only) ──────────────
      // Left in place in case a future config re-enables polling on a non-
      // direct bot that should route through /request. Kept for symmetry.
      const routeText = `Message from ${userName}: ${rawText}`;
      const channel   = `Telegram · ${userName}`;
      try {
        const res = await fetch('http://127.0.0.1:18780/request', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text:   routeText,
            channel,
            target: cfg.target,
            userId: String(userId),
          }),
        });
        const data = await res.json();
        if (data.ok && data.id) {
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
