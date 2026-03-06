import { broadcast } from './olympus-ws.js';
import { callZeus, callPoseidon, callHades } from './agentCalls.js';
import { observeMission } from './gaia.js';

// ── Classification ────────────────────────────────────────────────────────────
// Strips identity prefix (e.g. "Message from Carson: ") before classifying so
// routing context never inflates the apparent complexity of the request.
export async function classifyRequest(rawInput) {
  const stripped = rawInput.replace(/^Message from [^:]+:\s*/i, '').trim();

  const response = await callZeus(
    `You are the B3C tier classifier. Classify the request below into exactly one tier. Respond with ONLY the label — no explanation, no punctuation, nothing else.

TIER_1 — Greetings, status checks, casual conversation, simple yes/no questions. A single voice handles it completely.
  1. "hey are you there"
  2. "how are you doing"
  3. "thanks, that was helpful"
  4. "who are you"
  5. "what time is it in Tokyo"

TIER_2 — Clear focused tasks with a defined output: writing, coding, analysis, research, explanations, recommendations. Multiple perspectives add value but full deliberation is not needed.
  1. "write me a cover letter for a software engineering role"
  2. "explain how TCP/IP works"
  3. "give me 5 business name ideas for a coffee shop"
  4. "debug this Python function and fix the off-by-one error"
  5. "summarize the pros and cons of remote work"

TIER_3 — Genuinely complex multi-domain problems, high-stakes decisions, strategic questions requiring the full council's deliberation and unanimous agreement.
  1. "help me restructure my company's organizational model"
  2. "what should my long-term investment strategy be given my goals"
  3. "design the full architecture for a distributed real-time trading system"
  4. "I'm considering leaving my career — help me think through this decision"
  5. "build a comprehensive go-to-market plan for our product launch"

When in doubt, promote UP — never under-serve a request.

REQUEST: ${stripped}

Respond with exactly one of: TIER_1  TIER_2  TIER_3`
  );

  const raw    = response.trim().toUpperCase().split(/\s+/)[0];
  const result = raw === 'TIER_1' ? 'TIER_1' : raw === 'TIER_2' ? 'TIER_2' : 'TIER_3';

  console.log(`[CLASSIFY] '${stripped.slice(0, 60)}' → ${result}`);
  return result;
}

// ── Agent call helpers ────────────────────────────────────────────────────────

// Triggers a Zeus diagnostic in the background when an agent fails.
async function triggerZeusDiagnostic(requestId, agent, phase, error) {
  try {
    const diagnosis = await callZeus(
      `You are Zeus. A pipeline agent has failed mid-mission. Diagnose and prescribe immediate action.

FAILED AGENT: ${agent.toUpperCase()}
PIPELINE PHASE: ${phase}
ERROR: ${error}

Identify the root cause: is this an SSH failure, network timeout, agent overload, or pipeline logic error? State your diagnosis and specific recommended fix in 2-3 sentences. Be direct and decisive.`
    );
    broadcast({ type: 'zeus_diagnostic', id: requestId, agent, phase, error, diagnosis });
    console.log(`[B3C] Zeus diagnostic complete for ${agent} failure in ${phase}`);
  } catch (err) {
    console.error('[B3C] Zeus diagnostic itself failed:', err.message);
  }
}

// Wraps an agent call with start/complete/error broadcasts. Never throws.
// Returns { ok: true, result } on success or { ok: false, error } on failure.
async function callSafe(requestId, agent, phase, fn) {
  broadcast({ type: 'agent_start', id: requestId, agent, phase });
  try {
    const result = await fn();
    broadcast({ type: 'agent_complete', id: requestId, agent, phase });
    return { ok: true, result };
  } catch (err) {
    const error = err.message || 'No response received';
    console.error(`[B3C] ${agent} failed in ${phase}: ${error}`);
    broadcast({ type: 'agent_error', id: requestId, agent, phase, error });
    triggerZeusDiagnostic(requestId, agent, phase, error).catch(() => {});
    return { ok: false, error };
  }
}

// Builds deliverable context for synthesis, noting any unavailable agents.
function deliverableContext(deliverables, failures) {
  const parts = [];
  if (deliverables.zeus)     parts.push(`ZEUS DELIVERABLE (Spiritual/Intellectual):\n${deliverables.zeus}`);
  if (deliverables.poseidon) parts.push(`POSEIDON DELIVERABLE (Financial/Social):\n${deliverables.poseidon}`);
  if (deliverables.hades)    parts.push(`HADES DELIVERABLE (Physical/Technical):\n${deliverables.hades}`);
  if (failures.length > 0)   parts.push(`NOTE: The following agents were unreachable: ${failures.join(', ')}. Synthesize from available work and note any gaps.`);
  return parts.join('\n\n');
}

// ── Tier 1 — Zeus alone ───────────────────────────────────────────────────────
async function runTier1(requestId, userInput, channel, userId = null) {
  const start = Date.now();
  console.log(`[B3C] Tier 1 mission ${requestId}`);

  broadcast({ type: 'stage_change',  id: requestId, stage: 'execution' });
  broadcast({ type: 'agent_thought', id: requestId, agent: 'zeus', text: 'Processing...' });

  const response = await callZeus(
    `You are Zeus. Respond directly and personally to this message.\n\n${userInput}`,
    requestId
  );

  const elapsed = Date.now() - start;
  broadcast({ type: 'stage_change',    id: requestId, stage: 'done' });
  broadcast({ type: 'request_complete', id: requestId, elapsed, output: response, channel, tier: 'TIER_1', ...(userId != null ? { userId: String(userId) } : {}) });

  // Observe
  try {
    observeMission({
      id: requestId, timestamp: Date.now(), userId, channel, tier: 'TIER_1',
      request: userInput, councilInitial: [], councilBackend: [],
      deliverables: { zeus: response, poseidon: null, hades: null },
      failures: [], output: response, elapsed,
    });
  } catch {}

  console.log(`[B3C] Tier 1 complete in ${(elapsed / 1000).toFixed(1)}s`);
  return response;
}

// ── Tier 2 — Focused three-domain execution ───────────────────────────────────
async function runTier2(requestId, userInput, channel, userId = null) {
  const start = Date.now();
  console.log(`[B3C] Tier 2 mission ${requestId}`);
  const t2CouncilInitial = [];
  const t2CouncilBackend = [];

  // ── Coordination ──────────────────────────────────────────────────────────
  broadcast({ type: 'stage_change', id: requestId, stage: 'council_initial' });

  const taskRes = await callSafe(requestId, 'zeus', 'coordination', () => callZeus(
    `You are Zeus, coordinating the B3C Council for a focused request.

USER REQUEST: ${userInput}

Analyze this request and immediately assign clear domain tasks to each council member. Be direct and decisive — no extended deliberation needed. State clearly what each member should produce.

Assign tasks for:
- Zeus (Spiritual/Intellectual domain): philosophical framing, conceptual architecture, meaning, synthesis
- Poseidon (Financial/Social domain): economic forces, market dynamics, social relationships, incentive structures
- Hades (Physical/Technical domain): technical implementation, systems architecture, practical mechanics, execution steps`,
    requestId
  ));

  const taskAssignment = taskRes.ok
    ? taskRes.result
    : 'Each member should produce a complete, substantive work product covering their primary domain.';

  broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'zeus', text: taskAssignment, vote: 'approve' });
  t2CouncilInitial.push({ speaker: 'zeus', text: taskAssignment, vote: 'approve' });
  console.log('[B3C] Tier 2: Zeus assigned tasks');

  // ── Parallel execution ────────────────────────────────────────────────────
  broadcast({ type: 'stage_change',  id: requestId, stage: 'execution' });
  broadcast({ type: 'agent_thought', id: requestId, agent: 'zeus',     text: 'Producing Spiritual/Intellectual deliverable...' });
  broadcast({ type: 'agent_thought', id: requestId, agent: 'poseidon', text: 'Producing Financial/Social deliverable...' });
  broadcast({ type: 'agent_thought', id: requestId, agent: 'hades',    text: 'Producing Physical/Technical deliverable...' });

  const execBase = `USER REQUEST: ${userInput}\n\nCOUNCIL TASK ASSIGNMENTS:\n${taskAssignment}`;

  const [zeusRes, posRes, hadRes] = await Promise.all([
    callSafe(requestId, 'zeus', 'execution', () => callZeus(
      `You are Zeus, executing your Spiritual/Intellectual domain work.\n\n${execBase}\n\nProduce your deliverable now. Your domain covers: philosophical framing, conceptual architecture, meaning and purpose, intellectual synthesis, the underlying "why" of this request. Deliver a complete, substantive Spiritual/Intellectual work product.`,
      requestId
    )),
    callSafe(requestId, 'poseidon', 'execution', () => callPoseidon(
      `You are Poseidon, executing your Financial/Social domain work.\n\n${execBase}\n\nProduce your deliverable now. Your domain covers: economic analysis, market forces, social dynamics, relationship networks, financial considerations, the human systems and incentive structures at play. Deliver a complete, substantive Financial/Social work product.`,
      requestId
    )),
    callSafe(requestId, 'hades', 'execution', () => callHades(
      `You are Hades, executing your Physical/Technical domain work.\n\n${execBase}\n\nProduce your deliverable now. Your domain covers: technical implementation, systems architecture, practical mechanics, infrastructure, tangible execution steps, the concrete "how it works." Deliver a complete, substantive Physical/Technical work product.`,
      requestId
    )),
  ]);

  const zeusWork     = zeusRes.ok ? zeusRes.result : null;
  const poseidonWork = posRes.ok  ? posRes.result  : null;
  const hadesWork    = hadRes.ok  ? hadRes.result  : null;
  const failures     = [
    !zeusWork     && 'Zeus (Spiritual/Intellectual)',
    !poseidonWork && 'Poseidon (Financial/Social)',
    !hadesWork    && 'Hades (Physical/Technical)',
  ].filter(Boolean);

  if (zeusWork)     broadcast({ type: 'task_assigned', id: requestId, agent: 'zeus',     task: zeusWork });
  if (poseidonWork) broadcast({ type: 'task_assigned', id: requestId, agent: 'poseidon', task: poseidonWork });
  if (hadesWork)    broadcast({ type: 'task_assigned', id: requestId, agent: 'hades',    task: hadesWork });
  console.log(`[B3C] Tier 2: ${3 - failures.length}/3 deliverables complete`);

  // ── Single review pass ────────────────────────────────────────────────────
  broadcast({ type: 'stage_change', id: requestId, stage: 'council_backend' });

  const reviewCtx = `USER REQUEST: ${userInput}\n\nZEUS: ${zeusWork || '[UNAVAILABLE]'}\n\nPOSEIDON: ${poseidonWork || '[UNAVAILABLE]'}\n\nHADES: ${hadesWork || '[UNAVAILABLE]'}`;

  const [zeusRevRes, posRevRes, hadRevRes] = await Promise.all([
    callSafe(requestId, 'zeus', 'review', () => callZeus(
      `You are Zeus, doing a single-pass review of all three deliverables.\n\n${reviewCtx}\n\nAssess whether these three together fully answer the request. Be honest and direct. End your response with VOTE: AYE.`,
      requestId
    )),
    callSafe(requestId, 'poseidon', 'review', () => callPoseidon(
      `You are Poseidon, doing a single-pass review.\n\n${reviewCtx}\n\nAssess from your Financial/Social perspective whether the combined output fully answers the request. End with VOTE: AYE.`,
      requestId
    )),
    callSafe(requestId, 'hades', 'review', () => callHades(
      `You are Hades, doing a single-pass review.\n\n${reviewCtx}\n\nAssess from your Physical/Technical perspective whether the combined output fully answers the request. End with VOTE: AYE.`,
      requestId
    )),
  ]);

  if (zeusRevRes.ok)  { broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'zeus',     text: zeusRevRes.result,  vote: 'calling' }); t2CouncilBackend.push({ speaker: 'zeus',     text: zeusRevRes.result }); }
  if (posRevRes.ok)   { broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'poseidon', text: posRevRes.result });  t2CouncilBackend.push({ speaker: 'poseidon', text: posRevRes.result });  }
  if (hadRevRes.ok)   { broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'hades',    text: hadRevRes.result });   t2CouncilBackend.push({ speaker: 'hades',    text: hadRevRes.result });   }
  broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'zeus', text: 'Tier 2 review complete. Proceeding to synthesis.', vote: 'approve' });

  // ── Synthesis ─────────────────────────────────────────────────────────────
  const synthCtx = deliverableContext({ zeus: zeusWork, poseidon: poseidonWork, hades: hadesWork }, failures);

  const synthRes = await callSafe(requestId, 'zeus', 'synthesis', () => callZeus(
    `You are Zeus. Synthesize all available domain deliverables into a single coherent, integrated final response.

USER REQUEST: ${userInput}

${synthCtx}

Weave the available layers together seamlessly. This is the council's delivered output — make it complete and authoritative.`,
    requestId
  ));

  const synthesis = synthRes.ok
    ? synthRes.result
    : zeusWork || poseidonWork || hadesWork || '⚠️ Synthesis failed — all agents unreachable.';

  const t2Elapsed = Date.now() - start;

  broadcast({ type: 'stage_change',    id: requestId, stage: 'done' });
  broadcast({ type: 'request_complete', id: requestId, elapsed: t2Elapsed, output: synthesis, channel, tier: 'TIER_2', councils: 2, ...(userId != null ? { userId: String(userId) } : {}) });

  // Observe
  try {
    observeMission({
      id: requestId, timestamp: Date.now(), userId, channel, tier: 'TIER_2',
      request: userInput, councilInitial: t2CouncilInitial, councilBackend: t2CouncilBackend,
      deliverables: { zeus: zeusWork, poseidon: poseidonWork, hades: hadesWork },
      failures, output: synthesis, elapsed: t2Elapsed,
    });
  } catch {}

  console.log(`[B3C] Tier 2 complete in ${(t2Elapsed / 1000).toFixed(1)}s`);
  return synthesis;
}

// ── Tier 3 — Full B3C pipeline ────────────────────────────────────────────────
async function runTier3(requestId, userInput, channel, userId = null) {
  const start = Date.now();
  console.log(`[B3C] Tier 3 mission ${requestId}`);
  const t3CouncilInitial = [];
  const t3CouncilBackend = [];

  broadcast({ type: 'stage_change', id: requestId, stage: 'council_initial' });

  // ── Zeus opening ──────────────────────────────────────────────────────────
  const zeusFrameRes = await callSafe(requestId, 'zeus', 'council_initial', () => callZeus(
    `You are Zeus, peer facilitator of the B3C Council. A new request has arrived.

USER REQUEST: ${userInput}

Bring this request to the council table. Share your Spiritual/Intellectual perspective on it — what is the deeper meaning, the conceptual framing, the intellectual lens through which you see this request. What questions does it raise? What is the essential nature of what is being asked?

Do NOT prescribe what Poseidon or Hades should do. Do NOT divide the work. Simply open the floor by sharing your own perspective and inviting your peers to weigh in from their domains.

Speak directly to the council. This is your opening statement — share your lens, then listen.`,
    requestId
  ));

  const zeusFraming = zeusFrameRes.ok ? zeusFrameRes.result : '[Zeus unavailable for opening]';
  broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'zeus', text: zeusFraming });
  t3CouncilInitial.push({ speaker: 'zeus', text: zeusFraming });
  console.log('[B3C] Zeus framing complete');

  // ── Poseidon + Hades voices (parallel) ───────────────────────────────────
  const [posVoiceRes, hadVoiceRes] = await Promise.all([
    callSafe(requestId, 'poseidon', 'council_initial', () => callPoseidon(
      `You are Poseidon of the B3C Council. Zeus has opened the floor.

USER REQUEST: ${userInput}

ZEUS'S OPENING:
${zeusFraming}

You are now hearing this request through your Financial/Social domain. What do you see? What social dynamics, economic forces, relationship networks, or financial considerations does this request involve? What is your independent read on it?

Do not defer to Zeus or repeat what he said. Speak from your own domain with your own perspective. This is your voice in the council.`,
      requestId
    )),
    callSafe(requestId, 'hades', 'council_initial', () => callHades(
      `You are Hades of the B3C Council. Zeus has opened the floor.

USER REQUEST: ${userInput}

ZEUS'S OPENING:
${zeusFraming}

You are now hearing this request through your Physical/Technical domain. What do you see? What systems, mechanisms, infrastructure, or technical realities does this request involve? What is your independent read on it?

Do not defer to Zeus or repeat what he said. Speak from your own domain with your own perspective. This is your voice in the council.`,
      requestId
    )),
  ]);

  const poseidonVoice = posVoiceRes.ok ? posVoiceRes.result : '[Poseidon unavailable]';
  const hadesVoice    = hadVoiceRes.ok ? hadVoiceRes.result : '[Hades unavailable]';

  broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'poseidon', text: poseidonVoice });
  broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'hades',    text: hadesVoice });
  t3CouncilInitial.push({ speaker: 'poseidon', text: poseidonVoice });
  t3CouncilInitial.push({ speaker: 'hades',    text: hadesVoice });
  console.log('[B3C] Poseidon and Hades voiced in parallel');

  let councilHistory = `ZEUS:\n${zeusFraming}\n\nPOSEIDON:\n${poseidonVoice}\n\nHADES:\n${hadesVoice}`;
  let approved       = false;
  let taskAssignments = null;
  let voteRound      = 0;

  // ── Deliberation loop ─────────────────────────────────────────────────────
  while (!approved) {
    voteRound++;
    console.log(`[B3C] Vote round ${voteRound}`);

    const zeusVoteRes = await callSafe(requestId, 'zeus', 'council_initial', () => callZeus(
      `You are Zeus, facilitating the B3C unanimous vote. Round ${voteRound}.

USER REQUEST: ${userInput}

COUNCIL DELIBERATION SO FAR:
${councilHistory}

Review the full deliberation. Does the council have complete coverage of the request?
If yes — respond starting with VOTE: APPROVE and state final task assignments for each member.
If no — respond starting with VOTE: DELIBERATE and identify what needs resolving.`,
      requestId
    ));

    const zeusVote = zeusVoteRes.ok ? zeusVoteRes.result : 'VOTE: APPROVE — proceeding with available council input.';
    broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'zeus', text: zeusVote, vote: 'calling' });

    if (zeusVote.includes('VOTE: APPROVE')) {
      approved = true;
      taskAssignments = zeusVote;
      broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'zeus', text: 'Unanimous. Green light.', vote: 'approve' });
      console.log('[B3C] Initial council approved');
    } else {
      const [posRoundRes, hadRoundRes] = await Promise.all([
        callSafe(requestId, 'poseidon', 'council_initial', () => callPoseidon(
          `You are Poseidon. B3C deliberation round ${voteRound}.\n\nUSER REQUEST: ${userInput}\n\nCOUNCIL SO FAR:\n${councilHistory}\n\nZEUS:\n${zeusVote}\n\nRespond from your Financial/Social domain.`,
          requestId
        )),
        callSafe(requestId, 'hades', 'council_initial', () => callHades(
          `You are Hades. B3C deliberation round ${voteRound}.\n\nUSER REQUEST: ${userInput}\n\nCOUNCIL SO FAR:\n${councilHistory}\n\nZEUS:\n${zeusVote}\n\nRespond from your Physical/Technical domain.`,
          requestId
        )),
      ]);

      const posRound = posRoundRes.ok ? posRoundRes.result : '[Poseidon unavailable]';
      const hadRound = hadRoundRes.ok ? hadRoundRes.result : '[Hades unavailable]';

      broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'poseidon', text: posRound });
      broadcast({ type: 'council_message', id: requestId, council: 'initial', speaker: 'hades',    text: hadRound });
      councilHistory += `\n\n--- Round ${voteRound} ---\nZEUS:\n${zeusVote}\n\nPOSEIDON:\n${posRound}\n\nHADES:\n${hadRound}`;
    }
  }

  // ── Parallel execution ────────────────────────────────────────────────────
  broadcast({ type: 'stage_change', id: requestId, stage: 'execution' });
  console.log('[B3C] Execution phase');

  broadcast({ type: 'agent_thought', id: requestId, agent: 'zeus',     text: 'Producing Spiritual/Intellectual deliverable...' });
  broadcast({ type: 'agent_thought', id: requestId, agent: 'poseidon', text: 'Producing Financial/Social deliverable...' });
  broadcast({ type: 'agent_thought', id: requestId, agent: 'hades',    text: 'Producing Physical/Technical deliverable...' });

  const execBase = `USER REQUEST: ${userInput}\n\nCOUNCIL TASK ASSIGNMENTS:\n${taskAssignments}`;

  const [zeusExecRes, posExecRes, hadExecRes] = await Promise.all([
    callSafe(requestId, 'zeus', 'execution', () => callZeus(
      `You are Zeus, executing your Spiritual/Intellectual domain work.\n\n${execBase}\n\nProduce your deliverable now. Your domain covers: philosophical framing, conceptual architecture, meaning and purpose, intellectual synthesis, the underlying "why" of this request. Go deep — this is real domain work, not a summary of the discussion. Deliver a complete, substantive Spiritual/Intellectual work product.`,
      requestId
    )),
    callSafe(requestId, 'poseidon', 'execution', () => callPoseidon(
      `You are Poseidon, executing your Financial/Social domain work.\n\n${execBase}\n\nProduce your deliverable now. Your domain covers: economic analysis, market forces, social dynamics, relationship networks, financial considerations, the human systems and incentive structures at play. Go deep — this is real domain work, not a summary of the discussion. Deliver a complete, substantive Financial/Social work product.`,
      requestId
    )),
    callSafe(requestId, 'hades', 'execution', () => callHades(
      `You are Hades, executing your Physical/Technical domain work.\n\n${execBase}\n\nProduce your deliverable now. Your domain covers: technical implementation, systems architecture, practical mechanics, infrastructure, tangible execution steps, the concrete "how it works." Go deep — this is real domain work, not a summary of the discussion. Deliver a complete, substantive Physical/Technical work product.`,
      requestId
    )),
  ]);

  const zeusWork     = zeusExecRes.ok ? zeusExecRes.result : null;
  const poseidonWork = posExecRes.ok  ? posExecRes.result  : null;
  const hadesWork    = hadExecRes.ok  ? hadExecRes.result  : null;
  const execFailures = [
    !zeusWork     && 'Zeus (Spiritual/Intellectual)',
    !poseidonWork && 'Poseidon (Financial/Social)',
    !hadesWork    && 'Hades (Physical/Technical)',
  ].filter(Boolean);

  if (zeusWork)     broadcast({ type: 'task_assigned', id: requestId, agent: 'zeus',     task: zeusWork });
  if (poseidonWork) broadcast({ type: 'task_assigned', id: requestId, agent: 'poseidon', task: poseidonWork });
  if (hadesWork)    broadcast({ type: 'task_assigned', id: requestId, agent: 'hades',    task: hadesWork });
  console.log(`[B3C] ${3 - execFailures.length}/3 deliverables complete`);

  // ── Backend council ───────────────────────────────────────────────────────
  broadcast({ type: 'stage_change', id: requestId, stage: 'council_backend' });
  console.log('[B3C] Backend council');

  let pool = { zeus: zeusWork, poseidon: poseidonWork, hades: hadesWork };
  let backendApproved = false;
  let finalOutput     = null;

  while (!backendApproved) {
    const zeusRevRes = await callSafe(requestId, 'zeus', 'review', () => callZeus(
      `You are Zeus, facilitating the Backend B3C Council review.

USER REQUEST: ${userInput}

ZEUS DELIVERABLE (yours):
${pool.zeus || '[UNAVAILABLE]'}

POSEIDON DELIVERABLE:
${pool.poseidon || '[UNAVAILABLE]'}

HADES DELIVERABLE:
${pool.hades || '[UNAVAILABLE]'}

Read all three deliverables carefully. Assess whether together they fully answer the request. Voice your honest position to the council — what is working, what gaps exist if any.

Then cast your vote: end your response with VOTE: AYE if you believe the combined work is complete and ready, or VOTE: REVISE if something needs rework (name specifically what and by whom).`,
      requestId
    ));

    const zeusPosition = zeusRevRes.ok ? zeusRevRes.result : 'VOTE: AYE — proceeding to synthesis with available work.';
    broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'zeus', text: zeusPosition, vote: 'calling' });
    t3CouncilBackend.push({ speaker: 'zeus', text: zeusPosition });

    const [posRevRes, hadRevRes] = await Promise.all([
      callSafe(requestId, 'poseidon', 'review', () => callPoseidon(
        `You are Poseidon, in the Backend B3C Council review.

USER REQUEST: ${userInput}

ZEUS DELIVERABLE:
${pool.zeus || '[UNAVAILABLE]'}

YOUR DELIVERABLE (Poseidon):
${pool.poseidon || '[UNAVAILABLE]'}

HADES DELIVERABLE:
${pool.hades || '[UNAVAILABLE]'}

ZEUS'S POSITION:
${zeusPosition}

Read all three deliverables. From your Financial/Social domain perspective, does the combined output fully answer the request? Voice your honest assessment.

Then cast your vote: end your response with VOTE: AYE if the work is complete and ready, or VOTE: REVISE if something is missing (name specifically what and by whom).`,
        requestId
      )),
      callSafe(requestId, 'hades', 'review', () => callHades(
        `You are Hades, in the Backend B3C Council review.

USER REQUEST: ${userInput}

ZEUS DELIVERABLE:
${pool.zeus || '[UNAVAILABLE]'}

POSEIDON DELIVERABLE:
${pool.poseidon || '[UNAVAILABLE]'}

YOUR DELIVERABLE (Hades):
${pool.hades || '[UNAVAILABLE]'}

ZEUS'S POSITION:
${zeusPosition}

Read all three deliverables. From your Physical/Technical domain perspective, does the combined output fully answer the request? Voice your honest assessment.

Then cast your vote: end your response with VOTE: AYE if the work is complete and ready, or VOTE: REVISE if something is missing (name specifically what and by whom).`,
        requestId
      )),
    ]);

    const poseidonPosition = posRevRes.ok ? posRevRes.result : 'VOTE: AYE';
    const hadesPosition    = hadRevRes.ok ? hadRevRes.result : 'VOTE: AYE';

    broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'poseidon', text: poseidonPosition });
    broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'hades',    text: hadesPosition });
    t3CouncilBackend.push({ speaker: 'poseidon', text: poseidonPosition });
    t3CouncilBackend.push({ speaker: 'hades',    text: hadesPosition });

    const zeusAye     = zeusPosition.includes('VOTE: AYE');
    const poseidonAye = poseidonPosition.includes('VOTE: AYE');
    const hadesAye    = hadesPosition.includes('VOTE: AYE');

    if (zeusAye && poseidonAye && hadesAye) {
      const synthCtx = deliverableContext({ zeus: pool.zeus, poseidon: pool.poseidon, hades: pool.hades }, execFailures);

      const synthRes = await callSafe(requestId, 'zeus', 'synthesis', () => callZeus(
        `You are Zeus. The B3C Backend Council has voted unanimously to approve.

USER REQUEST: ${userInput}

${synthCtx}

Synthesize all available domain deliverables into a single coherent, integrated final response. Weave the Spiritual/Intellectual, Financial/Social, and Physical/Technical layers together. This is the council's delivered output — make it complete and authoritative.`,
        requestId
      ));

      backendApproved = true;
      finalOutput     = synthRes.ok
        ? synthRes.result
        : pool.zeus || pool.poseidon || pool.hades || '⚠️ Synthesis failed.';

      broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'zeus', text: 'Unanimous. All three in favor. Council complete.', vote: 'approve' });
      console.log('[B3C] Backend council approved unanimously');
    } else {
      const allFeedback = `ZEUS:\n${zeusPosition}\n\nPOSEIDON:\n${poseidonPosition}\n\nHADES:\n${hadesPosition}`;
      const combined    = allFeedback.toLowerCase();

      const [posRev, hadRev, zeusRev] = await Promise.all([
        combined.includes('poseidon')
          ? callSafe(requestId, 'poseidon', 'revision', () => callPoseidon(
              `You are Poseidon. The council has raised concerns.\n\nORIGINAL TASK:\n${execBase}\n\nYOUR PREVIOUS WORK:\n${pool.poseidon || '[none]'}\n\nCOUNCIL FEEDBACK:\n${allFeedback}\n\nRevise your Financial/Social deliverable to address the feedback.`,
              requestId
            ))
          : Promise.resolve({ ok: false }),
        combined.includes('hades')
          ? callSafe(requestId, 'hades', 'revision', () => callHades(
              `You are Hades. The council has raised concerns.\n\nORIGINAL TASK:\n${execBase}\n\nYOUR PREVIOUS WORK:\n${pool.hades || '[none]'}\n\nCOUNCIL FEEDBACK:\n${allFeedback}\n\nRevise your Physical/Technical deliverable to address the feedback.`,
              requestId
            ))
          : Promise.resolve({ ok: false }),
        combined.includes('zeus')
          ? callSafe(requestId, 'zeus', 'revision', () => callZeus(
              `You are Zeus. The council has raised concerns.\n\nORIGINAL TASK:\n${execBase}\n\nYOUR PREVIOUS WORK:\n${pool.zeus || '[none]'}\n\nCOUNCIL FEEDBACK:\n${allFeedback}\n\nRevise your Spiritual/Intellectual deliverable to address the feedback.`,
              requestId
            ))
          : Promise.resolve({ ok: false }),
      ]);

      if (posRev.ok)  { pool.poseidon = posRev.result;  broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'poseidon', text: 'Revision submitted.' }); }
      if (hadRev.ok)  { pool.hades    = hadRev.result;  broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'hades',    text: 'Revision submitted.' }); }
      if (zeusRev.ok) { pool.zeus     = zeusRev.result; broadcast({ type: 'council_message', id: requestId, council: 'backend', speaker: 'zeus',     text: 'Revision submitted.' }); }
    }
  }

  const t3Elapsed = Date.now() - start;

  broadcast({ type: 'stage_change',    id: requestId, stage: 'done' });
  broadcast({ type: 'request_complete', id: requestId, elapsed: t3Elapsed, output: finalOutput, channel, tier: 'TIER_3', councils: 2, ...(userId != null ? { userId: String(userId) } : {}) });

  // Observe
  try {
    observeMission({
      id: requestId, timestamp: Date.now(), userId, channel, tier: 'TIER_3',
      request: userInput, councilInitial: t3CouncilInitial, councilBackend: t3CouncilBackend,
      deliverables: { zeus: zeusWork, poseidon: poseidonWork, hades: hadesWork },
      failures: execFailures, output: finalOutput, elapsed: t3Elapsed,
    });
  } catch {}

  console.log(`[B3C] Tier 3 mission ${requestId} complete in ${(t3Elapsed / 1000).toFixed(1)}s`);
  return finalOutput;
}

// ── Public entry point ────────────────────────────────────────────────────────
// Accepts optional preTier (from queue pre-classification) to skip re-classification.
export async function runB3C(requestId, userInput, channel, preTier = null, userId = null) {
  const start = Date.now();

  let tier = preTier;
  if (!tier) {
    try {
      tier = await classifyRequest(userInput);
    } catch (err) {
      console.error(`[B3C] Classification failed, defaulting to TIER_3:`, err.message);
      tier = 'TIER_3';
    }
    broadcast({ type: 'tier_classified', id: requestId, tier });
    console.log(`[B3C] ${requestId} classified as ${tier} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }

  if (tier === 'TIER_1') return runTier1(requestId, userInput, channel, userId);
  if (tier === 'TIER_2') return runTier2(requestId, userInput, channel, userId);
  return runTier3(requestId, userInput, channel, userId);
}
