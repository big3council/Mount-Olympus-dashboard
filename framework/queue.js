/**
 * queue.js — Unified mission queue with smart concurrency.
 *
 * Concurrency model:
 *   TIER_1: always runs immediately — no queue, no acknowledgment
 *   TIER_2: share ONE council slot — one at a time
 *   DIRECT: 3 concurrent (zeus_protocol, poseidon, hades, gaia)
 *
 * When a TIER_2 mission cannot start immediately, it is queued
 * and Zeus sends an instant acknowledgment with queue position + estimated wait.
 * Zeus also reviews the full queue after every new addition and may reorder.
 */

import { broadcast, subscribe, unsubscribe } from './olympus-ws.js';
import { killAll, cleanup } from './processTracker.js';
import { runB3C } from './b3c.js';
import { classifyJob } from './classifier.js';
import { runDirect } from './direct.js';
import { runDirectGaia } from './gaia.js';
import { callZeus } from './gateway.js';

// ── Concurrency limits ────────────────────────────────────────────────────────
const COUNCIL_LIMIT = 1;  // TIER_2 share one council slot
const DIRECT_LIMIT  = 3;  // poseidon, hades, gaia, ZEUS PROTOCOL

// ── State ─────────────────────────────────────────────────────────────────────
const pending     = [];         // missions waiting to run
const running     = new Map();  // id → { mission }
const cancelledIds = new Set(); // ids marked cancelled

// ── Helpers ───────────────────────────────────────────────────────────────────

function effectiveTier(mission) {
  return mission.tier; // TIER_1 | TIER_2 | DIRECT
}

function runningCount(tier) {
  let n = 0;
  for (const [, entry] of running) {
    if (effectiveTier(entry.mission) === tier) n++;
  }
  return n;
}

// Count of T2/TIER_2 missions currently running (share one council slot)
function councilRunningCount() {
  let n = 0;
  for (const [, entry] of running) {
    const t = effectiveTier(entry.mission);
    if (t === 'T2' || t === 'TIER_2') n++;
  }
  return n;
}

function hasOpenSlot(tier) {
  if (tier === 'T1' || tier === 'TIER_1') return true;        // always instant
  if (tier === 'DIRECT') return runningCount('DIRECT') < DIRECT_LIMIT;
  return councilRunningCount() < COUNCIL_LIMIT;               // T2/TIER_2 share
}

// Find index of next pending mission that has an open slot.
// For TIER_2: only one council slot exists — pick the first eligible one.
function nextEligibleIndex() {
  for (let i = 0; i < pending.length; i++) {
    if (hasOpenSlot(effectiveTier(pending[i]))) return i;
  }
  return -1;
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

function broadcastQueue() {
  // Track how many council missions are ahead as we iterate pending
  let councilAhead = councilRunningCount(); // missions running ahead of first pending

  const pendingItems = pending.map((m, i) => {
    let estimatedWait;
    if (m.tier === 'TIER_2') {
      const avgMin = 8;
      estimatedWait = `~${councilAhead * avgMin} min`;
      councilAhead++;
    }
    return {
      id:       m.id,
      position: i + 1,
      tier:     m.tier,
      userId:   m.userId ?? null,
      text:     m.text.slice(0, 60),
      target:   m.target,
      priority: m.priority,
      status:   'pending',
      ...(estimatedWait ? { estimatedWait } : {}),
    };
  });

  const runningItems = [...running.values()].map(({ mission: m }) => ({
    id:       m.id,
    position: 0,
    tier:     m.tier,
    userId:   m.userId ?? null,
    text:     m.text.slice(0, 60),
    target:   m.target,
    priority: m.priority,
    status:   'running',
  }));

  broadcast({ type: 'queue_update', queue: [...pendingItems, ...runningItems] });
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
  const { id, tier, target, text, channel, userId, messages, agent } = mission;

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
    promise = runDirect('poseidon', id, text, channel, userId ?? null);
  } else if (target === 'hades') {
    promise = runDirect('hades', id, text, channel, userId ?? null);
  } else if (text.toUpperCase().startsWith('ZEUS PROTOCOL')) {
    const stripped = text.replace(/^ZEUS PROTOCOL[:\s]*/i, '').trim();
    promise = runDirect('zeus', id, stripped, channel, userId ?? null);
  } else {
    // B3C — pass pre-classified tier + agent to skip re-classification
    promise = runB3C(id, text, channel, tier, userId ?? null, agent);
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

  let agent = null;

  if (isDirect) {
    tier = 'DIRECT';
  } else {
    // B3C: 2-tier classification via Haiku
    try {
      const classification = await classifyJob(text, { userId });
      tier = classification.tier;   // 'T1' or 'T2'
      agent = classification.agent; // 'zeus', 'poseidon', 'hades', or null
    } catch {
      tier = 'T2';
    }
    // Bail if cancelled during classification
    if (cancelledIds.has(id)) return;
    // Map to legacy tier name for dashboard
    const dashTier = tier === 'T1' ? 'TIER_1' : 'TIER_2';
    broadcast({ type: 'tier_classified', id, tier: dashTier });
    console.log(`[Queue] ${id} classified as ${tier}${agent ? ' → ' + agent : ''}`);
  }

  const entry = {
    id, tier, text, channel, target, agent,
    userId:    userId ?? null,
    isWarRoom: isWarRoom ?? false,
    priority:  priority ?? false,
    messages:  messages ?? null,
    timestamp: Date.now(),
  };

  // ── T1: always runs immediately, no queue, no acknowledgment ──────────────
  if (tier === 'T1') {
    startMission(entry);
    broadcastQueue();
    return;
  }

  // ── DIRECT: existing concurrency slot model ────────────────────────────────
  if (tier === 'DIRECT') {
    if (hasOpenSlot('DIRECT') && pending.length === 0) {
      startMission(entry);
      broadcastQueue();
      return;
    }
    pending.push(entry);
    broadcastQueue();
    drainQueue();
    return;
  }

  // ── T2 / TIER_2: shared council slot ─────────────────────────────
  // Start immediately only if the council slot is free AND no council missions
  // are already pending (fairness — don't skip the queue).
  const councilPendingCount = pending.filter(
    m => m.tier === 'T2' || m.tier === 'TIER_2'
  ).length;

  if (councilRunningCount() < COUNCIL_LIMIT && councilPendingCount === 0) {
    startMission(entry);
    broadcastQueue();
    return;
  }

  // Council slot is full or other missions ahead — queue it and send ack.
  pending.push(entry);

  // Compute queue position and estimated wait for the acknowledgment.
  const queuePosition = councilPendingCount + 1;  // 1-indexed in council queue
  const councilAhead  = councilRunningCount() + councilPendingCount; // missions before this one
  const avgMin        = 8;
  const estimatedMin  = councilAhead * avgMin;
  const estimatedWait = `~${estimatedMin} min`;
  const ackText       = `Got it — you're #${queuePosition} in queue. Estimated wait: ${estimatedWait}. I'll have the council on it shortly.`;

  broadcast({ type: 'queue_ack', id, userId: userId ?? null, channel, target, ackText, queuePosition, estimatedWait });
  broadcastQueue();

  // Zeus reviews queue asynchronously (non-blocking)
  zeusReviewQueue().catch(() => {});

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
