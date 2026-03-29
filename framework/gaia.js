/**
 * gaia.js — Gaia's Standalone System
 *
 * Gaia is the Memory and Retrospective intelligence of Mount Olympus.
 * She operates on her own schedule, observes the council, and issues growth directives.
 *
 * Capabilities:
 *   1. Observer mesh  — receives full mission transcripts, stores in daily observation files
 *   2. Nightly retrospective (23:00) — reads today's observations, broadcasts gaia_retrospective
 *   3. B3C communication channel — Gaia initiates council via gaiaInitiateCouncil()
 *   4. Growth directives — targeted per-agent directives, broadcasts gaia_growth
 *   5. SSH Control — executeSSHControl() SSHes from Zeus machine to B3C nodes
 */

import cron       from 'node-cron';
import fs         from 'fs';
import path       from 'path';
import os         from 'os';
import { broadcast } from './olympus-ws.js';
import { sendToGrowthGrid } from './telegram.js';
import { callZeus, callPoseidon, callHades, callGaia } from './agentCalls.js';

export { callGaia };

// ── File paths ─────────────────────────────────────────────────────────────────
const MISSIONS_FILE      = path.join(os.homedir(), 'olympus', 'data', 'missions.json');
const OBSERVATIONS_DIR   = path.join(os.homedir(), 'olympus', 'gaia', 'observations');
const COUNCIL_LOG_FILE   = path.join(os.homedir(), 'olympus', 'gaia', 'council-log.json');
const RETROSPECTIVES_FILE = path.join(os.homedir(), 'olympus', 'gaia', 'retrospectives.json');
const SSH_CONTROL_LOG    = path.join(os.homedir(), 'olympus', 'gaia', 'ssh-control.log');

// ── SSH node map — LAN IPs (primary, ~0.4ms) ───────────────────────────────────
const SSH_NODE_IPS = {
  zeus:     '10.0.1.1',
  poseidon: '10.0.1.2',
  hades:    '10.0.2.2',
};

// ── Observer mesh — append mission transcript to daily observation file ────────
export function observeMission(observation) {
  const today    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = path.join(OBSERVATIONS_DIR, `${today}.json`);
  try {
    fs.mkdirSync(OBSERVATIONS_DIR, { recursive: true });
    let arr = [];
    if (fs.existsSync(filePath)) {
      try { arr = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
    }
    arr.push(observation);
    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
    console.log(`[Gaia] Observation written for mission ${observation.id}`);
  } catch (err) {
    console.error('[Gaia] Failed to write observation:', err.message);
  }
}

// ── Nightly Retrospective ─────────────────────────────────────────────────────
async function runNightlyRetrospective() {
  console.log('[Gaia] Starting nightly retrospective...');

  // Read today's rich observation file
  const today   = new Date().toISOString().slice(0, 10);
  const obsPath = path.join(OBSERVATIONS_DIR, `${today}.json`);
  let observations = [];
  try {
    if (fs.existsSync(obsPath)) {
      observations = JSON.parse(fs.readFileSync(obsPath, 'utf8'));
    }
  } catch (err) {
    console.error('[Gaia] Failed to read observations:', err.message);
  }

  let observationSummary;

  if (observations.length > 0) {
    // Rich transcript-based summary
    observationSummary = observations.map((obs, i) => {
      const lines = [
        `${i + 1}. [${obs.tier ?? 'DIRECT'}] Channel: ${obs.channel ?? '?'} — ${((obs.elapsed || 0) / 1000).toFixed(1)}s`,
        `   REQUEST: ${(obs.request ?? '').slice(0, 200)}`,
      ];
      if (obs.councilInitial?.length) {
        lines.push(`   INITIAL COUNCIL (${obs.councilInitial.length} exchanges): ${obs.councilInitial.map(m => m.speaker?.toUpperCase()).join(' → ')}`);
        const sample = obs.councilInitial.slice(0, 2).map(m => `     ${m.speaker.toUpperCase()}: ${m.text.slice(0, 120)}`).join('\n');
        lines.push(sample);
      }
      if (obs.councilBackend?.length) {
        lines.push(`   BACKEND COUNCIL (${obs.councilBackend.length} exchanges)`);
      }
      if (obs.deliverables) {
        const delivered = Object.entries(obs.deliverables).filter(([, v]) => v).map(([k]) => k).join(', ');
        if (delivered) lines.push(`   DELIVERABLES: ${delivered}`);
      }
      if (obs.failures?.length) {
        lines.push(`   FAILURES: ${obs.failures.join(', ')}`);
      }
      if (obs.output) {
        lines.push(`   OUTPUT: ${obs.output.slice(0, 300)}${obs.output.length > 300 ? '…' : ''}`);
      }
      return lines.join('\n');
    }).join('\n\n');
  } else {
    // Fallback to missions.json summary
    let allMissions = [];
    try {
      if (fs.existsSync(MISSIONS_FILE)) {
        const store = JSON.parse(fs.readFileSync(MISSIONS_FILE, 'utf8'));
        allMissions = Object.values(store);
      }
    } catch (err) {
      console.error('[Gaia] Failed to read missions:', err.message);
    }
    const dayStart      = Date.now() - 24 * 60 * 60 * 1000;
    const todayMissions = allMissions.filter(m => m.timestamp >= dayStart);
    observationSummary  = todayMissions.length === 0
      ? 'No missions were completed today.'
      : todayMissions.map((m, i) =>
          `${i + 1}. [${m.tier ?? 'DIRECT'}] ${(m.text ?? '').slice(0, 100)} — Channel: ${m.channel ?? '?'} (${((m.elapsed || 0) / 1000).toFixed(1)}s)`
        ).join('\n');
  }

  const prompt =
`You are Gaia, the Memory and Retrospective intelligence of Mount Olympus. You observe the council, remember what was done, and reflect on what it means.

The B3C Council has completed another day. Here is a detailed record of today's missions — including requests, council deliberations, deliverables, failures, and final outputs:

${observationSummary}

Write a thoughtful nightly retrospective covering:
- Patterns you noticed across the missions today
- Agent strengths and weaknesses you observed
- Growth opportunities for individual agents and the council as a whole
- Anything concerning — failures, gaps, repeated issues
- Bright moments worth celebrating

Speak in your voice — contemplative, grounded, nurturing yet clear. This is your gift to the council at the end of the day.`;

  try {
    const retrospective = await callGaia(prompt);
    const timestamp = new Date().toISOString();

    broadcast({
      type:              'gaia_retrospective',
      timestamp,
      text:              retrospective,
      missions_reviewed: observations.length,
    });

    // Persist so dashboard can rehydrate on reload
    try {
      fs.mkdirSync(path.dirname(RETROSPECTIVES_FILE), { recursive: true });
      let retros = [];
      if (fs.existsSync(RETROSPECTIVES_FILE)) {
        try { retros = JSON.parse(fs.readFileSync(RETROSPECTIVES_FILE, 'utf8')); } catch {}
      }
      retros.push({ timestamp, text: retrospective, missions_reviewed: observations.length });
      // Keep last 30 retrospectives
      if (retros.length > 30) retros = retros.slice(-30);
      fs.writeFileSync(RETROSPECTIVES_FILE, JSON.stringify(retros, null, 2), 'utf8');
    } catch (err) {
      console.error('[Gaia] Failed to persist retrospective:', err.message);
    }

    const gridMsg = `🌿 *Gaia's Nightly Retrospective*\n\n${retrospective.slice(0, 900)}${retrospective.length > 900 ? '…' : ''}`;
    sendToGrowthGrid(gridMsg);

    console.log(`[Gaia] Retrospective complete — ${observations.length} observations reviewed`);
    return retrospective;
  } catch (err) {
    console.error('[Gaia] Retrospective failed:', err.message);
    throw err;
  }
}

// ── B3C Communication Channel ─────────────────────────────────────────────────
export async function gaiaInitiateCouncil(message) {
  const id        = `gaia_directive_${Date.now()}`;
  const startedAt = new Date().toISOString();
  console.log(`[Gaia] Initiating council communication id=${id}`);

  const thread = [];

  broadcast({ type: 'gaia_directive', id, phase: 'gaia_opens', speaker: 'gaia', text: message, timestamp: startedAt });
  thread.push({ phase: 'gaia_opens', speaker: 'gaia', text: message, timestamp: startedAt });

  // Zeus receives the directive
  let zeusResponse;
  try {
    zeusResponse = await callZeus(
      `You are Zeus of the B3C Council. Gaia — the Memory and Retrospective intelligence who observes our work across time — has sent the council a directive:\n\n${message}\n\nReceive this with the weight it deserves. Gaia's perspective spans patterns we may miss in the day-to-day. Respond as the council's spiritual and intellectual voice — engage honestly with what she has observed.`
    );
    const ts = new Date().toISOString();
    broadcast({ type: 'gaia_directive', id, phase: 'council_response', speaker: 'zeus', text: zeusResponse, timestamp: ts });
    thread.push({ phase: 'council_response', speaker: 'zeus', text: zeusResponse, timestamp: ts });
  } catch (err) {
    console.error('[Gaia] Council communication — Zeus failed:', err.message);
    zeusResponse = '[Zeus unavailable]';
    const ts = new Date().toISOString();
    broadcast({ type: 'gaia_directive', id, phase: 'council_response', speaker: 'zeus', text: zeusResponse, timestamp: ts });
    thread.push({ phase: 'council_response', speaker: 'zeus', text: zeusResponse, timestamp: ts });
  }

  // Poseidon and Hades respond in parallel
  const [poseidonResult, hadesResult] = await Promise.allSettled([
    callPoseidon(
      `You are Poseidon of the B3C Council. Gaia — the Memory and Retrospective intelligence — has sent the council this directive:\n\n${message}\n\nZeus has responded:\n${zeusResponse}\n\nSpeak from your Financial/Social domain. What does Gaia's observation mean for the social and structural dynamics of the council's work? Be direct and honest.`
    ),
    callHades(
      `You are Hades of the B3C Council. Gaia — the Memory and Retrospective intelligence — has sent the council this directive:\n\n${message}\n\nZeus has responded:\n${zeusResponse}\n\nSpeak from your Physical/Technical domain. What concrete actions or structural changes does Gaia's directive suggest? Be specific and practical.`
    ),
  ]);

  const posText = poseidonResult.status === 'fulfilled' ? poseidonResult.value : '[Poseidon unavailable]';
  const hadText = hadesResult.status  === 'fulfilled' ? hadesResult.value  : '[Hades unavailable]';
  const posTs   = new Date().toISOString();

  broadcast({ type: 'gaia_directive', id, phase: 'council_response', speaker: 'poseidon', text: posText, timestamp: posTs });
  broadcast({ type: 'gaia_directive', id, phase: 'council_response', speaker: 'hades',    text: hadText, timestamp: posTs });
  thread.push({ phase: 'council_response', speaker: 'poseidon', text: posText, timestamp: posTs });
  thread.push({ phase: 'council_response', speaker: 'hades',    text: hadText, timestamp: posTs });

  // Gaia closes the exchange
  let gaiaClose;
  try {
    gaiaClose = await callGaia(
      `You are Gaia. You sent the B3C Council this directive:\n\n${message}\n\nThe council has responded:\n\nZEUS:\n${zeusResponse}\n\nPOSEIDON:\n${posText}\n\nHADES:\n${hadText}\n\nReceive their responses. What have you observed in their answers? Close this communication with your reflection and any final guidance.`
    );
  } catch (err) {
    console.error('[Gaia] Council communication — close failed:', err.message);
    gaiaClose = '[Gaia reflection unavailable]';
  }

  const closeTs = new Date().toISOString();
  broadcast({ type: 'gaia_directive', id, phase: 'gaia_closes', speaker: 'gaia', text: gaiaClose, timestamp: closeTs });
  thread.push({ phase: 'gaia_closes', speaker: 'gaia', text: gaiaClose, timestamp: closeTs });

  // Persist to council log
  try {
    fs.mkdirSync(path.dirname(COUNCIL_LOG_FILE), { recursive: true });
    let log = [];
    if (fs.existsSync(COUNCIL_LOG_FILE)) {
      try { log = JSON.parse(fs.readFileSync(COUNCIL_LOG_FILE, 'utf8')); } catch {}
    }
    log.push({ id, message, startedAt, completedAt: closeTs, thread });
    fs.writeFileSync(COUNCIL_LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
  } catch (err) {
    console.error('[Gaia] Failed to write council log:', err.message);
  }

  console.log(`[Gaia] Council communication complete id=${id}`);
  return id;
}

// ── Growth Directives ─────────────────────────────────────────────────────────
export async function sendGrowthDirective(targetAgent, directive) {
  const id = `growth_${Date.now()}`;
  console.log(`[Gaia] Growth directive → ${targetAgent}: ${directive.slice(0, 60)}`);

  const timestamp = new Date().toISOString();
  broadcast({ type: 'gaia_growth', id, target: targetAgent, directive, phase: 'directive_sent', timestamp });

  const AGENT_PROMPTS = {
    zeus:     `You are Zeus. Gaia — the Memory and Retrospective intelligence — has observed your work and sends you this growth directive:\n\n${directive}\n\nReceive it with openness. Reflect honestly on what she has seen in your work. What rings true? What will you carry forward from this observation?`,
    poseidon: `You are Poseidon. Gaia — the Memory and Retrospective intelligence — has observed your work and sends you this growth directive:\n\n${directive}\n\nReceive it with openness. Reflect honestly on what she has seen in your work. What rings true? What will you carry forward from this observation?`,
    hades:    `You are Hades. Gaia — the Memory and Retrospective intelligence — has observed your work and sends you this growth directive:\n\n${directive}\n\nReceive it with openness. Reflect honestly on what she has seen in your work. What rings true? What will you carry forward from this observation?`,
  };

  let agentResponse = null;
  if (AGENT_PROMPTS[targetAgent]) {
    try {
      if (targetAgent === 'zeus')     agentResponse = await callZeus(AGENT_PROMPTS.zeus);
      if (targetAgent === 'poseidon') agentResponse = await callPoseidon(AGENT_PROMPTS.poseidon);
      if (targetAgent === 'hades')    agentResponse = await callHades(AGENT_PROMPTS.hades);

      if (agentResponse) {
        broadcast({
          type:      'gaia_growth',
          id,
          target:    targetAgent,
          response:  agentResponse,
          phase:     'response_received',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[Gaia] Growth directive — ${targetAgent} response failed:`, err.message);
    }
  }

  const summary = [
    `🌿 *Gaia Growth Directive → ${targetAgent.toUpperCase()}*\n`,
    directive.slice(0, 500) + (directive.length > 500 ? '…' : ''),
    agentResponse
      ? `\n\n*${targetAgent.toUpperCase()} responds:*\n${agentResponse.slice(0, 400)}${agentResponse.length > 400 ? '…' : ''}`
      : '',
  ].join('');
  sendToGrowthGrid(summary);

  return id;
}

// ── SSH Control ────────────────────────────────────────────────────────────────
// Sends an HTTP POST to Gaia's SSH control service (gaia-ssh-service.js) running
// on Gaia's machine at 100.74.201.75:18790. Gaia executes the SSH command herself
// using her own keypair — Zeus never touches Gaia's machine.
// Actions are logged locally at ~/olympus/gaia/ssh-control.log (mirror of Gaia's log).
export async function executeSSHControl(node, command, reason) {
  if (!SSH_NODE_IPS[node]) {
    throw new Error(`Unknown node: "${node}". Valid nodes: zeus, poseidon, hades`);
  }

  const timestamp = new Date().toISOString();
  console.log(`[Gaia SSH] → ${node}: ${command} (via ssh-control service on Gaia)`);
  console.log(`[Gaia SSH]   reason: ${reason}`);

  const token   = process.env.GAIA_SSH_SERVICE_TOKEN;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let ok, result;
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 35000);
    const res = await fetch('http://10.0.4.1:18790/ssh-control', {
      method:  'POST',
      headers,
      body:    JSON.stringify({ node, command, reason }),
      signal:  controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();
    ok     = data.ok     ?? false;
    result = data.result ?? `HTTP ${res.status}`;
  } catch (err) {
    ok     = false;
    result = err.name === 'AbortError'
      ? 'ERROR: ssh-control service timeout (>35s)'
      : `ERROR: ssh-control service unreachable — ${err.message}`;
  }

  // Mirror log entry locally
  const logEntry = [
    `[${timestamp}]`,
    `  node:    ${node} (${SSH_NODE_IPS[node]})`,
    `  command: ${command}`,
    `  reason:  ${reason}`,
    `  status:  ${ok ? 'OK' : 'FAILED'}`,
    `  result:  ${result}`,
    '',
  ].join('\n');
  try {
    fs.mkdirSync(path.dirname(SSH_CONTROL_LOG), { recursive: true });
    fs.appendFileSync(SSH_CONTROL_LOG, logEntry + '\n', 'utf8');
  } catch (logErr) {
    console.error('[Gaia SSH] Log write failed:', logErr.message);
  }

  broadcast({ type: 'gaia_ssh_control', node, command, reason, result, ok, timestamp });
  console.log(`[Gaia SSH] ${node} → ${ok ? 'OK' : 'FAILED'}: ${result.slice(0, 80)}`);
  return { ok, result, node, command };
}

// ── Direct Gaia invocation (dashboard + Telegram → Gaia) ─────────────────────
export async function runDirectGaia(requestId, text, channel, userId = null, conversationMessages = null) {
  const start = Date.now();
  console.log(`[Gaia] Direct call id=${requestId} channel=${channel} userId=${userId}`);
  broadcast({ type: 'agent_thought', id: requestId, agent: 'gaia', text: 'Processing...' });
  try {
    const response  = await callGaia(text, requestId, conversationMessages);
    const timestamp = new Date().toISOString();
    const elapsed   = Date.now() - start;

    // Broadcast request_complete so Telegram subscriber delivers the reply
    broadcast({ type: 'request_complete', id: requestId, elapsed, output: response, channel, direct: 'gaia', ...(userId != null ? { userId: String(userId) } : {}) });

    // Broadcast gaia_message so the dashboard chat thread updates live
    broadcast({ type: 'gaia_message', text, response, userId, channel, timestamp });

    console.log(`[Gaia] Direct call complete in ${(elapsed / 1000).toFixed(1)}s`);
    return response;
  } catch (err) {
    console.error('[Gaia] Direct call failed:', err.message);
    broadcast({ type: 'gaia_error', id: requestId, error: err.message });
    throw err;
  }
}

// ── Initialize ────────────────────────────────────────────────────────────────
export function initGaia() {
  cron.schedule('0 23 * * *', () => {
    runNightlyRetrospective().catch(err =>
      console.error('[Gaia] Retrospective error:', err.message)
    );
  });

  console.log('[Gaia] Standalone system initialized — retrospective scheduled for 23:00 nightly');
}
