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
 * Phase 2: Per-type message routing, parallel broadcast, presence heartbeat.
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
  zeus:     { ip: '10.0.1.1', port: 18800 },
  poseidon: { ip: '10.0.1.2', port: 18800 },
  hades:    { ip: '10.0.2.2', port: 18800 },
  gaia:     { ip: '10.0.3.2', port: 18800 },
};

const PEER_PORT = 18800;
const MY_IP = PEERS[NODE_ID].ip;

// ── State ─────────────────────────────────────────────────────────────────────
const peerConnections = {};  // { nodeId: WebSocket } — outbound client connections
const inboundConnections = {}; // { nodeId: WebSocket } — inbound server connections (fallback)
const peerStatus = {};       // { nodeId: 'connected' | 'disconnected' | 'connecting' }
const messageHandlers = [];  // registered handler functions
const presenceMap = {};      // { nodeId: { status, load, lastSeen } }

// Initialize status
for (const id of Object.keys(PEERS)) {
  if (id !== NODE_ID) {
    peerStatus[id] = 'disconnected';
    presenceMap[id] = { status: 'unknown', load: null, lastSeen: null };
  }
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

// ── Quorum IP map (all 12 members, LAN addresses) ────────────────────────────
const QUORUM_IPS = {
  hermes: '192.168.1.102', athena: '192.168.1.189',
  apollo: '192.168.1.170', hestia: '192.168.1.105',
  aphrodite: '192.168.1.123', iris: '192.168.1.117',
  demeter: '192.168.1.113', prometheus: '192.168.1.131',
  hephaestus: '192.168.1.156', nike: '192.168.1.165',
  artemis: '192.168.1.152', ares: '192.168.1.182',
};
const QUORUM_TOKEN = 'b67accb237fdc708bc216bcf283ae3948ed84c3b5d9fc673';
const QUORUM_PORT = 18789;

// Which quorum members belong to which council head
const QUORUM_OWNERSHIP = {
  zeus: ['hermes', 'athena', 'apollo', 'hestia'],
  poseidon: ['aphrodite', 'iris', 'demeter', 'prometheus'],
  hades: ['hephaestus', 'nike', 'artemis', 'ares'],
};

// ── NAS log path for intel messages ───────────────────────────────────────────
const INTEL_LOG_DIR = '/Volumes/olympus/shared/council-log';

function logIntelToNAS(msg) {
  try {
    if (!fs.existsSync(INTEL_LOG_DIR)) fs.mkdirSync(INTEL_LOG_DIR, { recursive: true });
    const filename = `intel-${msg.from}-${Date.now()}.json`;
    fs.writeFileSync(path.join(INTEL_LOG_DIR, filename), JSON.stringify(msg, null, 2));
  } catch (e) {
    err(`Failed to log intel to NAS: ${e.message}`);
  }
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

// ── Per-type message routing (Phase 2 Feature 1) ─────────────────────────────

async function processInboundMessage(msg) {
  // Never respond to ack or response types (prevents infinite loops)
  if (msg.type === 'ack' || msg.type === 'response') return;

  // Presence is handled inline in handleInbound — skip AI processing
  if (msg.type === 'presence') return;

  // Gaia is observer only — log everything, respond to nothing
  if (NODE_ID === 'gaia') {
    log(`[observer] ${msg.type} from ${msg.from}: ${(msg.body || '').slice(0, 120)}`);
    return;
  }

  // ── Type-specific routing ──

  // vote — lightweight, just log and ack, no AI
  if (msg.type === 'vote') {
    log(`[vote] from ${msg.from}: ${(msg.body || '').slice(0, 120)}`);
    forwardToGaia(msg, null);
    return;
  }

  // flag — surface to Telegram immediately, do not queue
  if (msg.type === 'flag') {
    log(`[FLAG] from ${msg.from}: ${msg.body}`);
    // TODO: Telegram integration — for now log prominently
    console.warn(`🚩 FLAG from ${msg.from}: ${msg.body}`);
    forwardToGaia(msg, null);
    return;
  }

  // alert — surface to Telegram with priority
  if (msg.type === 'alert') {
    log(`[ALERT] from ${msg.from}: ${msg.body}`);
    console.warn(`🚨 ALERT from ${msg.from}: ${msg.body}`);
    forwardToGaia(msg, null);
    return;
  }

  // intel — log to NAS, do not invoke AI
  if (msg.type === 'intel') {
    log(`[intel] from ${msg.from} — logging to NAS`);
    logIntelToNAS(msg);
    return;
  }

  // broadcast — log and ack, no AI
  if (msg.type === 'broadcast') {
    log(`[broadcast] from ${msg.from}: ${(msg.body || '').slice(0, 120)}`);
    forwardToGaia(msg, null);
    return;
  }

  // Health check — fast JSON response, no LLM
  if (msg.type === 'health') {
    const status = {
      status: 'healthy',
      node: NODE_ID,
      uptime: process.uptime(),
      peers: { ...peerStatus },
      presence: { ...presenceMap },
      ai_bridge: LOCAL_OPENCLAW_TOKEN ? 'armed' : 'no_token',
      timestamp: new Date().toISOString(),
    };
    sendMessage(msg.from, 'response', JSON.stringify(status), msg.id);
    forwardToGaia(msg, JSON.stringify(status));
    return;
  }

  // ── task.dispatch — Route task to quorum member via their gateway ─────────
  if (msg.type === 'task.dispatch') {
    let payload;
    try {
      payload = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
    } catch (e) {
      sendMessage(msg.from, 'task.error', JSON.stringify({
        error: 'Invalid task.dispatch payload', detail: e.message
      }), msg.id);
      return;
    }

    const { task_id, target_agent, spec, domain_fit, contribution_type,
            council_head, timeout_seconds, require_evidence, project } = payload;

    // Validate target agent exists
    const agentIp = QUORUM_IPS[target_agent];
    if (!agentIp) {
      sendMessage(msg.from, 'task.error', JSON.stringify({
        task_id, error: `Unknown agent: ${target_agent}`
      }), msg.id);
      return;
    }

    // Check if target is in our quorum (if not, forward to correct council node)
    const ownerNode = Object.entries(QUORUM_OWNERSHIP)
      .find(([_, members]) => members.includes(target_agent))?.[0];

    if (ownerNode && ownerNode !== NODE_ID) {
      // Forward to the correct council node
      log(`[task.dispatch] ${target_agent} belongs to ${ownerNode}, forwarding`);
      sendMessage(ownerNode, 'task.dispatch', typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body), msg.id);
      sendMessage(msg.from, 'task.ack', JSON.stringify({
        task_id, target_agent, status: 'forwarded', forwarded_to: ownerNode
      }), msg.id);
      return;
    }

    // Immediate ACK — tell sender we're processing
    log(`[task.dispatch] Dispatching ${task_id} to ${target_agent} (${agentIp})`);
    const fitSummaryAck = (domain_fit || '').split(/[.!?]/)[0].split(/\s+/).slice(0, 20).join(' ');
    sendMessage(msg.from, 'task.ack', JSON.stringify({
      task_id, target_agent, project: project || null,
      domain_fit_summary: fitSummaryAck,
      council_head: council_head || msg.from,
      status: 'dispatching'
    }), msg.id);

    // Build the system prompt with task context
    const systemPrompt = [
      `You are ${target_agent}. You have received a task from your council head ${council_head || msg.from}.`,
      `Project: ${project || 'unspecified'}`,
      domain_fit ? `Why you: ${domain_fit}` : '',
      `Task type: ${contribution_type || 'production'}`,
      require_evidence
        ? 'IMPORTANT: Your response MUST include: (1) what you produced, and (2) one observation from your domain perspective that the spec did not ask for.'
        : '',
    ].filter(Boolean).join('\n');

    // Dispatch to quorum member's OpenClaw gateway (with retry-on-529)
    async function dispatchToQuorum(retryCount = 0) {
      const controller = new AbortController();
      const timeoutMs = (timeout_seconds || 120) * 1000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`http://${agentIp}:${QUORUM_PORT}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${QUORUM_TOKEN}`,
            'x-openclaw-scopes':       'operator.write',
            'x-openclaw-session-key': `quorum-${target_agent}-dispatch`,
          },
          body: JSON.stringify({
            model: 'openclaw',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: spec },
            ],
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Retry once on provider overload (529)
        if (response.status === 529 && retryCount < 1) {
          log(`[task.dispatch] Provider overloaded (529), retrying ${target_agent} in 10s...`);
          await new Promise(r => setTimeout(r, 10000));
          return dispatchToQuorum(retryCount + 1);
        }

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Gateway HTTP ${response.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';

        // Generate domain_fit_summary (first sentence, max 20 words)
        const fitSummary = (domain_fit || '').split(/[.!?]/)[0].split(/\s+/).slice(0, 20).join(' ');
        
        // Generate preview (first 150 chars of response, markdown stripped)
        const preview = (reply || '').replace(/[#*_`~\[\]]/g, '').slice(0, 150).trim();

        log(`[task.dispatch] ✓ ${target_agent} responded (${reply.length} chars)${retryCount > 0 ? ' [after retry]' : ''}`);

        sendMessage(msg.from, 'task.result', JSON.stringify({
          task_id,
          target_agent,
          project: project || null,
          response: reply,
          domain_fit_summary: fitSummary,
          preview,
          status: reply ? 'completed' : 'empty',
          retried: retryCount > 0,
          timestamp: new Date().toISOString(),
        }), msg.id);

        forwardToGaia(msg, reply);

      } catch (e) {
        clearTimeout(timer);
        const isTimeout = e.name === 'AbortError';
        log(`[task.dispatch] ✗ ${target_agent} failed: ${e.message}${retryCount > 0 ? ' [after retry]' : ''}`);

        sendMessage(msg.from, 'task.error', JSON.stringify({
          task_id,
          target_agent,
          error: isTimeout ? `Timeout after ${timeout_seconds || 120}s` : e.message,
          timeout: isTimeout,
          retried: retryCount > 0,
          timestamp: new Date().toISOString(),
        }), msg.id);

        forwardToGaia(msg, null);
      }
    }

    await dispatchToQuorum();

    return;
  }

  // ── task.result — Auto-write completion evidence to task.json on NAS ──────
  if (msg.type === 'task.result') {
    try {
      const result = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
      const { task_id, target_agent, project, response, status: resultStatus } = result;

      if (task_id && project) {
        const NAS_PROJECTS = '/Volumes/olympus/shared/projects';
        const statusDirs = ['active', 'review', 'completed', 'blocked'];
        let taskFile = null;

        for (const dir of statusDirs) {
          const candidate = path.join(NAS_PROJECTS, project, 'tasks', dir, `${task_id}.json`);
          if (fs.existsSync(candidate)) {
            taskFile = candidate;
            break;
          }
        }

        if (taskFile) {
          const task = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
          task.completion = task.completion || {};
          task.completion.completed_at = new Date().toISOString();
          task.completion.completed_by = target_agent || msg.from;
          task.completion.evidence = response || null;
          task.status = 'pending_acceptance';
          task.updated = new Date().toISOString();
          fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));

          // Move to review directory if currently in active
          if (taskFile.includes('/active/')) {
            const reviewDir = path.join(NAS_PROJECTS, project, 'tasks', 'review');
            if (!fs.existsSync(reviewDir)) fs.mkdirSync(reviewDir, { recursive: true });
            const newPath = path.join(reviewDir, `${task_id}.json`);
            fs.renameSync(taskFile, newPath);
            log(`[task.result] Moved ${task_id} to review/`);
          }

          log(`[task.result] Auto-wrote completion evidence for ${task_id} from ${target_agent}`);
        } else {
          log(`[task.result] WARNING: Could not find task file for ${task_id} in project ${project}`);
        }
      }
    } catch (e) {
      err(`[task.result] Failed to write completion evidence: ${e.message}`);
    }
    forwardToGaia(msg, null);
    return;
  }

  // ── task.ack / task.error — Log but do not invoke AI ──────────────────────
  if (msg.type === 'task.ack' || msg.type === 'task.error') {
    log(`[${msg.type}] ${(msg.body || '').slice(0, 120)}`);
    forwardToGaia(msg, null);
    return;
  }


  // ── Full AI bridge for: deliberation_request, coordination, artifact, etc. ──

  if (!LOCAL_OPENCLAW_TOKEN) {
    log(`Cannot process ${msg.type} — no OpenClaw token`);
    forwardToGaia(msg, null);
    return;
  }

  try {
    const response = await fetch(`http://${MY_IP}:18789/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCAL_OPENCLAW_TOKEN}`,
        'x-openclaw-scopes':       'operator.write',
        'x-openclaw-session-key': PEER_SESSION_KEY,
      },
      body: JSON.stringify({
        model: 'openclaw',
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

  // Presence heartbeat — update presenceMap silently, no ack, no log spam
  if (type === 'presence') {
    try {
      const data = typeof body === 'string' ? JSON.parse(body) : body;
      presenceMap[from] = {
        status: data.status || 'active',
        load: data.load ?? null,
        lastSeen: new Date().toISOString(),
      };
    } catch (e) {
      presenceMap[from] = { status: 'active', load: null, lastSeen: new Date().toISOString() };
    }
    return; // No ack, no logging, no AI processing for presence
  }

  log(`← ${type} from ${from}: ${(body || '').slice(0, 80)}${body?.length > 80 ? '...' : ''}`);

  // Run registered handlers
  for (const handler of messageHandlers) {
    try { handler(msg); } catch (e) { err(`Handler error: ${e.message}`); }
  }

  // Auto-ack non-ack messages (skip broadcast — already lightweight)
  if (type !== 'ack' && type !== 'response' && type !== 'broadcast' && ws?.readyState === WebSocket.OPEN) {
    ws.send(buildMessage(from, 'ack', `Received ${type} id=${id}`));
  }

  // AI Bridge — process message intelligently per type
  processInboundMessage(msg).catch(e => err(`AI bridge error: ${e.message}`));
}

// ── Presence Heartbeat (Phase 2 Feature 3) ────────────────────────────────────

let presenceInterval = null;

function getCpuLoad() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalTick += cpu.times[type];
    totalIdle += cpu.times.idle;
  }
  return +(1 - totalIdle / totalTick).toFixed(2);
}

function startPresenceHeartbeat() {
  presenceInterval = setInterval(() => {
    const payload = JSON.stringify({
      status: 'active',
      load: getCpuLoad(),
      timestamp: new Date().toISOString(),
    });
    for (const peerId of Object.keys(PEERS)) {
      if (peerId !== NODE_ID) {
        sendMessage(peerId, 'presence', payload);
      }
    }
  }, 30000);

  // Mark peers as unknown if no presence received in 90 seconds
  setInterval(() => {
    const now = Date.now();
    for (const peerId of Object.keys(presenceMap)) {
      const entry = presenceMap[peerId];
      if (entry.lastSeen && (now - new Date(entry.lastSeen).getTime() > 90000)) {
        if (entry.status !== 'unknown') {
          presenceMap[peerId].status = 'unknown';
          log(`Presence timeout: ${peerId} marked as unknown`);
        }
      }
    }
  }, 15000);
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
    // Don't spam errors for presence pings to disconnected peers
    if (type !== 'presence') {
      err(`Cannot send to ${to} — no route (outbound: ${peerStatus[to] || 'unknown'}, inbound: ${inboundConnections[to] ? 'stale' : 'none'})`);
    }
    return false;
  }
  const msg = buildMessage(to, type, body, sessionRef);
  conn.send(msg);
  // Don't log presence pings — too noisy
  if (type !== 'presence') {
    log(`→ ${type} to ${to} [${via}]: ${(body || '').slice(0, 80)}${body?.length > 80 ? '...' : ''}`);
  }
  return true;
}

// Phase 2 Feature 2 — True simultaneous broadcast with Promise.all
export async function broadcastMessage(type, body, sessionRef = null) {
  const peers = Object.keys(PEERS).filter(id => id !== NODE_ID);
  const results = await Promise.all(
    peers.map(peerId => {
      return new Promise((resolve) => {
        const sent = sendMessage(peerId, type, body, sessionRef);
        resolve({ peerId, sent });
      });
    })
  );
  const sent = results.filter(r => r.sent).length;
  log(`Broadcast ${type} to ${sent}/${peers.length} peers (parallel)`);
  return { sent, total: peers.length, results };
}

export function getPeerStatus() {
  return {
    node: NODE_ID,
    ip:   MY_IP,
    port: PEER_PORT,
    peers: { ...peerStatus },
    presence: { ...presenceMap },
    ai_bridge: LOCAL_OPENCLAW_TOKEN ? 'armed' : 'no_token',
    timestamp: new Date().toISOString(),
  };
}

export function getPresence(peerId) {
  if (peerId === NODE_ID) {
    return { status: 'self', load: getCpuLoad(), lastSeen: new Date().toISOString() };
  }
  return presenceMap[peerId] || { status: 'unknown', load: null, lastSeen: null };
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
  // Start presence heartbeat after connections are established
  setTimeout(startPresenceHeartbeat, 5000);
}

// ── Auto-start when run standalone or under PM2 ──────────────────────────────
// ESM: use import.meta.url. PM2 wraps argv[1], so also check PM2_HOME.
const isMain = process.argv[1]?.endsWith('council-peer.js') ||
               import.meta.url.endsWith('council-peer.js') ||
               !!process.env.PM2_HOME;
if (isMain) {
  // Process guard — kill stale instances before starting
  const { execSync } = await import('child_process');
  try {
    const stale = execSync(`pgrep -f "node.*council-peer.js" 2>/dev/null || true`, { encoding: 'utf-8' })
      .trim().split('\n').filter(pid => pid && parseInt(pid) !== process.pid);
    if (stale.length > 0) {
      log(`Killing ${stale.length} stale council-peer process(es): ${stale.join(', ')}`);
      stale.forEach(pid => { try { process.kill(parseInt(pid)); } catch {} });
    }
  } catch {}

  log('Running standalone');
  initPeerLayer();
}
