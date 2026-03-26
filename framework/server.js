/**
 * server.js — Mount Olympus B3C Framework Entry Point
 *
 * HTTP on :18780
 * WebSocket on ws://<host>:18780/live  (attached via olympus-ws.js)
 */

import 'dotenv/config';
import http from 'http';
import fs   from 'fs';
import path from 'path';
import os   from 'os';
import express from 'express';
import { WebSocket } from 'ws';
import { initWS, broadcast } from './olympus-ws.js';
import { enqueue, cancelMission, getQueue } from './queue.js';
import { initTelegram } from './telegram.js';
import { initGaia, runDirectGaia, gaiaInitiateCouncil, observeMission, executeSSHControl } from './gaia.js';

const PORT = 18780;

// ── Mission persistence ───────────────────────────────────────────────────────
const MISSIONS_DIR  = path.join(os.homedir(), 'olympus', 'data');
const MISSIONS_FILE = path.join(MISSIONS_DIR, 'missions.json');
const GAIA_CONVS_FILE = path.join(MISSIONS_DIR, 'gaia_conversations.json');

let missionsStore  = {};
let gaiaConvsStore = {};

function loadMissions() {
  try {
    if (fs.existsSync(MISSIONS_FILE)) {
      missionsStore = JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8'));
      console.log(`[Missions] Loaded ${Object.keys(missionsStore).length} missions from disk`);
    }
  } catch (err) {
    console.error('[Missions] Failed to load:', err.message);
  }
}

function saveMissions() {
  try {
    fs.mkdirSync(MISSIONS_DIR, { recursive: true });
    fs.writeFileSync(MISSIONS_FILE, JSON.stringify(missionsStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[Missions] Failed to save:', err.message);
  }
}

function loadGaiaConvs() {
  try {
    if (fs.existsSync(GAIA_CONVS_FILE)) {
      gaiaConvsStore = JSON.parse(fs.readFileSync(GAIA_CONVS_FILE, 'utf8'));
      console.log(`[GaiaConvs] Loaded ${Object.keys(gaiaConvsStore).length} conversations from disk`);
    }
  } catch (err) {
    console.error('[GaiaConvs] Failed to load:', err.message);
  }
}

function saveGaiaConvs() {
  try {
    fs.mkdirSync(MISSIONS_DIR, { recursive: true });
    fs.writeFileSync(GAIA_CONVS_FILE, JSON.stringify(gaiaConvsStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[GaiaConvs] Failed to save:', err.message);
  }
}

loadMissions();
loadGaiaConvs();

const app = express();
app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Mission history ───────────────────────────────────────────────────────────
app.get('/missions', (_req, res) => {
  res.json(Object.values(missionsStore));
});

app.post('/missions/:id', (req, res) => {
  const { id } = req.params;
  missionsStore[id] = { ...req.body, id };
  saveMissions();
  res.json({ ok: true });
});

// ── Mission delete ────────────────────────────────────────────────────────────
app.delete('/missions/:id', (req, res) => {
  const { id } = req.params;
  if (missionsStore[id]) {
    delete missionsStore[id];
    saveMissions();
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'not found' });
  }
});

// ── Mission cancel ────────────────────────────────────────────────────────────
app.post('/missions/:id/cancel', (req, res) => {
  const { id } = req.params;
  const result = cancelMission(id);
  if (result.ok) {
    // Mark cancelled in persistent store too
    if (missionsStore[id]) {
      missionsStore[id] = { ...missionsStore[id], status: 'cancelled' };
      saveMissions();
    }
    res.json(result);
  } else {
    res.status(404).json(result);
  }
});

// ── Queue state ───────────────────────────────────────────────────────────────
app.get('/queue', (_req, res) => {
  res.json(getQueue());
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'olympus-framework', ts: Date.now() });
});

// ── B3C Request entry point ───────────────────────────────────────────────────
app.post('/request', (req, res) => {
  const { text, channel, target = 'zeus', userId, isWarRoom, priority, messages } = req.body ?? {};

  if (!text || !channel) {
    return res.status(400).json({ error: 'text and channel are required' });
  }

  const id = `req_${Date.now()}`;
  console.log(`[Router] id=${id} target=${target} channel=${channel}${priority ? ' PRIORITY' : ''}`);

  res.json({ ok: true, id });

  // Broadcast request_start immediately so dashboard shows mission
  broadcast({
    type:    'request_start',
    id, text, channel, target,
    ...(userId    ? { userId }        : {}),
    ...(isWarRoom ? { isWarRoom: true } : {}),
    ...(priority  ? { priority: true }  : {}),
  });

  // Enqueue (handles classification, concurrency, priority, process tracking)
  enqueue({ id, text, channel, target, userId, isWarRoom, priority, messages }).catch(err => {
    console.error(`[Router] enqueue failed for ${id}:`, err.message);
  });
});

// ── Gaia conversations persistence ────────────────────────────────────────────
app.get('/gaia/conversations', (_req, res) => {
  res.json(Object.values(gaiaConvsStore));
});

app.post('/gaia/conversations/:id', (req, res) => {
  const { id } = req.params;
  gaiaConvsStore[id] = { ...req.body, id };
  saveGaiaConvs();
  res.json({ ok: true });
});

// ── Gaia council log — recent council conversations ───────────────────────────
app.get('/gaia/council', (_req, res) => {
  const logFile = path.join(os.homedir(), 'olympus', 'gaia', 'council-log.json');
  try {
    if (fs.existsSync(logFile)) {
      const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      res.json(log.slice(-20)); // last 20 conversations
    } else {
      res.json([]);
    }
  } catch { res.json([]); }
});

// ── Gaia retrospectives — persisted nightly retrospective texts ───────────────
app.get('/gaia/retrospectives', (_req, res) => {
  const retrosFile = path.join(os.homedir(), 'olympus', 'gaia', 'retrospectives.json');
  try {
    if (fs.existsSync(retrosFile)) {
      const retros = JSON.parse(fs.readFileSync(retrosFile, 'utf8'));
      res.json(retros.slice(-10)); // last 10
    } else {
      res.json([]);
    }
  } catch { res.json([]); }
});

// ── Gaia observer mesh — receive full mission transcript ──────────────────────
app.post('/gaia/observe', (req, res) => {
  const observation = req.body;
  if (!observation || !observation.id) {
    return res.status(400).json({ error: 'observation with id required' });
  }
  observeMission(observation);
  res.json({ ok: true });
});

// ── Gaia council — initiate B3C council communication ─────────────────────────
app.post('/gaia/council', (req, res) => {
  const { message } = req.body ?? {};
  if (!message) return res.status(400).json({ error: 'message required' });
  const id = `gaia_directive_${Date.now()}`;
  res.json({ ok: true, id });
  // Run async — thread arrives via gaia_directive WS events
  gaiaInitiateCouncil(message).catch(err =>
    console.error('[Gaia Council] Failed:', err.message)
  );
});

// ── Gaia SSH control — execute command on a B3C node ─────────────────────────
app.post('/gaia/ssh-control', async (req, res) => {
  const { node, command, reason } = req.body ?? {};
  if (!node || !command || !reason) {
    return res.status(400).json({ error: 'node, command, and reason are required' });
  }
  try {
    const result = await executeSSHControl(node, command, reason);
    res.json({ ok: result.ok, result: result.result, node, command });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ── Gaia message ingest (from Gaia's OpenClaw webhook) ───────────────────────
app.post('/gaia/message', (req, res) => {
  const { text, response, userId, channel } = req.body ?? {};
  if (!text || !response) {
    return res.status(400).json({ error: 'text and response are required' });
  }
  console.log(`[Gaia] message from userId=${userId} channel=${channel}`);
  broadcast({
    type:      'gaia_message',
    text,
    response,
    userId:    userId ?? null,
    channel:   channel ?? 'gaia',
    timestamp: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// ── Health proxy (CORS-safe) ──────────────────────────────────────────────────
app.get('/proxy/health', async (req, res) => {
  const { target } = req.query;
  if (!target) return res.status(400).json({ error: 'target required' });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(target, { signal: controller.signal });
    clearTimeout(timer);
    if (r.ok) {
      res.json({ ok: true, status: r.status });
    } else {
      res.status(r.status).json({ ok: false, status: r.status });
    }
  } catch {
    res.status(503).json({ error: 'unreachable' });
  }
});

// ── Gaia OpenClaw poller ──────────────────────────────────────────────────────
const GAIA_WS_URL   = 'ws://100.74.201.75:18789';
const GAIA_TOKEN    = process.env.GAIA_OPENCLAW_TOKEN;
const POLL_INTERVAL = 30_000;

let gaiaLastSeenTs = 0;

function gaiaFetchHistory() {
  if (!GAIA_TOKEN) return;

  const ws = new WebSocket(GAIA_WS_URL, {
    headers: { Origin: 'http://localhost:18789' },
  });

  let connectId  = null;
  let historyId  = null;
  let reqCounter = 0;
  const nextId   = () => `gaia-poll-${++reqCounter}`;

  function send(obj) { ws.send(JSON.stringify(obj)); }

  const cleanup = (label) => {
    try { ws.terminate(); } catch {}
    if (label) console.log(`[Gaia Poll] ${label}`);
  };

  const timer = setTimeout(() => cleanup('timeout'), 15_000);

  ws.on('open', () => {});

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      connectId = nextId();
      send({
        type: 'req', id: connectId, method: 'connect',
        params: {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'openclaw-probe', version: '1.0', platform: 'node', mode: 'webchat', instanceId: 'olympus-poller' },
          role: 'operator', scopes: ['operator.admin'], caps: [],
          auth: { token: GAIA_TOKEN },
        },
      });
      return;
    }

    if (msg.type === 'res' && msg.id === connectId) {
      if (!msg.ok) {
        console.error('[Gaia Poll] connect failed:', msg.error?.message);
        clearTimeout(timer); cleanup(null); return;
      }
      historyId = nextId();
      send({ type: 'req', id: historyId, method: 'chat.history', params: { sessionKey: 'main', limit: 100 } });
      return;
    }

    if (msg.type === 'res' && msg.id === historyId) {
      clearTimeout(timer);
      cleanup(null);

      if (!msg.ok) {
        console.error('[Gaia Poll] chat.history failed:', msg.error?.message);
        return;
      }

      const messages = msg.payload?.messages ?? [];
      if (!messages.length) return;

      let maxTs = gaiaLastSeenTs;
      for (let i = 0; i < messages.length - 1; i++) {
        const m = messages[i];
        const next = messages[i + 1];
        if (m.role !== 'user' || next.role !== 'assistant') continue;

        const ts = m.createdAt ?? m.ts ?? m.timestamp ?? 0;
        const msTs = typeof ts === 'string' ? new Date(ts).getTime() : ts;
        if (msTs <= gaiaLastSeenTs) continue;

        const userText = typeof m.content === 'string' ? m.content
          : m.content?.map?.(c => c.text ?? '').join('') ?? '';
        const assistantText = typeof next.content === 'string' ? next.content
          : next.content?.map?.(c => c.text ?? '').join('') ?? '';

        if (userText && assistantText) {
          broadcast({
            type:      'gaia_message',
            text:      userText,
            response:  assistantText,
            userId:    null,
            channel:   'Gaia · OpenClaw',
            timestamp: typeof ts === 'string' ? ts : new Date(msTs).toISOString(),
          });
          console.log(`[Gaia Poll] New conversation broadcast (${userText.slice(0, 40)}…)`);
        }

        if (msTs > maxTs) maxTs = msTs;
      }

      if (maxTs > gaiaLastSeenTs) gaiaLastSeenTs = maxTs;
    }
  });

  ws.on('error', (err) => {
    clearTimeout(timer);
    console.error('[Gaia Poll] WS error:', err.message);
    try { ws.terminate(); } catch {}
  });

  ws.on('close', () => clearTimeout(timer));
}

function initGaiaPoller() {
  if (!GAIA_TOKEN) {
    console.log('[Gaia Poll] GAIA_OPENCLAW_TOKEN not set — Gaia polling disabled');
    return;
  }
  console.log('[Gaia Poll] Starting — polling Gaia every 30 s');
  gaiaFetchHistory();
  setInterval(gaiaFetchHistory, POLL_INTERVAL);
}

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
const server = http.createServer(app);
initWS(server);

server.listen(PORT, () => {
  console.log(`[Olympus] HTTP server listening on http://0.0.0.0:${PORT}`);
  console.log(`[Olympus] WebSocket ready at ws://0.0.0.0:${PORT}/live`);
  initTelegram();
  initGaiaPoller();
  initGaia();
});
