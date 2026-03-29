/**
 * agentCalls.js — Shared agent invocation functions used by b3c.js, gaia.js, direct.js.
 *
 * All four agents are called via HTTP POST to their OpenClaw completions endpoints.
 * No SSH, no child processes.
 *
 * LAN (primary — fast, ~0.4ms):
 * Zeus:     http://10.0.1.1:18789   — OPENCLAW_GATEWAY_TOKEN
 * Poseidon: http://10.0.1.2:18789   — POSEIDON_OPENCLAW_TOKEN
 * Hades:    http://10.0.2.2:18789   — HADES_OPENCLAW_TOKEN
 *
 * Tailscale (fallback — ~1.5ms):
 * Zeus:     http://100.78.126.27:18789
 * Poseidon: http://100.114.203.41:18789
 * Hades:    http://100.68.217.82:18789
 *
 * Gaia:     http://10.0.3.2:18789   — GAIA_OPENCLAW_TOKEN
 *
 * Quorum Sparks (LAN only — called via Zeus device pairing):
 * Zeus quorum:     hermes, athena, apollo, hestia
 * Poseidon quorum: aphrodite, iris, demeter, prometheus
 * Hades quorum:    hephaestus, nike, artemis, ares
 */

const AGENT_CONFIGS = {
  zeus:     { url: 'http://10.0.1.1:18789/v1/chat/completions',   tokenEnv: 'OPENCLAW_GATEWAY_TOKEN'  },
  poseidon: { url: 'http://10.0.1.2:18789/v1/chat/completions',   tokenEnv: 'POSEIDON_OPENCLAW_TOKEN' },
  hades:    { url: 'http://10.0.2.2:18789/v1/chat/completions',   tokenEnv: 'HADES_OPENCLAW_TOKEN'    },
};

const GAIA_COMPLETIONS_URL = 'http://10.0.3.2:18789/v1/chat/completions';
const GAIA_TOKEN           = process.env.GAIA_OPENCLAW_TOKEN;

// Per-call session IDs to avoid gateway lane queue serialization.
function sessionKey(name) {
  return `framework-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Quorum Routing ────────────────────────────────────────────────────────────
// All Sparks are accessed from Zeus via device pairing (Zeus device 4bfb92...).
// Each Spark exposes HTTP /v1/chat/completions on port 18789 (LAN).

const QUORUM_TOKEN = 'b67accb237fdc708bc216bcf283ae3948ed84c3b5d9fc673';

const QUORUM_MAP = {
  zeus: {
    hermes:    { ip: '192.168.1.102' },
    athena:    { ip: '192.168.1.189' },
    apollo:    { ip: '192.168.1.170' },
    hestia:    { ip: '192.168.1.105' },
  },
  poseidon: {
    aphrodite: { ip: '192.168.1.123' },
    iris:      { ip: '192.168.1.117' },
    demeter:   { ip: '192.168.1.113' },
    prometheus:{ ip: '192.168.1.131' },
  },
  hades: {
    hephaestus:{ ip: '192.168.1.156' },
    nike:      { ip: '192.168.1.165' },
    artemis:   { ip: '192.168.1.152' },
    ares:      { ip: '192.168.1.182' },
  },
};

// Flat lookup: agentName → { ip, councilHead }
const QUORUM_AGENTS = {};
for (const [head, agents] of Object.entries(QUORUM_MAP)) {
  for (const [name, cfg] of Object.entries(agents)) {
    QUORUM_AGENTS[name] = { ...cfg, councilHead: head };
  }
}

// ── Generic HTTP agent caller ─────────────────────────────────────────────────

async function callAgent(name, url, token, message) {
  if (!token) throw new Error(`${name} token not set (${AGENT_CONFIGS[name]?.tokenEnv ?? 'env var missing'})`);

  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':           'application/json',
        'Authorization':          `Bearer ${token}`,
        'x-openclaw-scopes':       'operator.write',
        'x-openclaw-session-key': sessionKey(name),
      },
      body: JSON.stringify({ model: 'openclaw', messages: [{ role: 'user', content: message }], stream: false }),
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('ECONNREFUSED')) {
      throw new Error(`${name} connection refused — OpenClaw gateway may be down (${url})`);
    }
    if (msg.includes('EHOSTUNREACH') || msg.includes('ENETUNREACH')) {
      throw new Error(`${name} unreachable — Tailscale node offline or network down (${url})`);
    }
    if (msg.includes('ENOTFOUND')) {
      throw new Error(`${name} DNS/host not found (${url})`);
    }
    throw new Error(`${name} network error — ${msg}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`${name} auth error — HTTP ${res.status} (check ${AGENT_CONFIGS[name]?.tokenEnv ?? 'token env var'})`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${name} HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${name} returned empty response`);
  return text;
}

// ── Quorum agent caller ───────────────────────────────────────────────────────

/**
 * Call a quorum Spark agent by name.
 * @param {string} councilHead - 'zeus', 'poseidon', or 'hades'
 * @param {string} agentName - e.g. 'hermes', 'aphrodite', 'ares'
 * @param {string} message - the prompt to send
 * @returns {Promise<string>} the agent's response text
 */
export async function callQuorumAgent(councilHead, agentName, message) {
  const quorum = QUORUM_MAP[councilHead];
  if (!quorum) throw new Error(`Unknown council head: ${councilHead}`);

  const agent = quorum[agentName];
  if (!agent) {
    // Try flat lookup in case caller passed just the name
    const flat = QUORUM_AGENTS[agentName];
    if (!flat) throw new Error(`Unknown quorum agent: ${agentName} (not in ${councilHead} quorum)`);
    if (flat.councilHead !== councilHead) {
      throw new Error(`${agentName} belongs to ${flat.councilHead} quorum, not ${councilHead}`);
    }
  }

  const { ip } = agent || QUORUM_AGENTS[agentName];
  const url = `http://${ip}:18789/v1/chat/completions`;
  const quorumSessionKey = `framework-${agentName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':           'application/json',
        'Authorization':          `Bearer ${QUORUM_TOKEN}`,
        'x-openclaw-scopes':       'operator.write',
        'x-openclaw-session-key': quorumSessionKey,
      },
      body: JSON.stringify({
        model: 'openclaw',
        messages: [{ role: 'user', content: message }],
        stream: false,
      }),
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('ECONNREFUSED')) {
      throw new Error(`${agentName} (${councilHead} quorum) connection refused — Spark gateway may be down (${ip}:18789)`);
    }
    throw new Error(`${agentName} (${councilHead} quorum) network error — ${msg}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`${agentName} (${councilHead} quorum) auth error — HTTP ${res.status}. Zeus device may need re-pairing.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${agentName} (${councilHead} quorum) HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${agentName} (${councilHead} quorum) returned empty response`);
  return text;
}

/**
 * Resolve a quorum agent name to its council head.
 * @param {string} agentName - e.g. 'hermes'
 * @returns {{ councilHead: string, ip: string } | null}
 */
export function resolveQuorumAgent(agentName) {
  return QUORUM_AGENTS[agentName] || null;
}

/**
 * List all agents in a council head's quorum.
 * @param {string} councilHead - 'zeus', 'poseidon', or 'hades'
 * @returns {string[]} agent names
 */
export function listQuorum(councilHead) {
  return Object.keys(QUORUM_MAP[councilHead] || {});
}

// ── Zeus ──────────────────────────────────────────────────────────────────────

export function callZeus(message, _requestId) {
  const { url } = AGENT_CONFIGS.zeus;
  const token   = process.env.OPENCLAW_GATEWAY_TOKEN;
  return callAgent('zeus', url, token, message);
}

// ── Poseidon ──────────────────────────────────────────────────────────────────

export function callPoseidon(message, _requestId) {
  const { url } = AGENT_CONFIGS.poseidon;
  const token   = process.env.POSEIDON_OPENCLAW_TOKEN;
  return callAgent('poseidon', url, token, message);
}

// ── Hades ─────────────────────────────────────────────────────────────────────

export function callHades(message, _requestId) {
  const { url } = AGENT_CONFIGS.hades;
  const token   = process.env.HADES_OPENCLAW_TOKEN;
  return callAgent('hades', url, token, message);
}

// ── Gaia ──────────────────────────────────────────────────────────────────────
// Gaia uses the same HTTP pattern and supports conversation history.

export async function callGaia(message, _requestId, conversationMessages = null) {
  if (!GAIA_TOKEN) throw new Error('GAIA_OPENCLAW_TOKEN not set');

  const messages = conversationMessages ?? [{ role: 'user', content: message }];

  const res = await fetch(GAIA_COMPLETIONS_URL, {
    method:  'POST',
    headers: {
      'Content-Type':           'application/json',
      'Authorization':          `Bearer ${GAIA_TOKEN}`,
      'x-openclaw-scopes':       'operator.write',
      'x-openclaw-session-key': sessionKey("gaia"),
    },
    body: JSON.stringify({ model: 'openclaw', messages, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gaia completions HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Gaia completions: empty response');
  return text;
}
