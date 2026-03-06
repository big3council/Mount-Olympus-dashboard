/**
 * B3C Ledger — Session tracking, cost accounting, and alert dispatch
 *
 * Pricing: Anthropic claude-sonnet-4-6
 *   Input:  $3.00 / 1M tokens
 *   Output: $15.00 / 1M tokens
 *
 * Ledger path: ~/.openclaw/state/b3c-ledger.json
 * Framework-owned. Agents do not write to this directly.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface CallRecord {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  contextPCT: number;
  action: 'none' | 'compaction' | 'reset';
}

export interface SessionRollup {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  avgCostPerCallUSD: number;
  peakContextPCT: number;
  compactions: number;
  resets: number;
}

export interface SessionRecord {
  id: string;
  startDate: string | null;
  totalCalls: number;
  rollup: SessionRollup;
  recentCalls: CallRecord[]; // rolling 50
  alertHistory: AlertRecord[];
}

export interface AlertRecord {
  timestamp: string;
  type: 'watch' | 'alert' | 'critical';
  sessionId: string;
  contextPCT: number;
  actionTaken: string;
}

export interface PendingAction {
  type: 'compaction' | 'reset';
  sessionId: string;
  reason: string;
  queuedAt: string;
}

export interface LockState {
  active: boolean;
  engagedAt: string | null;
  lastEngaged: string | null;
  lastReleased: string | null;
  pendingResets: PendingAction[];
}

export interface LedgerSchema {
  version: string;
  metadata: {
    created: string;
    lastUpdated: string;
    currency: string;
    pricingModel: {
      provider: string;
      model: string;
      inputCostPer1M: number;
      outputCostPer1M: number;
    };
  };
  sessions: Record<string, SessionRecord>;
  councilRollup: {
    totalCostUSD: number;
    costPerDayUSD: number;
    projections: {
      week: number;
      month: number;
    };
  };
  deliberationLock: LockState;
  pendingActions: PendingAction[];
  alerts: AlertRecord[];
}

// ─── Default sessions ─────────────────────────────────────────────────────────

const SESSION_IDS = ['b3c-zeus', 'b3c-poseidon', 'b3c-hades', 'b3c-gaia'] as const;

function emptySession(id: string): SessionRecord {
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

function defaultLedger(): LedgerSchema {
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
  private ledgerPath: string;

  constructor(ledgerPath: string) {
    this.ledgerPath = path.resolve(ledgerPath.replace('~', process.env.HOME ?? ''));
  }

  // ─── Read / Write ──────────────────────────────────────────────────────────

  private read(): LedgerSchema {
    try {
      if (!fs.existsSync(this.ledgerPath)) {
        return defaultLedger();
      }
      const raw = fs.readFileSync(this.ledgerPath, 'utf-8');
      return JSON.parse(raw) as LedgerSchema;
    } catch {
      console.warn('[B3C Ledger] Corrupted ledger detected — reinitializing');
      return defaultLedger();
    }
  }

  private write(ledger: LedgerSchema): void {
    ledger.metadata.lastUpdated = new Date().toISOString();
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.ledgerPath, JSON.stringify(ledger, null, 2), 'utf-8');
  }

  // ─── Session State ─────────────────────────────────────────────────────────

  async getSession(sessionId: string): Promise<SessionRecord> {
    const ledger = this.read();
    return ledger.sessions[sessionId] ?? emptySession(sessionId);
  }

  /**
   * Append a call record and update rollup.
   * Returns updated session state.
   */
  async append(
    sessionId: string,
    data: { inputTokens: number; outputTokens: number; costUSD: number; contextPCT: number }
  ): Promise<SessionRecord> {
    const ledger = this.read();

    if (!ledger.sessions[sessionId]) {
      ledger.sessions[sessionId] = emptySession(sessionId);
    }

    const session = ledger.sessions[sessionId];

    // First call — set start date
    if (!session.startDate) {
      session.startDate = new Date().toISOString();
    }

    const record: CallRecord = {
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
    this.updateCouncilRollup(ledger);

    this.write(ledger);
    return session;
  }

  async recordCompaction(sessionId: string): Promise<void> {
    const ledger = this.read();
    if (ledger.sessions[sessionId]) {
      ledger.sessions[sessionId].rollup.compactions += 1;
      // Mark last call as compaction action
      const calls = ledger.sessions[sessionId].recentCalls;
      if (calls.length > 0) calls[calls.length - 1].action = 'compaction';
    }
    this.write(ledger);
  }

  async recordReset(sessionId: string, reason: string): Promise<void> {
    const ledger = this.read();
    if (ledger.sessions[sessionId]) {
      ledger.sessions[sessionId].rollup.resets += 1;
      ledger.sessions[sessionId].startDate = new Date().toISOString();
      // Mark last call
      const calls = ledger.sessions[sessionId].recentCalls;
      if (calls.length > 0) calls[calls.length - 1].action = 'reset';
    }
    this.write(ledger);
  }

  async logError(sessionId: string, type: string, detail: string): Promise<void> {
    const ledger = this.read();
    console.error(`[B3C Ledger] Error for ${sessionId} [${type}]: ${detail}`);
    this.write(ledger);
  }

  // ─── Deliberation Lock ─────────────────────────────────────────────────────

  async getLockState(): Promise<LockState> {
    return this.read().deliberationLock;
  }

  async setLock(active: boolean, sessionId: string | null): Promise<void> {
    const ledger = this.read();
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

    this.write(ledger);
  }

  // ─── Pending Actions ───────────────────────────────────────────────────────

  async queuePendingAction(sessionId: string, type: 'compaction' | 'reset', reason = 'deferred'): Promise<void> {
    const ledger = this.read();
    ledger.pendingActions.push({ type, sessionId, reason, queuedAt: new Date().toISOString() });
    this.write(ledger);
  }

  async queuePendingReset(sessionId: string, reason: string): Promise<void> {
    return this.queuePendingAction(sessionId, 'reset', reason);
  }

  async getPendingActions(): Promise<PendingAction[]> {
    return this.read().pendingActions;
  }

  async clearPendingActions(): Promise<void> {
    const ledger = this.read();
    ledger.pendingActions = [];
    this.write(ledger);
  }

  // ─── Alerts ────────────────────────────────────────────────────────────────

  async sendAlert(
    sessionId: string,
    type: 'watch' | 'alert' | 'critical',
    contextPCT: number,
    telegramChatId: string
  ): Promise<void> {
    const ledger = this.read();
    const record: AlertRecord = {
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
    this.write(ledger);

    // Telegram notification (non-blocking)
    const emoji = type === 'critical' ? '🔴' : type === 'alert' ? '⚠️' : '👀';
    const msg = `${emoji} B3C Session Alert\nSession: ${sessionId}\nContext: ${contextPCT.toFixed(1)}%\nLevel: ${type.toUpperCase()}\nAction: ${record.actionTaken}`;
    this.sendTelegramAlert(telegramChatId, msg).catch((e) =>
      console.warn('[B3C Ledger] Telegram alert failed:', e)
    );
  }

  private async sendTelegramAlert(chatId: string, message: string): Promise<void> {
    // Delegates to OpenClaw gateway message routing
    // In production: POST to gateway /messages endpoint
    // Stub here — actual routing via framework's message plugin
    console.log(`[B3C Alert → Telegram ${chatId}]: ${message}`);
  }

  // ─── Council Rollup ────────────────────────────────────────────────────────

  private updateCouncilRollup(ledger: LedgerSchema): void {
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
      week: dailyCost * 7 * 1.1, // 10% growth factor
      month: dailyCost * 30 * 1.1,
    };
  }
}
