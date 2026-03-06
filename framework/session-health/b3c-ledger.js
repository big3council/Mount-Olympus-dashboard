/**
 * B3C Ledger — Session tracking, cost accounting, and alert dispatch
 *
 * Pricing: Anthropic claude-sonnet-4-6
 *   Input:  $3.00 / 1M tokens
 *   Output: $15.00 / 1M tokens
 *
 * Ledger path: ~/.openclaw/state/b3c-ledger.json
 * Framework-owned. Agents do not write to this directly.
 *
 * Converted from b3c-ledger.ts (TypeScript → ESM JavaScript)
 */

import fs from 'fs';
import path from 'path';

// ─── Default sessions ─────────────────────────────────────────────────────────

const SESSION_IDS = ['b3c-zeus', 'b3c-poseidon', 'b3c-hades', 'b3c-gaia'];

function emptySession(id) {
  return {
    id,
    startDate: null,
    totalCalls: 0,
    rollup: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      avgCostPerCallUSD: 0,
      peakContextPCT: 0,
      compactions: 0,
      resets: 0,
    },
    recentCalls: [],
    alertHistory: [],
  };
}

function defaultLedger() {
  const now = new Date().toISOString();
  return {
    version: '1.1',
    metadata: {
      created: now,
      lastUpdated: now,
      currency: 'USD',
      pricingModel: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        inputCostPer1M: 3.0,
        outputCostPer1M: 15.0,
      },
    },
    sessions: Object.fromEntries(SESSION_IDS.map((id) => [id, emptySession(id)])),
    councilRollup: {
      totalCostUSD: 0,
      costPerDayUSD: 0,
      projections: { week: 0, month: 0 },
    },
    deliberationLock: {
      active: false,
      engagedAt: null,
      lastEngaged: null,
      lastReleased: null,
      pendingResets: [],
    },
    pendingActions: [],
    alerts: [],
  };
}

// ─── B3CLedger ────────────────────────────────────────────────────────────────

export class B3CLedger {
  constructor(ledgerPath) {
    this.ledgerPath = path.resolve(ledgerPath.replace('~', process.env.HOME ?? ''));
  }

  // ─── Read / Write ──────────────────────────────────────────────────────────

  _read() {
    try {
      if (!fs.existsSync(this.ledgerPath)) {
        return defaultLedger();
      }
      const raw = fs.readFileSync(this.ledgerPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      console.warn('[B3C Ledger] Corrupted ledger detected — reinitializing');
      return defaultLedger();
    }
  }

  _write(ledger) {
    ledger.metadata.lastUpdated = new Date().toISOString();
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.ledgerPath, JSON.stringify(ledger, null, 2), 'utf-8');
  }

  // ─── Session State ─────────────────────────────────────────────────────────

  async getSession(sessionId) {
    const ledger = this._read();
    return ledger.sessions[sessionId] ?? emptySession(sessionId);
  }

  /**
   * Append a call record and update rollup.
   * Returns updated session state.
   */
  async append(sessionId, data) {
    const ledger = this._read();

    if (!ledger.sessions[sessionId]) {
      ledger.sessions[sessionId] = emptySession(sessionId);
    }

    const session = ledger.sessions[sessionId];

    // First call — set start date
    if (!session.startDate) {
      session.startDate = new Date().toISOString();
    }

    const record = {
      timestamp: new Date().toISOString(),
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      costUSD: data.costUSD,
      contextPCT: data.contextPCT,
      action: 'none',
    };

    // Update rollup
    session.totalCalls += 1;
    session.rollup.totalInputTokens += data.inputTokens;
    session.rollup.totalOutputTokens += data.outputTokens;
    session.rollup.totalCostUSD += data.costUSD;
    session.rollup.avgCostPerCallUSD = session.rollup.totalCostUSD / session.totalCalls;
    session.rollup.peakContextPCT = Math.max(session.rollup.peakContextPCT, data.contextPCT);

    // Rolling 50 recent calls
    session.recentCalls.push(record);
    if (session.recentCalls.length > 50) {
      session.recentCalls.shift();
    }

    // Update council rollup
    this._updateCouncilRollup(ledger);

    this._write(ledger);
    return session;
  }

  async recordCompaction(sessionId) {
    const ledger = this._read();
    if (ledger.sessions[sessionId]) {
      ledger.sessions[sessionId].rollup.compactions += 1;
      const calls = ledger.sessions[sessionId].recentCalls;
      if (calls.length > 0) calls[calls.length - 1].action = 'compaction';
    }
    this._write(ledger);
  }

  async recordReset(sessionId, reason) {
    const ledger = this._read();
    if (ledger.sessions[sessionId]) {
      ledger.sessions[sessionId].rollup.resets += 1;
      ledger.sessions[sessionId].startDate = new Date().toISOString();
      const calls = ledger.sessions[sessionId].recentCalls;
      if (calls.length > 0) calls[calls.length - 1].action = 'reset';
    }
    this._write(ledger);
  }

  async logError(sessionId, type, detail) {
    const ledger = this._read();
    console.error(`[B3C Ledger] Error for ${sessionId} [${type}]: ${detail}`);
    this._write(ledger);
  }

  // ─── Deliberation Lock ─────────────────────────────────────────────────────

  async getLockState() {
    return this._read().deliberationLock;
  }

  async setLock(active, sessionId) {
    const ledger = this._read();
    const now = new Date().toISOString();

    if (active) {
      ledger.deliberationLock.active = true;
      ledger.deliberationLock.engagedAt = now;
      ledger.deliberationLock.lastEngaged = now;
    } else {
      ledger.deliberationLock.active = false;
      ledger.deliberationLock.engagedAt = null;
      ledger.deliberationLock.lastReleased = now;
    }

    this._write(ledger);
  }

  // ─── Pending Actions ───────────────────────────────────────────────────────

  async queuePendingAction(sessionId, type, reason = 'deferred') {
    const ledger = this._read();
    ledger.pendingActions.push({ type, sessionId, reason, queuedAt: new Date().toISOString() });
    this._write(ledger);
  }

  async queuePendingReset(sessionId, reason) {
    return this.queuePendingAction(sessionId, 'reset', reason);
  }

  async getPendingActions() {
    return this._read().pendingActions ?? [];
  }

  async clearPendingActions() {
    const ledger = this._read();
    ledger.pendingActions = [];
    this._write(ledger);
  }

  // ─── Alerts ────────────────────────────────────────────────────────────────

  async sendAlert(sessionId, type, contextPCT, telegramChatId) {
    const ledger = this._read();
    const record = {
      timestamp: new Date().toISOString(),
      type,
      sessionId,
      contextPCT,
      actionTaken: type === 'critical' ? 'escalation' : 'compaction',
    };
    ledger.alerts.push(record);
    if (ledger.sessions[sessionId]) {
      ledger.sessions[sessionId].alertHistory.push(record);
    }
    this._write(ledger);

    // Telegram notification (non-blocking)
    const emoji = type === 'critical' ? '🔴' : type === 'alert' ? '⚠️' : '👀';
    const msg = `${emoji} B3C Session Alert\nSession: ${sessionId}\nContext: ${contextPCT.toFixed(1)}%\nLevel: ${type.toUpperCase()}\nAction: ${record.actionTaken}`;
    this._sendTelegramAlert(telegramChatId, msg).catch((e) =>
      console.warn('[B3C Ledger] Telegram alert failed:', e)
    );
  }

  async _sendTelegramAlert(chatId, message) {
    // Delegates to OpenClaw gateway message routing
    // Stub — actual routing via framework's message plugin
    console.log(`[B3C Alert → Telegram ${chatId}]: ${message}`);
  }

  // ─── Council Rollup ────────────────────────────────────────────────────────

  _updateCouncilRollup(ledger) {
    let total = 0;
    for (const session of Object.values(ledger.sessions)) {
      total += session.rollup.totalCostUSD;
    }

    // Estimate daily cost from rolling 24h of recent calls
    const dayMs = 86_400_000;
    const cutoff = Date.now() - dayMs;
    let dailyCost = 0;
    for (const session of Object.values(ledger.sessions)) {
      for (const call of session.recentCalls) {
        if (new Date(call.timestamp).getTime() > cutoff) {
          dailyCost += call.costUSD;
        }
      }
    }

    ledger.councilRollup.totalCostUSD = total;
    ledger.councilRollup.costPerDayUSD = dailyCost;
    ledger.councilRollup.projections = {
      week: dailyCost * 7 * 1.1,
      month: dailyCost * 30 * 1.1,
    };
  }
}
