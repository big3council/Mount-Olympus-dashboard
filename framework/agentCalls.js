/**
 * agentCalls.js — Shared agent invocation functions used by b3c.js, gaia.js, direct.js.
 *
 * All four agents are called via HTTP POST to their OpenClaw completions endpoints.
 * No SSH, no child processes.
 *
 * Zeus:     http://100.78.126.27:18789   — OPENCLAW_GATEWAY_TOKEN
 * Poseidon: http://100.114.203.41:18789  — POSEIDON_OPENCLAW_TOKEN
 * Hades:    http://100.68.217.82:18789   — HADES_OPENCLAW_TOKEN
 * Gaia:     http://100.74.201.75:18789   — GAIA_OPENCLAW_TOKEN
 */

const AGENT_CONFIGS = {
  zeus:     { url: 'http://100.78.126.27:18789/v1/chat/completions',   tokenEnv: 'OPENCLAW_GATEWAY_TOKEN' },
  poseidon: { url: 'http://100.114.203.41:18789/v1/chat/completions',  tokenEnv: 'POSEIDON_OPENCLAW_TOKEN' },
  hades:    { url: 'http://100.68.217.82:18789/v1/chat/completions',   tokenEnv: 'HADES_OPENCLAW_TOKEN' },
};

const GAIA_COMPLETIONS_URL = 'http://100.74.201.75:18789/v1/chat/completions';
const GAIA_TOKEN           = process.env.GAIA_OPENCLAW_TOKEN;

// ── Generic HTTP agent caller ─────────────────────────────────────────────────

async function callAgent(name, url, token, message) {
  if (!token) throw new Error(`${name} token not set (${AGENT_CONFIGS[name]?.tokenEnv ?? 'env var missing'})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body:   JSON.stringify({ model: 'main', messages: [{ role: 'user', content: message }], stream: false }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    // Surface specific network failure reasons
    if (err.name === 'AbortError') {
      throw new Error(`${name} timeout — no response after 120s`);
    }
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
  clearTimeout(timer);

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
// Unchanged — Gaia uses the same HTTP pattern and supports conversation history.

export async function callGaia(message, _requestId, conversationMessages = null) {
  if (!GAIA_TOKEN) throw new Error('GAIA_OPENCLAW_TOKEN not set');

  const messages = conversationMessages ?? [{ role: 'user', content: message }];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  let res;
  try {
    res = await fetch(GAIA_COMPLETIONS_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GAIA_TOKEN}`,
      },
      body:   JSON.stringify({ model: 'main', messages, stream: false }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gaia completions HTTP ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Gaia completions: empty response');
  return text;
}
