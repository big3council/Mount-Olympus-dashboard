/**
 * quorum-dispatch.js — Quorum execution for Mount Olympus B3C pipeline.
 *
 * After Initial B3C Council assigns scope, this module dispatches work to
 * the 12 quorum Sparks. Each assigned council head runs a full quorum cycle:
 *   A) Initial Quorum Council — head briefs its 4 Sparks
 *   B) Parallel Spark work — all 4 execute simultaneously
 *   C) Backend Quorum review — head reviews Spark returns
 * Unassigned heads run a smoke test on their Sparks.
 * All heads run in parallel via Promise.allSettled.
 *
 * Returns quorum reports for Backend B3C Council consumption.
 */

import { callAgent } from './gateway.js';
import { broadcast } from './olympus-ws.js';

// ── Quorum Map ───────────────────────────────────────────────────────────────
const QUORUM = {
  zeus:     ['hermes', 'athena', 'apollo', 'hestia'],
  poseidon: ['aphrodite', 'iris', 'demeter', 'prometheus'],
  hades:    ['hephaestus', 'nike', 'artemis', 'ares'],
};

const log = (...args) => console.log('[quorum]', new Date().toISOString(), ...args);

// ── Safe agent call (never throws) ───────────────────────────────────────────
async function callSpark(requestId, spark, prompt, phase) {
  broadcast({ type: 'agent_start', id: requestId, agent: spark, phase });
  try {
    const result = await callAgent({ node: spark, prompt, timeout: 90000 });
    broadcast({ type: 'agent_complete', id: requestId, agent: spark, phase });
    return { ok: true, agent: spark, result };
  } catch (err) {
    const error = err.message || 'No response';
    log(`${spark} failed in ${phase}:`, error);
    broadcast({ type: 'agent_error', id: requestId, agent: spark, phase, error });
    return { ok: false, agent: spark, error };
  }
}

// ── Full Quorum Cycle for an assigned head ───────────────────────────────────
/**
 * @param {string} requestId — mission ID for WS events
 * @param {string} head — 'zeus', 'poseidon', or 'hades'
 * @param {string} scope — the task assignment for this head's domain
 * @param {string} userInput — original user request
 * @returns {Promise<{ head, sparks: object[], synthesis: string|null }>}
 */
export async function runQuorumCycle(requestId, head, scope, userInput) {
  const sparks = QUORUM[head];
  if (!sparks) return { head, sparks: [], synthesis: null };

  log(`${head} quorum cycle starting — ${sparks.length} Sparks`);
  broadcast({ type: 'council_message', id: requestId, council: 'quorum', speaker: head, text: `Briefing quorum: ${sparks.join(', ')}` });

  // Phase A: Brief each Spark with domain-specific work
  const briefPrompt = `You are a quorum member under ${head.toUpperCase()}.

ORIGINAL REQUEST: ${userInput.slice(0, 800)}

YOUR ASSIGNMENT FROM ${head.toUpperCase()}:
${scope.slice(0, 1000)}

Produce a focused, substantive deliverable for your domain expertise. Keep under 1200 characters. Be direct — no preamble.`;

  // Phase B: Parallel Spark execution
  const results = await Promise.allSettled(
    sparks.map(spark => callSpark(requestId, spark, briefPrompt, 'quorum_work'))
  );

  const returns = results
    .filter(r => r.status === 'fulfilled' && r.value.ok)
    .map(r => r.value);
  const failures = results
    .filter(r => r.status === 'fulfilled' && !r.value.ok)
    .map(r => r.value);

  log(`${head} quorum: ${returns.length}/${sparks.length} returned, ${failures.length} failed`);

  // Broadcast returns as quorum council messages
  for (const ret of returns) {
    broadcast({ type: 'council_message', id: requestId, council: 'quorum', speaker: ret.agent, text: ret.result.slice(0, 500) });
  }

  // Phase C: Head reviews and synthesizes Spark returns
  if (returns.length === 0) {
    log(`${head} quorum: all Sparks failed — returning head assessment only`);
    return { head, sparks: [], synthesis: null };
  }

  let synthesis = null;
  try {
    const reviewPrompt = `You are ${head.toUpperCase()}, reviewing your quorum's work.

ORIGINAL REQUEST: ${userInput.slice(0, 500)}

QUORUM RETURNS:
${returns.map(r => `--- ${r.agent.toUpperCase()} ---\n${r.result.slice(0, 600)}`).join('\n\n')}
${failures.length > 0 ? `\nUNAVAILABLE: ${failures.map(f => f.agent).join(', ')}` : ''}

Synthesize your quorum's work into a single domain report. Under 1500 characters. State key findings and your domain's recommendation.`;

    synthesis = await callAgent({ node: head, prompt: reviewPrompt, timeout: 60000 });
    broadcast({ type: 'council_message', id: requestId, council: 'quorum', speaker: head, text: `[SYNTHESIS] ${synthesis.slice(0, 500)}`, vote: 'approve' });
    log(`${head} quorum synthesis complete (${synthesis.length} chars)`);
  } catch (err) {
    log(`${head} quorum synthesis failed:`, err.message);
  }

  return { head, sparks: returns.map(r => ({ agent: r.agent, snippet: r.result.slice(0, 300) })), synthesis };
}

// ── Smoke Test for unassigned heads ──────────────────────────────────────────
/**
 * Quick health check — asks each Spark a simple question.
 * @param {string} requestId
 * @param {string} head
 * @returns {Promise<{ head, online: string[], offline: string[] }>}
 */
export async function runSmokeTest(requestId, head) {
  const sparks = QUORUM[head];
  if (!sparks) return { head, online: [], offline: [] };

  log(`${head} smoke test — ${sparks.length} Sparks`);

  const results = await Promise.allSettled(
    sparks.map(spark => callSpark(requestId, spark, 'Respond with exactly: READY', 'smoke_test'))
  );

  const online = results
    .filter(r => r.status === 'fulfilled' && r.value.ok)
    .map(r => r.value.agent);
  const offline = results
    .filter(r => r.status === 'fulfilled' && !r.value.ok)
    .map(r => r.value.agent);

  log(`${head} smoke: ${online.length} online, ${offline.length} offline`);
  return { head, online, offline };
}

// ── Run all quorums in parallel ──────────────────────────────────────────────
/**
 * Main entry point. Runs assigned heads' full quorum cycles and
 * unassigned heads' smoke tests simultaneously.
 *
 * @param {string} requestId
 * @param {string} userInput
 * @param {object} headScopes — { zeus: 'scope text', poseidon: 'scope text', ... }
 *   Heads with non-null scope run full cycles. Null scope = smoke test.
 * @returns {Promise<{ reports: object[], smokeTests: object[] }>}
 */
export async function runAllQuorums(requestId, userInput, headScopes) {
  log('=== ALL QUORUMS STARTING ===');
  broadcast({ type: 'stage_change', id: requestId, stage: 'quorum_dispatch' });

  const tasks = [];
  const assignedHeads = [];
  const unassignedHeads = [];

  for (const head of ['zeus', 'poseidon', 'hades']) {
    if (headScopes[head]) {
      assignedHeads.push(head);
      tasks.push(runQuorumCycle(requestId, head, headScopes[head], userInput));
    } else {
      unassignedHeads.push(head);
      tasks.push(runSmokeTest(requestId, head));
    }
  }

  log(`assigned: ${assignedHeads.join(',')} | smoke: ${unassignedHeads.join(',')}`);

  const results = await Promise.allSettled(tasks);
  const reports = [];
  const smokeTests = [];

  for (let i = 0; i < results.length; i++) {
    const head = [...assignedHeads, ...unassignedHeads][i];
    if (results[i].status === 'fulfilled') {
      const val = results[i].value;
      if (val.synthesis !== undefined) {
        reports.push(val);
      } else {
        smokeTests.push(val);
      }
    } else {
      log(`${head} quorum failed:`, results[i].reason?.message);
    }
  }

  log(`=== QUORUMS COMPLETE: ${reports.length} reports, ${smokeTests.length} smoke tests ===`);
  return { reports, smokeTests };
}
