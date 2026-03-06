/**
 * B3C Session Health Engine
 * Layer 1: Context Budget Monitor
 * Layer 2: Domain-Aware Proactive Compaction
 * Layer 3: Clean Reset with Continuity Injection
 *
 * Built per spec: memory/olympus/working/b3c-session-health-spec.md
 * Author: Zeus (standing in for Hades after repeated agent failures)
 * Model: anthropic/claude-sonnet-4-6 | Pricing: $3.00/$15.00 per 1M tokens
 *
 * Converted from b3c-session-health.ts (TypeScript → ESM JavaScript)
 */

import { COMPACTION_PROMPTS, STATE_WRITE_DIRECTIVE } from './b3c-compaction-prompts.js';
import { B3CLedger } from './b3c-ledger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  compactionPCT: 60,
  alertPCT: 75,
  criticalPCT: 85,
  resetCompactions: 3,
  resetPostCompactionPCT: 50,
  resetMinAgeHours: 24,
  resetMinUtilizationPCT: 40,
  lockTimeoutMs: 120_000,
};

// ─── Core Engine ──────────────────────────────────────────────────────────────

export class B3CSessionHealthEngine {
  constructor(config) {
    this.ledger = new B3CLedger(config.ledgerPath);
    this.config = config;
    this.thresholds = { ...DEFAULTS, ...(config.thresholds ?? {}) };
  }

  /**
   * PRIMARY INTEGRATION POINT — Layer 1
   * Call this after every framework dispatch, passing the API token usage.
   */
  async postCall(sessionId, usage) {
    const contextPCT = (usage.promptTokens / usage.contextWindowSize) * 100;
    const costUSD =
      (usage.promptTokens / 1_000_000) * 3.0 +
      (usage.completionTokens / 1_000_000) * 15.0;

    // Append to ledger
    const sessionState = await this.ledger.append(sessionId, {
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      costUSD,
      contextPCT,
    });

    // Evaluate thresholds
    if (contextPCT >= this.thresholds.criticalPCT) {
      await this.handleCritical(sessionId, contextPCT, sessionState.rollup.compactions);
    } else if (contextPCT >= this.thresholds.alertPCT) {
      await this.handleAlert(sessionId, contextPCT);
    } else if (contextPCT >= this.thresholds.compactionPCT) {
      await this.handleSignal(sessionId, contextPCT);
    }

    // Check Layer 3 triggers
    await this.evaluateResetTriggers(sessionId, contextPCT, {
      compactions: sessionState.rollup.compactions,
      startDate: sessionState.startDate,
    });
  }

  // ─── Layer 2: Proactive Compaction ──────────────────────────────────────────

  async handleSignal(sessionId, contextPCT) {
    console.log(`[B3C] Signal: ${sessionId} at ${contextPCT.toFixed(1)}% — triggering proactive compaction`);
    await this.triggerCompaction(sessionId);
  }

  async handleAlert(sessionId, contextPCT) {
    console.warn(`[B3C] Alert: ${sessionId} at ${contextPCT.toFixed(1)}% — forcing compaction + notifying Carson`);
    await this.ledger.sendAlert(sessionId, 'alert', contextPCT, this.config.telegramChatId);
    await this.triggerCompaction(sessionId);
  }

  async handleCritical(sessionId, contextPCT, compactions) {
    console.error(`[B3C] Critical: ${sessionId} at ${contextPCT.toFixed(1)}% — escalating`);
    await this.ledger.sendAlert(sessionId, 'critical', contextPCT, this.config.telegramChatId);
    if (compactions > 0) {
      await this.triggerReset(sessionId, 'critical-post-compaction');
    } else {
      await this.triggerCompaction(sessionId);
    }
  }

  /**
   * Layer 2 core: state-write → compact → verify
   * Respects deliberation lock — defers if locked.
   */
  async triggerCompaction(sessionId) {
    const lockState = await this.ledger.getLockState();

    if (lockState.active) {
      console.log(`[B3C] Compaction deferred — deliberation lock active for ${sessionId}`);
      await this.ledger.queuePendingAction(sessionId, 'compaction');
      return;
    }

    try {
      // Step 1: State write
      await this.gatewayRequest(`/sessions/${sessionId}/send`, {
        message: STATE_WRITE_DIRECTIVE,
      });

      // Step 2: Compact with domain-specific prompt
      const prompt = COMPACTION_PROMPTS[sessionId];
      await this.gatewayRequest(`/sessions/${sessionId}/compact`, {
        instructions: prompt,
      });

      await this.ledger.recordCompaction(sessionId);

      // Step 3: Verify post-compaction utilization
      const status = await this.gatewayRequest(`/sessions/${sessionId}/status`);
      if (status.contextPCT > 40) {
        console.warn(
          `[B3C] Post-compaction context still high: ${status.contextPCT.toFixed(1)}% for ${sessionId}`
        );
      }

      console.log(`[B3C] Compaction complete for ${sessionId}`);
    } catch (err) {
      console.error(`[B3C] Compaction failed for ${sessionId}:`, err);
      await this.ledger.logError(sessionId, 'compaction_failed', String(err));
    }
  }

  // ─── Layer 3: Clean Reset with Continuity Injection ─────────────────────────

  async evaluateResetTriggers(sessionId, contextPCT, sessionState) {
    const { compactions, startDate } = sessionState;
    const thresholds = this.thresholds;

    const compactionReset =
      compactions >= thresholds.resetCompactions &&
      contextPCT > thresholds.resetPostCompactionPCT;

    const ageHours = startDate
      ? (Date.now() - new Date(startDate).getTime()) / 3_600_000
      : 0;
    const timeReset =
      ageHours >= thresholds.resetMinAgeHours &&
      contextPCT > thresholds.resetMinUtilizationPCT;

    if (compactionReset || timeReset) {
      const reason = compactionReset ? 'compaction-cycles' : 'age-utilization';
      await this.triggerReset(sessionId, reason);
    }
  }

  /**
   * Layer 3 core: state-write → /new → verify
   * Mandatory deliberation lock check — queues if locked.
   */
  async triggerReset(sessionId, reason) {
    const lockState = await this.ledger.getLockState();

    if (lockState.active) {
      console.log(`[B3C] Reset deferred — deliberation lock active. Reason: ${reason}`);
      await this.ledger.queuePendingReset(sessionId, reason);
      return;
    }

    console.log(`[B3C] Initiating reset for ${sessionId} — reason: ${reason}`);

    try {
      // Step 1: State write
      await this.gatewayRequest(`/sessions/${sessionId}/send`, {
        message: STATE_WRITE_DIRECTIVE,
      });

      // Step 2: Reset session
      await this.gatewayRequest(`/sessions/${sessionId}/new`, {});

      // Step 3: Verify
      const status = await this.gatewayRequest(`/sessions/${sessionId}/status`);
      if (!status.active) {
        throw new Error('Session not active after reset');
      }

      await this.ledger.recordReset(sessionId, reason);
      console.log(`[B3C] Reset complete for ${sessionId}`);
    } catch (err) {
      console.error(`[B3C] Reset failed for ${sessionId}:`, err);
      await this.ledger.logError(sessionId, 'reset_failed', String(err));
    }
  }

  // ─── Deliberation Lock ───────────────────────────────────────────────────────

  async lockEngage(sessionId) {
    await this.ledger.setLock(true, sessionId);
    console.log(`[B3C] Deliberation lock engaged — ${sessionId}`);
  }

  async lockRelease() {
    await this.ledger.setLock(false, null);
    console.log('[B3C] Deliberation lock released');

    // Execute any pending actions
    const pending = await this.ledger.getPendingActions() ?? [];
    for (const action of pending) {
      if (action.type === 'reset') {
        await this.triggerReset(action.sessionId, 'deferred-' + action.reason);
      } else if (action.type === 'compaction') {
        await this.triggerCompaction(action.sessionId);
      }
    }
    await this.ledger.clearPendingActions();
  }

  // ─── Gateway Helper ──────────────────────────────────────────────────────────

  async gatewayRequest(path, body) {
    const url = `${this.config.gatewayUrl}${path}`;
    const response = await fetch(url, {
      method: body !== undefined ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.gatewayToken}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      throw new Error(`Gateway request failed: ${response.status} ${response.statusText} — ${path}`);
    }

    return response.json();
  }
}

// ─── wrapDispatch ─────────────────────────────────────────────────────────────

/**
 * PRIMARY INTEGRATION SURFACE
 *
 * Wrap your existing dispatch function. All three layers fire automatically.
 * The returned function has the same signature as your original dispatch.
 *
 * @example
 * const managedDispatch = wrapDispatch(myDispatch, {
 *   ledgerPath: '~/.openclaw/state/b3c-ledger.json',
 *   gatewayUrl: 'http://localhost:18789',
 *   gatewayToken: process.env.OPENCLAW_TOKEN,
 *   telegramChatId: '8150818650',
 * });
 */
export function wrapDispatch(dispatch, config) {
  const engine = new B3CSessionHealthEngine(config);

  return async (sessionId, message) => {
    // Engage deliberation lock — best-effort, errors never block dispatch
    await engine.lockEngage(sessionId).catch(err =>
      console.error('[B3C] lockEngage error (non-fatal):', err)
    );

    let result;
    try {
      result = await dispatch(sessionId, message);
    } finally {
      // Release lock as independent side effect — never propagates errors to caller
      engine.lockRelease().catch(err =>
        console.error('[B3C] lockRelease error (non-fatal):', err)
      );
    }

    // Layer 1: ledger append + threshold evaluation (non-blocking side effect)
    if (result && result.usage) {
      engine.postCall(sessionId, result.usage).catch(err =>
        console.error('[B3C] postCall error (non-fatal):', err)
      );
    }

    return result;
  };
}
