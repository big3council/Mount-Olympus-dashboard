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

const ROUTING_CONTEXT_PATH = '/Volumes/olympus/pool/routing/t1-routing-context.md';
const CONFIDENCE_THRESHOLD = 0.70;

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
 * @returns {Promise<{ tier: 'T1' | 'T2', agent: string | null, confidence: number }>}
 */
export async function classifyJob(prompt) {
  // Pre-Haiku short-circuit — see CONVERSATIONAL_REGEX above.
  if (isConversational(prompt)) {
    console.log(`[classifier] '${String(prompt).slice(0, 60)}' → T1 → zeus (1.00, conversational fast-path)`);
    return { tier: 'T1', agent: 'zeus', confidence: 1.0 };
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

  const classifyPrompt = `You are a routing classifier for the B3C council system.

ROUTING CONTEXT:
${routingContext}

TASK: Classify this request. Determine if ONE council member can handle it alone (T1) or if it needs the full council (T2).

REQUEST TO CLASSIFY:
${prompt.slice(0, 1000)}

Respond in JSON only — no markdown, no explanation:
{"tier": "T1" or "T2", "agent": "zeus" or "poseidon" or "hades" or null, "confidence": 0.0 to 1.0}

Rules:
- Bias strongly toward T1. T2 is expensive (full council deliberation).
- Greetings, acknowledgments, small talk → T1 → zeus (confidence 1.0).
- Simple factual or single-domain tasks → T1, pick the domain agent.
- If T1 domain is unclear → T1 → zeus (zeus is the conversational default).
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

    console.log(`[classifier] '${prompt.slice(0, 60)}' → ${tier}${agent ? ' → ' + agent : ''} (${confidence.toFixed(2)})`);
    return { tier, agent, confidence };

  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('abort')) {
      console.error('[classifier] Haiku timed out (8s) — defaulting to T2');
    } else {
      console.error('[classifier] Error:', msg, '— defaulting to T2');
    }
    return { tier: 'T2', agent: null, confidence: 0 };
  }
}
