/**
 * queue.js — Unified mission queue with tier-based concurrency.
 *
 * Concurrency limits:
 *   TIER_1: 3 concurrent
 *   TIER_2: 2 concurrent
 *   TIER_3: 1 concurrent
 *   DIRECT: 3 concurrent (zeus_protocol, poseidon, hades, gaia)
 *
 * Priority: missions with priority flag jump the queue after Zeus evaluation.
 * Zeus also reviews the full queue after every new addition and may reorder.
 */

import { broadcast, subscribe, unsubscribe } from './olympus-ws.js';
import { killAll, cleanup } from './processTracker.js';
import { classifyRequest, runB3C } from './b3c.js';
import { runDirect } from './direct.js';
import { runDirectGaia } from './gaia.js';
import { callZeus } from './agentCalls.js';

// ── Concurrency limits ────────────────────────────────────────────────────────
const TIER_LIMITS = {
  TIER_1: 3,
  TIER_2: 2,
  TIER_3: 1,
  DIRECT: 3,
};

// ── State ─────────────────────────────────────────────────────────────────────
const pending     = [];         // missions waiting to run
const running     = new Map();  // id → { mission }
const cancelledIds = new Set(); // ids marked cancelled

// ── Helpers ───────────────────────────────────────────────────────────────────

function effectiveTier(mission) {
  return mission.tier; // TIER_1 | TIER_2 | TIER_3 | DIRECT
}

function runningCount(tier) {
  let n = 0;
  for (const [, entry] of running) {
    if (effectiveTier(entry.mission) === tier) n++;
  }
  return n;
}

function hasOpenSlot(tier) {
  return runningCount(tier) < (TIER_LIMITS[tier] ?? TIER_LIMITS.DIRECT);
}

// Find index of next pending mission that has an open slot
function nextEligibleIndex() {
  for (let i = 0; i < pending.length; i++) {
    if (hasOpenSlot(effectiveTier(pending[i]))) return i;
  }
  return -1;
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

function broadcastQueue() {
  const queue = [
    ...pending.map((m, i) => ({
      id:       m.id,
      position: i + 1,
      tier:     m.tier,
      userId:   m.userId ?? null,
      text:     m.text.slice(0, 60),
      target:   m.target,
      priority: m.priority,
      status:   'pending',
    })),
    ...[...running.values()].map(({ mission: m }) => ({
      id:       m.id,
      position: 0,
      tier:     m.tier,
      userId:   m.userId ?? null,
      text:     m.text.slice(0, 60),
      target:   m.target,
      priority: m.priority,
      status:   'running',
    })),
  ];
  broadcast({ type: 'queue_update', queue });
}

// ── Priority evaluation ───────────────────────────────────────────────────────

async function zeusEvalPriority(newMission) {
  if (pending.length === 0) return 'JUMP';
  const queueSummary = pending.slice(0, 6).map((m, i) =>
    `${i + 1}. [${m.tier}] "${m.text.slice(0, 80)}" (${m.userId ?? 'unknown'})`
  ).join('\n');

  try {
    const response = await callZeus(
      `You are Zeus. A PRIORITY mission has been submitted. Evaluate whether it should jump to the front of the queue or join normally.

NEW PRIORITY REQUEST:
"${newMission.text.slice(0, 200)}"
User: ${newMission.userId ?? 'unknown'}

CURRENT QUEUE:
${queueSummary}

Respond with exactly one word: JUMP or QUEUE`
    );
    return response.trim().toUpperCase().startsWith('JUMP') ? 'JUMP' : 'QUEUE';
  } catch {
    return 'QUEUE';
  }
}

// Zeus reviews the full queue and may reorder
async function zeusReviewQueue() {
  if (pending.length < 2) return;

  const queueSummary = pending.map((m, i) =>
    `${i + 1}. [${m.tier}] [${m.priority ? 'PRIORITY' : 'normal'}] "${m.text.slice(0, 80)}" (${m.userId ?? 'unknown'})`
  ).join('\n');

  let response;
  try {
    response = await callZeus(
      `You are Zeus, reviewing the mission queue. You may reorder if you see a better sequence based on urgency, complexity, or strategic value. Leave it as-is if the order is fine.

CURRENT QUEUE:
${queueSummary}

If reordering: respond with REORDER: [comma-separated position numbers in new order] then REASON: [one sentence]
If no change: respond with NO_CHANGE

Example: REORDER: 3,1,2\nREASON: Mission 3 is time-sensitive.`
    );
  } catch {
    return;
  }

  if (!response || response.includes('NO_CHANGE') || !response.includes('REORDER:')) return;

  const reorderMatch = response.match(/REORDER:\s*([\d,\s]+)/);
  const reasonMatch  = response.match(/REASON:\s*(.+)/);
  if (!reorderMatch) return;

  const newOrder = reorderMatch[1]
    .split(',')
    .map(s => parseInt(s.trim()) - 1)
    .filter(i => i >= 0 && i < pending.length);

  if (newOrder.length !== pending.length) return;
  const seen = new Set(newOrder);
  if (seen.size !== pending.length) return;

  const reordered = newOrder.map(i => pending[i]);
  pending.length = 0;
  pending.push(...reordered);

  const reason = reasonMatch ? reasonMatch[1].trim() : 'Zeus reorganized the queue.';
  broadcast({ type: 'queue_reorder', reason });
  broadcastQueue();
  console.log(`[Queue] Zeus reordered: ${reason}`);
}

// ── Execution ─────────────────────────────────────────────────────────────────

function releaseSlot(id) {
  running.delete(id);
  cleanup(id);
  if (!cancelledIds.has(id)) {
    broadcastQueue();
    drainQueue();
  }
}

function startMission(mission) {
  const { id, tier, target, text, channel, userId, messages } = mission;

  running.set(id, { mission });
  broadcastQueue();

  // The slot is released ONLY when request_complete fires for this mission.
  // broadcast() calls subscribers synchronously, so this fires at the exact
  // moment request_complete is emitted — not before, not after.
  const onComplete = (event) => {
    if (event.type !== 'request_complete' || event.id !== id) return;
    unsubscribe(onComplete);
    releaseSlot(id);
  };
  subscribe(onComplete);

  let promise;
  if (target === 'gaia') {
    promise = runDirectGaia(id, text, channel, userId ?? null, messages ?? null);
  } else if (target === 'poseidon') {
    promise = runDirect('poseidon', id, text, channel);
  } else if (target === 'hades') {
    promise = runDirect('hades', id, text, channel);
  } else if (text.toUpperCase().startsWith('ZEUS PROTOCOL')) {
    const stripped = text.replace(/^ZEUS PROTOCOL[:\s]*/i, '').trim();
    promise = runDirect('zeus', id, stripped, channel);
  } else {
    // B3C — pass pre-classified tier to skip re-classification
    promise = runB3C(id, text, channel, tier, userId ?? null);
  }

  // Error fallback: if the pipeline throws before emitting request_complete
  // (e.g. SSH failure, agent timeout), clean up the slot so the queue
  // doesn't stall forever. Also broadcast request_complete so the dashboard
  // can mark the mission as failed rather than leaving it stuck as "active".
  promise.catch(err => {
    unsubscribe(onComplete);
    if (!cancelledIds.has(id)) {
      console.error(`[Queue] Mission ${id} failed:`, err.message);
      broadcast({
        type:    'request_complete',
        id,
        elapsed: 0,
        output:  `⚠️ Mission failed: ${err.message}`,
        channel,
        error:   true,
      });
      releaseSlot(id);
    }
  });
}

function drainQueue() {
  let idx;
  while ((idx = nextEligibleIndex()) !== -1) {
    if (cancelledIds.has(pending[idx].id)) {
      pending.splice(idx, 1);
      continue;
    }
    const mission = pending.splice(idx, 1)[0];
    startMission(mission);
    broadcastQueue();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Enqueue a mission. For B3C targets, pre-classifies tier first.
 * @param {object} mission — { id, text, channel, target, userId, isWarRoom, priority }
 */
export async function enqueue(mission) {
  const { id, text, channel, target, userId, isWarRoom, priority, messages } = mission;

  // Determine tier
  let tier;
  const isDirect =
    target === 'poseidon' || target === 'hades' || target === 'gaia' ||
    text.toUpperCase().startsWith('ZEUS PROTOCOL');

  if (isDirect) {
    tier = 'DIRECT';
  } else {
    // B3C: pre-classify so queue slot is accurate
    try {
      tier = await classifyRequest(text);
    } catch {
      tier = 'TIER_3';
    }
    // Bail if cancelled during classification
    if (cancelledIds.has(id)) return;
    broadcast({ type: 'tier_classified', id, tier });
    console.log(`[Queue] ${id} classified as ${tier}`);
  }

  const entry = {
    id, tier, text, channel, target,
    userId:    userId ?? null,
    isWarRoom: isWarRoom ?? false,
    priority:  priority ?? false,
    messages:  messages ?? null,
    timestamp: Date.now(),
  };

  // If slot is open and nothing pending, start immediately
  if (hasOpenSlot(tier) && pending.length === 0) {
    startMission(entry);
    broadcastQueue();
    return;
  }

  // Priority: ask Zeus whether to jump
  if (priority && pending.length > 0) {
    const decision = await zeusEvalPriority(entry);
    if (cancelledIds.has(id)) return;
    if (decision === 'JUMP') {
      pending.unshift(entry);
    } else {
      pending.push(entry);
    }
  } else {
    pending.push(entry);
  }

  broadcastQueue();

  // Zeus reviews queue asynchronously (non-blocking)
  zeusReviewQueue().catch(() => {});

  // Drain — a slot may be open for this tier even with other tiers queued
  drainQueue();
}

/**
 * Cancel a mission. Kills SSH processes if running; removes from queue if pending.
 * @param {string} id
 * @returns {{ ok: boolean, was?: string, killed?: number, reason?: string }}
 */
export function cancelMission(id) {
  cancelledIds.add(id);

  // Pending — remove from queue
  const pidx = pending.findIndex(m => m.id === id);
  if (pidx !== -1) {
    pending.splice(pidx, 1);
    broadcast({ type: 'mission_cancelled', id, wasRunning: false });
    broadcastQueue();
    return { ok: true, was: 'pending' };
  }

  // Running — kill processes
  if (running.has(id)) {
    const killed = killAll(id);
    broadcast({ type: 'mission_cancelled', id, wasRunning: true, processesKilled: killed });
    running.delete(id);
    cleanup(id);
    broadcastQueue();
    drainQueue();
    return { ok: true, was: 'running', killed };
  }

  return { ok: false, reason: 'not found' };
}

/**
 * Get a snapshot of the current queue state.
 */
export function getQueue() {
  return {
    pending: pending.map((m, i) => ({ ...m, position: i + 1, status: 'pending' })),
    running: [...running.values()].map(({ mission: m }) => ({ ...m, position: 0, status: 'running' })),
  };
}
