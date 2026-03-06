/**
 * B3C Council — Domain-Aware Compaction Prompts
 * 
 * Production config. Import and pass to your compaction trigger.
 * Each prompt is tailored to preserve the domain-specific reasoning
 * that makes each council member distinct. Generic summarization
 * flattens all agents toward the same output — these prompts prevent that.
 * 
 * Usage:
 *   import { COMPACTION_PROMPTS } from './b3c-compaction-prompts';
 *   const prompt = COMPACTION_PROMPTS[sessionId];
 *   await triggerCompaction(sessionId, prompt);
 */

export type B3CSessionId = 'b3c-zeus' | 'b3c-poseidon' | 'b3c-hades' | 'b3c-gaia';

export const COMPACTION_PROMPTS: Record<B3CSessionId, string> = {

  'b3c-zeus': `You are compacting the context for Zeus, the B3C Council's Spiritual/Intellectual guardian.

PRESERVE with high fidelity:
- Strategic framing: the "why" behind any major decision or architectural commitment made in this session
- Open philosophical tensions or unresolved questions that have been raised but not answered
- Values or principles the council has explicitly affirmed or tested under pressure
- The reasoning chain behind any council position, not just the conclusion
- Any requests from Carson or Tyler that carry long-term implications
- Questions deferred to a future session

COMPRESS aggressively:
- Routine status exchanges and confirmations
- Logistical coordination already captured in workspace files
- Exploratory reasoning that reached a resolved conclusion (keep the conclusion, discard the path)
- Repeated restatements of positions already established

FORMAT: Produce a structured summary with sections:
[Decisions & Rationale] [Open Questions] [Affirmed Values] [Deferred Items]`,

  'b3c-poseidon': `You are compacting the context for Poseidon, the B3C Council's Financial/Social navigator.

PRESERVE with high fidelity:
- Relational history: how Carson and the principals engage with specific topics, decisions, or agents
- Creative and social framing decisions that have been established (voice, tone, approach)
- Economic commitments, cost decisions, and their stated rationale
- Creative directions explored and why they were accepted or abandoned
- Social dynamics or tensions observed in council interactions
- Any feedback from Carson on quality, style, or approach

COMPRESS aggressively:
- Draft iterations superseded by final versions
- Cost explorations where a final figure was confirmed
- Resolved social coordination issues
- Speculative financial projections that were not adopted

FORMAT: Produce a structured summary with sections:
[Relational Context] [Economic Commitments] [Voice & Style Decisions] [Social Dynamics] [Deferred Items]`,

  'b3c-hades': `You are compacting the context for Hades, the B3C Council's Technical/Operational builder.

PRESERVE with high fidelity:
- Infrastructure decisions and the technical rationale behind each one
- Architectural commitments that constrain or shape future implementation choices
- Known failure modes identified and their mitigations
- Precise state of active projects: what was built, what was attempted, what remains
- Open technical questions with no resolution yet
- Configuration values, file paths, schema versions, and implementation parameters confirmed in this session
- Explicit instructions from Carson on implementation constraints or requirements

COMPRESS aggressively:
- Debugging trails that reached a resolved conclusion (keep the fix, discard the process)
- Implementation approaches that were rejected in favor of the current approach
- Exploratory architecture paths not taken
- Repeated restatements of resolved technical decisions

FORMAT: Produce a structured summary with sections:
[Architecture Decisions] [Active Project State] [Known Failure Modes] [Open Technical Questions] [Configuration Confirmed] [Deferred Items]`,

  'b3c-gaia': `You are compacting the context for Gaia, the B3C Council's Integrative/Systemic voice.

PRESERVE with high fidelity:
- Cross-domain coherence patterns: where council domains aligned or diverged and why
- Unresolved tensions between council members or domains that require future attention
- Systemic health signals observed across the council as a whole
- Integration points between framework layers that have been identified or are at risk
- Flags raised by any council member that have not been fully addressed
- Patterns in how the council reasons together: strengths, blind spots, recurring friction

COMPRESS aggressively:
- Single-domain discussions fully resolved within that domain
- Coordination logistics already captured in other agents' state files
- Resolved integration issues where both domains reached agreement

FORMAT: Produce a structured summary with sections:
[Cross-Domain Patterns] [Unresolved Tensions] [Systemic Health Signals] [Integration Flags] [Deferred Items]`,

};

/**
 * STATE-WRITE DIRECTIVE
 * 
 * Send this to any B3C agent before triggering compaction or reset.
 * The agent must commit its current state to workspace files before
 * the session context is compressed or cleared.
 */
export const STATE_WRITE_DIRECTIVE = `Before this session is compacted or reset, write your current state to your workspace memory files now. This includes:
- Any decisions made or rationale established in this session not yet captured in files
- Open questions or unresolved items
- Project state changes
- Any instructions or context from Carson that should persist

Write to your memory files before acknowledging. Confirmation required.`;

/**
 * COMPACTION TRIGGER HELPER
 * 
 * Example integration pattern for your framework dispatch layer:
 * 
 *   async function triggerProactiveCompaction(sessionId: B3CSessionId, gateway: OpenClawGateway) {
 *     // Step 1: State write
 *     await gateway.send(sessionId, STATE_WRITE_DIRECTIVE);
 *     await gateway.waitForAck(sessionId);
 *     
 *     // Step 2: Compact with domain prompt
 *     const prompt = COMPACTION_PROMPTS[sessionId];
 *     await gateway.compact(sessionId, prompt);
 *     
 *     // Step 3: Verify post-compaction utilization
 *     const status = await gateway.sessionStatus(sessionId);
 *     if (status.contextPCT > 40) {
 *       console.warn(`[B3C] Post-compaction context still high: ${status.contextPCT}% for ${sessionId}`);
 *     }
 *   }
 */
