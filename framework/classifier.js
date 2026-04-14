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
- If T1: agent must be set, confidence must be >= 0.70
- If T2: agent should be null
- If unsure: choose T2 with low confidence
- Never route multi-domain requests to T1`;

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
    const agent = ['zeus', 'poseidon', 'hades'].includes(result.agent) ? result.agent : null;
    const confidence = typeof result.confidence === 'number' ? result.confidence : 0;

    // Auto-escalate if confidence is below threshold
    if (tier === 'T1' && confidence < CONFIDENCE_THRESHOLD) {
      console.log(`[classifier] T1 confidence ${confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD} — escalating to T2`);
      return { tier: 'T2', agent: null, confidence };
    }

    // T1 must have an agent
    if (tier === 'T1' && !agent) {
      console.warn('[classifier] T1 with no agent — escalating to T2');
      return { tier: 'T2', agent: null, confidence };
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
