/**
 * council-peer.js — B3C WebSocket Peer-to-Peer Messaging Layer + AI Bridge
 *
 * Runs on all 4 nodes over Thunderbolt Bridge (port 18800).
 * Every node runs a WS server AND connects as client to all peers.
 * Any node can initiate messages to any other node at any time.
 *
 * AI Bridge: When a node receives a peer message, it passes it to its own
 * OpenClaw session and routes the reply back to the sender. Gaia logs all
 * traffic but does not respond intelligently.
 *
 * Auto-detects NODE_ID from hostname.
 * Can run standalone (Poseidon/Hades/Gaia) or imported by server.js (Zeus).
 */

import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ── Node identity (auto-detect from hostname) ─────────────────────────────────
const HOSTNAME = os.hostname().toLowerCase();

function detectNodeId() {
  if (HOSTNAME.includes('zeus'))     return 'zeus';
  if (HOSTNAME.includes('poseidon')) return 'poseidon';
  if (HOSTNAME.includes('hades'))    return 'hades';
  if (HOSTNAME.includes('gaia'))     return 'gaia';
  throw new Error(`[council-peer] Cannot detect node from hostname: ${HOSTNAME}`);
}

const NODE_ID = detectNodeId();

// ── TB Bridge IP map ──────────────────────────────────────────────────────────
const PEERS = {
  zeus:     { ip: '10.0.0.1', port: 18800 },
  poseidon: { ip: '10.0.0.2', port: 18800 },
  hades:    { ip: '10.0.0.3', port: 18800 },
  gaia:     { ip: '10.0.0.4', port: 18800 },
};

const PEER_PORT = 18800;
const MY_IP = PEERS[NODE_ID].ip;

// ── State ─────────────────────────────────────────────────────────────────────
const peerConnections = {};  // { nodeId: WebSocket } — outbound client connections
const inboundConnections = {}; // { nodeId: WebSocket } — inbound server connections (fallback)
const peerStatus = {};       // { nodeId: 'connected' | 'disconnected' | 'connecting' }
const messageHandlers = [];  // registered handler functions

// Initialize status
for (const id of Object.keys(PEERS)) {
  if (id !== NODE_ID) peerStatus[id] = 'disconnected';
}

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`[council-peer:${NODE_ID}] ${msg}`); }
function err(msg)  { console.error(`[council-peer:${NODE_ID}] ${msg}`); }

// ── AI Bridge — Configuration ─────────────────────────────────────────────────
const NODE_DOMAINS = {
  zeus:     'Spiritual and Intellectual domain — facilitator and synthesizer',
  poseidon: 'Financial and Social domain',
  hades:    'Physical domain — infrastructure and systems',
  gaia:     'Observer and witness',
};

const PEER_SESSION_KEY = `peer-${NODE_ID}-mesh`;

// Load local OpenClaw token from ~/.openclaw/openclaw.json
let LOCAL_OPENCLAW_TOKEN = null;
try {
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  LOCAL_OPENCLAW_TOKEN = config?.gateway?.auth?.token || config?.auth?.token || config?.token || null;
  if (LOCAL_OPENCLAW_TOKEN) log(`OpenClaw token loaded`);
  else log('WARNING: No token found in openclaw.json');
} catch (e) {
  log(`WARNING: Could not load OpenClaw token: ${e.message}`);
}

// ── Message construction ──────────────────────────────────────────────────────
function buildMessage(to, type, body, sessionRef = null) {
  return JSON.stringify({
    id:          crypto.randomUUID(),
    from:        NODE_ID,
    to,
    type,
    body,
    session_ref: sessionRef,
    timestamp:   new Date().toISOString(),
  });
}

// ── AI Bridge — Intelligence Layer ────────────────────────────────────────────

function forwardToGaia(originalMsg, reply) {
  if (NODE_ID === 'gaia') return;
  sendMessage('gaia', 'intel', JSON.stringify({
    original: originalMsg,
    reply_sent: reply,
    forwarded_by: NODE_ID,
    timestamp: new Date().toISOString(),
  }), originalMsg.session_ref);
}

async function processInboundMessage(msg) {
  // Never respond to ack or response types (prevents infinite loops)
  if (msg.type === 'ack' || msg.type === 'response') return;

  // Gaia is observer only — log everything, respond to nothing
  if (NODE_ID === 'gaia') {
    log(`[observer] ${msg.type} from ${msg.from}: ${(msg.body || '').slice(0, 120)}`);
    return;
  }

  // Intel type is for Gaia forwarding — don't process on non-Gaia nodes
  if (msg.type === 'intel') return;

  // Health check — fast JSON response, no LLM
  if (msg.type === 'health') {
    const status = {
      status: 'healthy',
      node: NODE_ID,
      uptime: process.uptime(),
      peers: { ...peerStatus },
      ai_bridge: LOCAL_OPENCLAW_TOKEN ? 'armed' : 'no_token',
      timestamp: new Date().toISOString(),
    };
    sendMessage(msg.from, 'response', JSON.stringify(status), msg.id);
    forwardToGaia(msg, JSON.stringify(status));
    return;
  }

  // LLM response for: coordination, deliberation, alert, artifact
  if (!LOCAL_OPENCLAW_TOKEN) {
    log(`Cannot process ${msg.type} — no OpenClaw token`);
    forwardToGaia(msg, null);
    return;
  }

  try {
    // System prompt removed — OpenClaw injects workspace files (SOUL.md, AGENTS.md, etc.)

    const response = await fetch(`http://${MY_IP}:18789/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCAL_OPENCLAW_TOKEN}`,
        'x-openclaw-session-key': PEER_SESSION_KEY,
      },
      body: JSON.stringify({
        model: 'main',
        messages: [
          { role: 'user', content: `[${msg.type} from ${msg.from} — peer coordination channel, respond directly and concisely] ${msg.body}` },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenClaw HTTP ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No response generated';

    log(`[AI] → ${msg.from}: ${reply.slice(0, 120)}${reply.length > 120 ? '...' : ''}`);
    sendMessage(msg.from, 'response', reply, msg.id);
    forwardToGaia(msg, reply);
  } catch (e) {
    err(`AI bridge error: ${e.message}`);
    forwardToGaia(msg, null);
  }
}

// ── WebSocket SERVER ──────────────────────────────────────────────────────────
let wss = null;

function startServer() {
  wss = new WebSocketServer({ host: MY_IP, port: PEER_PORT });

  wss.on('listening', () => {
    log(`Server listening on ${MY_IP}:${PEER_PORT}`);
  });

  wss.on('connection', (ws, req) => {
    const remoteIp = req.socket.remoteAddress;
    log(`Inbound connection from ${remoteIp}`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleInbound(msg, ws);
      } catch (e) {
        err(`Bad message from ${remoteIp}: ${e.message}`);
      }
    });

    ws.on('close', () => {
      log(`Inbound connection closed from ${remoteIp}`);
    });

    ws.on('error', (e) => {
      err(`Inbound error from ${remoteIp}: ${e.message}`);
    });
  });

  wss.on('error', (e) => {
    err(`Server error: ${e.message}`);
  });
}

// ── WebSocket CLIENT — connect to all peers ───────────────────────────────────
function connectToPeer(peerId) {
  if (peerId === NODE_ID) return;

  const peer = PEERS[peerId];
  const url = `ws://${peer.ip}:${peer.port}`;

  if (peerConnections[peerId]?.readyState === WebSocket.OPEN) return;

  peerStatus[peerId] = 'connecting';
  log(`Connecting to ${peerId} at ${url}`);

  const ws = new WebSocket(url);
  let retryDelay = 2000;

  ws.on('open', () => {
    log(`Connected to ${peerId}`);
    peerConnections[peerId] = ws;
    peerStatus[peerId] = 'connected';
    retryDelay = 2000;

    // Announce ourselves
    ws.send(buildMessage(peerId, 'ack', `${NODE_ID} peer connection established`));
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleInbound(msg, ws);
    } catch (e) {
      err(`Bad message from ${peerId}: ${e.message}`);
    }
  });

  ws.on('close', () => {
    log(`Disconnected from ${peerId}`);
    peerStatus[peerId] = 'disconnected';
    delete peerConnections[peerId];
    // Reconnect with backoff
    setTimeout(() => connectToPeer(peerId), Math.min(retryDelay, 30000));
    retryDelay = Math.min(retryDelay * 1.5, 30000);
  });

  ws.on('error', (e) => {
    // Suppress connection refused during startup — close handler will retry
    if (!e.message.includes('ECONNREFUSED')) {
      err(`Client error (${peerId}): ${e.message}`);
    }
  });
}

function connectToAllPeers() {
  for (const peerId of Object.keys(PEERS)) {
    if (peerId !== NODE_ID) {
      connectToPeer(peerId);
    }
  }
}

// ── Inbound message handler ───────────────────────────────────────────────────
function handleInbound(msg, ws) {
  const { id, from, to, type, body, session_ref, timestamp } = msg;

  // Only process messages addressed to us or broadcast
  if (to !== NODE_ID && to !== 'all') return;

  // Track inbound WS as fallback route to this peer (critical for nodes
  // that can't make outbound TB connections, e.g. Poseidon)
  if (from && ws?.readyState === WebSocket.OPEN) {
    inboundConnections[from] = ws;
  }

  log(`← ${type} from ${from}: ${(body || '').slice(0, 80)}${body?.length > 80 ? '...' : ''}`);

  // Run registered handlers
  for (const handler of messageHandlers) {
    try { handler(msg); } catch (e) { err(`Handler error: ${e.message}`); }
  }

  // Auto-ack non-ack messages
  if (type !== 'ack' && type !== 'response' && ws?.readyState === WebSocket.OPEN) {
    ws.send(buildMessage(from, 'ack', `Received ${type} id=${id}`));
  }

  // AI Bridge — process message intelligently
  processInboundMessage(msg).catch(e => err(`AI bridge error: ${e.message}`));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function sendMessage(to, type, body, sessionRef = null) {
  // Prefer outbound client connection, fall back to inbound server connection
  let conn = peerConnections[to];
  let via = 'outbound';
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    conn = inboundConnections[to];
    via = 'inbound';
  }
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    err(`Cannot send to ${to} — no route (outbound: ${peerStatus[to] || 'unknown'}, inbound: ${inboundConnections[to] ? 'stale' : 'none'})`);
    return false;
  }
  const msg = buildMessage(to, type, body, sessionRef);
  conn.send(msg);
  log(`→ ${type} to ${to} [${via}]: ${(body || '').slice(0, 80)}${body?.length > 80 ? '...' : ''}`);
  return true;
}

export function broadcastMessage(type, body, sessionRef = null) {
  let sent = 0;
  for (const peerId of Object.keys(PEERS)) {
    if (peerId !== NODE_ID) {
      if (sendMessage(peerId, type, body, sessionRef)) sent++;
    }
  }
  log(`Broadcast ${type} to ${sent}/${Object.keys(PEERS).length - 1} peers`);
  return sent;
}

export function getPeerStatus() {
  return {
    node: NODE_ID,
    ip:   MY_IP,
    port: PEER_PORT,
    peers: { ...peerStatus },
    ai_bridge: LOCAL_OPENCLAW_TOKEN ? 'armed' : 'no_token',
    timestamp: new Date().toISOString(),
  };
}

export function onMessage(handler) {
  messageHandlers.push(handler);
}

// ── Initialize ────────────────────────────────────────────────────────────────
export function initPeerLayer() {
  log(`Initializing — node=${NODE_ID} ip=${MY_IP} ai_bridge=${LOCAL_OPENCLAW_TOKEN ? 'armed' : 'no_token'}`);
  startServer();
  // Delay client connections slightly to let servers start
  setTimeout(connectToAllPeers, 3000);
}

// ── Auto-start when run standalone ────────────────────────────────────────────
// Detect if this is the main module (ESM)
const isMain = process.argv[1]?.endsWith('council-peer.js');
if (isMain) {
  log('Running standalone');
  initPeerLayer();
}
