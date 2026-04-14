/**
 * classifier.js — 2-tier classification for Mount Olympus B3C pipeline.
 *
 * T1 (Smart Solo): Haiku picks one B3C member → handles alone. Fast, no council.
 * T2 (Full Deliberative): Full B3C council flow with deliberation + circuit breakers.
 *
 * Uses Anthropic Haiku API directly (not OpenClaw) for classification.
 * Reads routing context from NAS. Fail-safe: any error → T2.
 */

import fs from 'fs';
import path from 'path';

const ROUTING_CONTEXT_PATH = '/Volumes/olympus/pool/routing/t1-routing-context.md';
const CONFIDENCE_THRESHOLD = 0.70;

// Router short-term memory — last ~5 minutes of routing decisions per user.
// Lets Haiku detect continuations ("Carson is mid-Poseidon thread, route back")
// without carrying thread bodies around. Lives on Zeus disk, not NAS, because
// it's hot short-term state.
const ROUTER_STATE_DIR  = '/Users/zeus/olympus/framework/state';
const ROUTER_STATE_FILE = path.join(ROUTER_STATE_DIR, 'router-recent.json');
const ROUTER_WINDOW_MS  = 5 * 60 * 1000; // 5 minutes
const ROUTER_MAX_PER_USER = 12;

function readRouterState() {
  try {
    const raw = fs.readFileSync(ROUTER_STATE_FILE, 'utf8');
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function writeRouterState(state) {
  try {
    fs.mkdirSync(ROUTER_STATE_DIR, { recursive: true });
    fs.writeFileSync(ROUTER_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('[classifier] failed to persist router state:', err.message);
  }
}

function getRecentRouting(userKey) {
  if (!userKey) return [];
  const state = readRouterState();
  const entries = state[userKey] || [];
  const cutoff = Date.now() - ROUTER_WINDOW_MS;
  return entries.filter(e => new Date(e.ts).getTime() >= cutoff);
}

function recordRoutingDecision(userKey, decision) {
  if (!userKey) return;
  const state = readRouterState();
  const cutoff = Date.now() - ROUTER_WINDOW_MS;
  const prev = (state[userKey] || []).filter(e => new Date(e.ts).getTime() >= cutoff);
  prev.push({
    tier:   decision.tier,
    target: decision.agent || (decision.tier === 'T2' ? 'council' : null),
    ts:     new Date().toISOString(),
  });
  // Keep at most N per user (oldest first trimmed).
  state[userKey] = prev.slice(-ROUTER_MAX_PER_USER);
  writeRouterState(state);
}

function formatRecentRoutingForPrompt(recent) {
  if (!recent || recent.length === 0) return null;
  // Collapse runs of the same target into a count: poseidon × 3.
  const runs = [];
  for (const e of recent) {
    const last = runs[runs.length - 1];
    if (last && last.target === e.target) last.count++;
    else runs.push({ target: e.target, count: 1 });
  }
  const summary = runs.map(r => r.count > 1 ? `${r.target} × ${r.count}` : r.target).join(', ');
  return `Recent routing for this user (last ${ROUTER_WINDOW_MS / 60000} min): ${summary}. Consider continuation unless the new message clearly pivots to a different domain.`;
}

// Pre-Haiku fast-path: short conversational prompts always route to Zeus T1.
// Without this short-circuit, Haiku treats bare greetings as "no clear domain"
// and escalates to T2 per the routing-context's "when unsure → T2" rule.
// That cost a 107s full-council pipeline for "hi" before this was added.
const CONVERSATIONAL_REGEX = /^(hi+|hello+|hey+|yo|sup|howdy|greetings|gm|good\s*(morning|afternoon|evening|night)|thanks?|thank\s+you|ty|ok(ay)?|cool|nice|got\s+it|ack|roger|copy|\u{1F44B}|\u{1F44D})[\s.!?,]*$/iu;

function isConversational(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (CONVERSATIONAL_REGEX.test(trimmed)) return true;
  // Very short prompts (< 6 chars after punctuation strip) are almost always
  // conversational. Even if a greeting isn't in the regex, brevity is a strong
  // signal that the full council is overkill.
  const stripped = trimmed.replace(/[\s.!?,]+/g, '');
  if (stripped.length > 0 && stripped.length < 6) return true;
  return false;
}

// Name-callout short-circuit: if the user explicitly addresses a single
// council member by name, route to that agent T1. No ambiguity, no Haiku.
// Recognizes:
//   "hello poseidon"  /  "hey hades"  /  "hi zeus"  /  "yo gaia"
//   "poseidon"        (bare name)
//   "poseidon,"  "zeus:"  "hades —"  (name as salutation)
//   "poseidon quick check — is outbound still viable 2026?" (name first)
// Does NOT fire on:
//   "ZEUS PROTOCOL: ..." (already handled upstream via isDirect in queue.js)
//   "what would zeus think" / "ask zeus about ..." (name not at start,
//     not in salutation form — Haiku handles that kind of routing)
const GREETING_WORDS = 'hi+|hello+|hey+|yo|sup|howdy|greetings|gm|good\\s*(?:morning|afternoon|evening|night)';
const AGENT_NAMES    = 'zeus|poseidon|hades|gaia';
const NAME_CALLOUT_REGEX = new RegExp(
  '^\\s*(?:(?:' + GREETING_WORDS + ')[\\s,.!?:—-]+)?' + // optional greeting prefix
  '(' + AGENT_NAMES + ')'                              + // agent name (captured)
  '(?:\\b[\\s,.!?:—-]|$)',                              // word-boundary terminator
  'i'
);

function detectAgentCallout(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  if (!trimmed) return null;
  // Never hijack "ZEUS PROTOCOL:" — the upstream isDirect logic in queue.js
  // already treats that as a direct Zeus call.
  if (/^zeus\s+protocol\s*:/i.test(trimmed)) return null;
  // Gaia is isolated — she has her own pipeline, not a B3C T1 target.
  // Don't return gaia here; let the normal flow handle it.
  const m = trimmed.match(NAME_CALLOUT_REGEX);
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (name === 'gaia') return null; // route gaia through the normal path
  return name; // 'zeus' | 'poseidon' | 'hades'
}

function readRoutingContext() {
  try {
    return fs.readFileSync(ROUTING_CONTEXT_PATH, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Classify a prompt into T1 (smart solo) or T2 (full deliberative).
 *
 * @param {string} prompt — The user's request text
 * @param {object} [opts]
 * @param {string} [opts.userId] — user identifier (enables short-term router
 *   memory for continuation detection)
 * @returns {Promise<{ tier: 'T1' | 'T2', agent: string | null, confidence: number }>}
 */
export async function classifyJob(prompt, opts = {}) {
  const userKey = opts.userId ? String(opts.userId) : null;

  // Pre-Haiku name-callout short-circuit — when the user explicitly addresses
  // a council member by name, route to that member T1 directly.
  const calledAgent = detectAgentCallout(prompt);
  if (calledAgent) {
    const decision = { tier: 'T1', agent: calledAgent, confidence: 1.0 };
    console.log(`[classifier] '${String(prompt).slice(0, 60)}' → T1 → ${calledAgent} (1.00, name-callout fast-path)`);
    recordRoutingDecision(userKey, decision);
    return decision;
  }

  // Pre-Haiku conversational short-circuit — greetings + very short prompts.
  if (isConversational(prompt)) {
    const decision = { tier: 'T1', agent: 'zeus', confidence: 1.0 };
    console.log(`[classifier] '${String(prompt).slice(0, 60)}' → T1 → zeus (1.00, conversational fast-path)`);
    recordRoutingDecision(userKey, decision);
    return decision;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[classifier] ANTHROPIC_API_KEY not set — defaulting to T2');
    return { tier: 'T2', agent: null, confidence: 0 };
  }

  const routingContext = readRoutingContext();
  if (!routingContext) {
    console.warn('[classifier] Routing context not found — defaulting to T2');
    return { tier: 'T2', agent: null, confidence: 0 };
  }

  // Short-term router memory — surface the user's recent routing lane so
  // Haiku can recognize continuations without the caller having to repeat a
  // name. Nothing is injected if the user hasn't spoken in the last 5 min.
  const recentRouting = getRecentRouting(userKey);
  const recentBlock   = formatRecentRoutingForPrompt(recentRouting);

  const classifyPrompt = `You are a routing classifier for the B3C council system.

ROUTING CONTEXT:
${routingContext}

TASK: Classify this request. Determine if ONE council member can handle it alone (T1) or if it needs the full council (T2).
${recentBlock ? `\nROUTER SHORT-TERM MEMORY:\n${recentBlock}\n` : ''}
REQUEST TO CLASSIFY:
${prompt.slice(0, 1000)}

Respond in JSON only — no markdown, no explanation:
{"tier": "T1" or "T2", "agent": "zeus" or "poseidon" or "hades" or null, "confidence": 0.0 to 1.0}

Rules:
- Bias strongly toward T1. T2 is expensive (full council deliberation).
- Greetings, acknowledgments, small talk → T1 → zeus (confidence 1.0).
- Simple factual or single-domain tasks → T1, pick the domain agent.
- If T1 domain is unclear → T1 → zeus (zeus is the conversational default).
- If Router Short-term Memory shows the user is already mid-thread with a
  specific agent AND the new message doesn't clearly pivot to a different
  domain, CONTINUE that same agent T1. Continuation beats fresh routing.
- On T1: agent MUST be set; prefer confidence ≥ 0.70.
- On T2: agent should be null. Only use T2 for multi-domain, strategic,
  comparative, long/complex, or War Room requests.
- Never route multi-domain requests to T1.`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        messages: [{ role: 'user', content: classifyPrompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.error('[classifier] Haiku API error:', res.status);
      return { tier: 'T2', agent: null, confidence: 0 };
    }

    const data = await res.json();
    const raw = data?.content?.[0]?.text?.trim() || '';

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      // Try extracting from markdown code block
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {}
      }
    }

    if (!result || !result.tier) {
      console.warn('[classifier] Haiku returned unparseable:', raw.slice(0, 100));
      return { tier: 'T2', agent: null, confidence: 0 };
    }

    const tier = result.tier === 'T1' ? 'T1' : 'T2';
    let   agent = ['zeus', 'poseidon', 'hades'].includes(result.agent) ? result.agent : null;
    let   confidence = typeof result.confidence === 'number' ? result.confidence : 0;

    // Low-confidence T1 no longer escalates to T2 — instead we commit to T1
    // with Zeus as the default, matching the routing-context "when T1 domain
    // is unclear, pick Zeus" rule. Only T2 if Haiku itself chose T2.
    if (tier === 'T1' && confidence < CONFIDENCE_THRESHOLD) {
      console.log(`[classifier] T1 confidence ${confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD} — committing to T1 → zeus (default)`);
      agent = 'zeus';
      confidence = Math.max(confidence, CONFIDENCE_THRESHOLD);
    }

    // T1 must have an agent — if Haiku omitted one, default to Zeus rather
    // than escalate the whole request to the full council.
    if (tier === 'T1' && !agent) {
      console.warn('[classifier] T1 with no agent — defaulting to zeus');
      agent = 'zeus';
    }

    const decision = { tier, agent, confidence };
    console.log(`[classifier] '${prompt.slice(0, 60)}' → ${tier}${agent ? ' → ' + agent : ''} (${confidence.toFixed(2)})${recentBlock ? ' [mem]' : ''}`);
    recordRoutingDecision(userKey, decision);
    return decision;

  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('abort')) {
      console.error('[classifier] Haiku timed out (8s) — defaulting to T2');
    } else {
      console.error('[classifier] Error:', msg, '— defaulting to T2');
    }
    const fallback = { tier: 'T2', agent: null, confidence: 0 };
    recordRoutingDecision(userKey, fallback);
    return fallback;
  }
}
