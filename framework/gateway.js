/**
 * gateway.js — Unified OpenClaw gateway for Mount Olympus.
 *
 * Single module for all agent communication — council heads, quorum sparks, Gaia.
 * Replaces agentCalls.js (council tab) and openclawCall() in zeus-handler.js (flywheel).
 *
 * All agents are called via HTTP POST to their OpenClaw completions endpoints.
 * No SSH, no child processes.
 *
 * Node registry:
 *   Council:  zeus(.11), poseidon(.12), hades(.13), gaia(.14) — per-node tokens
 *   Sparks:   hermes(.102), hestia(.105), apollo(.170), athena(.189),
 *             aphrodite(.123), iris(.117), demeter(.113), prometheus(.131),
 *             hephaestus(.156), nike(.165), artemis(.152), ares(.182) — QUORUM_TOKEN
 */

// ── Node Registry ────────────────────────────────────────────────────────────

const COUNCIL_NODES = {
  zeus:     { ip: '192.168.1.11',  tokenEnv: 'OPENCLAW_GATEWAY_TOKEN',  tailscale: '100.78.126.27'  },
  poseidon: { ip: '192.168.1.12',  tokenEnv: 'POSEIDON_OPENCLAW_TOKEN', tailscale: '100.114.203.41' },
  hades:    { ip: '192.168.1.13',  tokenEnv: 'HADES_OPENCLAW_TOKEN',    tailscale: '100.68.217.82'  },
  gaia:     { ip: '192.168.1.14',  tokenEnv: 'GAIA_OPENCLAW_TOKEN',     tailscale: null              },
};

const QUORUM_MAP = {
  zeus:     { hermes: '192.168.1.102', athena: '192.168.1.189', apollo: '192.168.1.170', hestia: '192.168.1.105' },
  poseidon: { aphrodite: '192.168.1.123', iris: '192.168.1.117', demeter: '192.168.1.113', prometheus: '192.168.1.131' },
  hades:    { hephaestus: '192.168.1.156', nike: '192.168.1.165', artemis: '192.168.1.152', ares: '192.168.1.182' },
};

// Flat lookup: agentName → { ip, councilHead }
const QUORUM_AGENTS = {};
for (const [head, agents] of Object.entries(QUORUM_MAP)) {
  for (const [name, ip] of Object.entries(agents)) {
    QUORUM_AGENTS[name] = { ip, councilHead: head };
  }
}

// ── Token Resolution ─────────────────────────────────────────────────────────

function getToken(node) {
  const council = COUNCIL_NODES[node];
  if (council) return process.env[council.tokenEnv] || '';

  const quorum = QUORUM_AGENTS[node];
  if (quorum) return process.env.QUORUM_TOKEN || process.env.OPENCLAW_TOKEN || '';

  return '';
}

function getUrl(node) {
  const council = COUNCIL_NODES[node];
  if (council) return `http://${council.ip}:18789/v1/chat/completions`;

  const quorum = QUORUM_AGENTS[node];
  if (quorum) return `http://${quorum.ip}:18789/v1/chat/completions`;

  throw new Error(`Unknown node: ${node}`);
}

// ── Session Key ──────────────────────────────────────────────────────────────

function makeSessionKey(node) {
  return `framework-${node}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Stable session key per (user, agent) pair. If OpenClaw threads
// conversation history by session key, using a deterministic key here lets
// each agent build up a genuine memory of each user across calls. If
// OpenClaw ignores session keys, this is no worse than the random default.
// Returns a stable key like 'user-carson-poseidon' or falls back to the
// random per-call key for anonymous traffic.
function userSessionKey(node, userId) {
  if (!userId) return makeSessionKey(node);
  const raw = String(userId);
  const userKey = raw === '8150818650' ? 'carson'
                : raw === '874345067'  ? 'tyler'
                : raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'user';
  return `user-${userKey}-${node}`;
}

// Map userId → display name so agents know *who* is speaking. Without this
// prefix, Tyler's messages get answered as if they were from Carson because
// each agent's system prompt hardcodes Carson as the default user. We inject
// a small speaker header instead of rewriting every agent's identity file.
function speakerLabel(userId) {
  if (!userId) return null;
  const raw = String(userId);
  if (raw === '8150818650') return 'Carson';
  if (raw === '874345067')  return 'Tyler';
  return null;
}

function prefixSpeaker(prompt, userId) {
  const name = speakerLabel(userId);
  if (!name) return prompt;
  return `[Speaker: ${name}]\n\n${prompt}`;
}

// ── Core Caller ──────────────────────────────────────────────────────────────

/**
 * Call any agent in the Mount Olympus cluster.
 *
 * @param {object} opts
 * @param {string} opts.node         — Agent name: zeus, poseidon, hades, gaia, hermes, athena, etc.
 * @param {string} opts.prompt       — User message content
 * @param {string} [opts.systemPrompt] — Optional system message (prepended to messages array)
 * @param {string} [opts.model]      — Model override (default: 'openclaw')
 * @param {number} [opts.timeout]    — Request timeout in ms (default: 120000)
 * @param {string} [opts.sessionKey] — Custom session key (auto-generated if omitted)
 * @param {string} [opts.token]      — Token override (resolved from env if omitted)
 * @returns {Promise<string>} Agent response text
 */
export async function callAgent({
  node,
  prompt,
  systemPrompt,
  model = 'openclaw',
  timeout = 120000,
  sessionKey,
  token,
}) {
  const url = getUrl(node);
  const authToken = token || getToken(node);
  const session = sessionKey || makeSessionKey(node);

  if (!authToken) {
    const envVar = COUNCIL_NODES[node]?.tokenEnv || 'QUORUM_TOKEN';
    throw new Error(`${node} token not set (${envVar})`);
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'x-openclaw-scopes': 'operator.write',
        'x-openclaw-session-key': session,
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err.message || '';
    if (msg.includes('aborted') || msg.includes('abort')) {
      throw new Error(`${node} request timed out after ${timeout}ms`);
    }
    if (msg.includes('ECONNREFUSED')) {
      throw new Error(`${node} connection refused — OpenClaw gateway may be down (${url})`);
    }
    if (msg.includes('EHOSTUNREACH') || msg.includes('ENETUNREACH')) {
      throw new Error(`${node} unreachable — node offline or network down (${url})`);
    }
    if (msg.includes('ENOTFOUND')) {
      throw new Error(`${node} DNS/host not found (${url})`);
    }
    throw new Error(`${node} network error — ${msg}`);
  }
  clearTimeout(timer);

  if (res.status === 401 || res.status === 403) {
    const envVar = COUNCIL_NODES[node]?.tokenEnv || 'QUORUM_TOKEN';
    throw new Error(`${node} auth error — HTTP ${res.status} (check ${envVar})`);
  }
  if (res.status === 529) {
    throw new Error(`${node} overloaded (529) — provider at capacity`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${node} HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${node} returned empty response`);
  return text;
}

// ── Streaming Caller ─────────────────────────────────────────────────────────

export async function callAgentStream({ node, prompt, model = 'openclaw', sessionKey, token }, onChunk) {
  const url = getUrl(node);
  const authToken = token || getToken(node);
  const session = sessionKey || makeSessionKey(node);

  if (!authToken) throw new Error(`${node} token not set`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-openclaw-scopes': 'operator.write',
      'x-openclaw-session-key': session,
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: true }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${node} HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`);
  }

  let full = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta, full);
        }
      } catch {}
    }
  }
  if (!full) throw new Error(`${node} returned empty streaming response`);
  return full;
}

// ── Convenience Exports (backward compatible) ────────────────────────────────
//
// Pass { userId } as the 3rd arg (or second-arg-as-options object) to get a
// stable user-scoped session key. Without userId, each call uses a random
// session key (old behavior).

export function callZeus(message, _requestId, opts = {}) {
  const sessionKey = opts.userId ? userSessionKey('zeus', opts.userId) : undefined;
  const prompt = prefixSpeaker(message, opts.userId);
  return callAgent({ node: 'zeus', prompt, sessionKey });
}

export function callPoseidon(message, _requestId, opts = {}) {
  const sessionKey = opts.userId ? userSessionKey('poseidon', opts.userId) : undefined;
  const prompt = prefixSpeaker(message, opts.userId);
  return callAgent({ node: 'poseidon', prompt, sessionKey });
}

export function callHades(message, _requestId, opts = {}) {
  const sessionKey = opts.userId ? userSessionKey('hades', opts.userId) : undefined;
  const prompt = prefixSpeaker(message, opts.userId);
  return callAgent({ node: 'hades', prompt, sessionKey });
}

export async function callGaia(message, _requestId, conversationMessages = null) {
  if (conversationMessages) {
    // Gaia supports conversation history — build messages directly
    const url = getUrl('gaia');
    const token = getToken('gaia');
    if (!token) throw new Error('GAIA_OPENCLAW_TOKEN not set');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-openclaw-scopes': 'operator.write',
        'x-openclaw-session-key': makeSessionKey('gaia'),
      },
      body: JSON.stringify({ model: 'openclaw', messages: conversationMessages, stream: false }),
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
  return callAgent({ node: 'gaia', prompt: message });
}

// ── Quorum Exports ───────────────────────────────────────────────────────────

export async function callQuorumAgent(councilHead, agentName, message) {
  const quorum = QUORUM_MAP[councilHead];
  if (!quorum) throw new Error(`Unknown council head: ${councilHead}`);

  if (!quorum[agentName]) {
    const flat = QUORUM_AGENTS[agentName];
    if (!flat) throw new Error(`Unknown quorum agent: ${agentName} (not in ${councilHead} quorum)`);
    if (flat.councilHead !== councilHead) {
      throw new Error(`${agentName} belongs to ${flat.councilHead} quorum, not ${councilHead}`);
    }
  }

  return callAgent({ node: agentName, prompt: message });
}

export function resolveQuorumAgent(agentName) {
  return QUORUM_AGENTS[agentName] || null;
}

export function listQuorum(councilHead) {
  return Object.keys(QUORUM_MAP[councilHead] || {});
}

// ── Registry Exports (for zeus-handler manifest integration) ─────────────────

export { COUNCIL_NODES, QUORUM_MAP, QUORUM_AGENTS };
