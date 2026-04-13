// ~/olympus/framework/flywheel/zeus-handler.js
// Mount Olympus — Zeus Execution Handler
// Single-execution module: called once per job via /flywheel/wake-zeus.
// Zeus classifies → handles trivial directly OR orchestrates standard/strategic
// through the B3C council pipeline (plan → ratify → dispatch → synthesize → deliver).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { callAgent as gwCallAgent } from '../gateway.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FLYWHEEL_URL  = 'http://127.0.0.1:18780/flywheel';
const BOT_TOKEN     = process.env.BUILD_BOT_TOKEN || '';

const log = (...args) => console.log('[zeus-handler]', new Date().toISOString(), ...args);

// ---------------------------------------------------------------------------
// OpenClaw chat call — delegates to unified gateway.js
// ---------------------------------------------------------------------------
async function openclawCall(node, systemPrompt, userMessage, sessionKey) {
  return gwCallAgent({ node, systemPrompt, prompt: userMessage, sessionKey });
}

// ---------------------------------------------------------------------------
// Telegram delivery
// ---------------------------------------------------------------------------
async function sendTelegram(chatId, text) {
  if (!BOT_TOKEN || !chatId) {
    log('skipping telegram — no token or chat_id');
    return;
  }
  // Telegram max message length is 4096 chars
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.slice(i, i + 4000));
  }
  for (const chunk of chunks) {
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!resp.ok) log('telegram send error:', resp.status);
  }
}

// ---------------------------------------------------------------------------
// Flywheel API helpers
// ---------------------------------------------------------------------------
async function patchJob(jobId, updates) {
  const resp = await fetch(`${FLYWHEEL_URL}/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!resp.ok) log('patchJob error:', resp.status);
  return resp.ok ? resp.json() : null;
}

async function flywheelPost(path, body) {
  const resp = await fetch(`${FLYWHEEL_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    log('flywheel POST error:', path, resp.status, text.slice(0, 200));
    return null;
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Parse JSON from LLM response (might be wrapped in markdown code block)
// ---------------------------------------------------------------------------
function parseJsonResponse(raw) {
  // Try raw first
  try { return JSON.parse(raw); } catch {}
  // Try extracting from markdown code block
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) try { return JSON.parse(match[1]); } catch {}
  // Try finding first { ... } block
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) try { return JSON.parse(braceMatch[0]); } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// MAIN: executeJob — called once per job
// ---------------------------------------------------------------------------
export async function executeJob({ job_id, prompt, chat_id }) {
  log('=== WAKING for job', job_id, '===');

  try {
    // ── STEP A: Read job ──────────────────────────────────────────────────────
    const jobPath = path.join(__dirname, 'jobs', `${job_id}.json`);
    if (!fs.existsSync(jobPath)) {
      throw new Error(`job file not found: ${jobPath}`);
    }
    const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
    log('job loaded:', job.title?.slice(0, 80));

    // ── STEP B: Zeus classifies ───────────────────────────────────────────────
    log('classifying via Zeus OpenClaw...');
    const classifyTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('classification timeout')), 15000)
    );
    let classifyResponse;
    try {
      classifyResponse = await Promise.race([
        openclawCall(
      'zeus',
      'You are Zeus, orchestrator of the B3C council.',
      [
        'Classify this build job and write a routing plan.',
        '',
        `Job: ${prompt}`,
        '',
        'routing_class:',
        '- trivial: simple factual lookup, single question, Zeus handles alone immediately',
        '- standard: research, analysis, comparison, drafting — needs quorum members, Poseidon and Hades ratify',
        '- strategic: architecture decisions, major plans — full B3C unanimous ratification, no timeout',
        '',
        'Respond in JSON only:',
        '{',
        '  "routing_class": "trivial" | "standard" | "strategic",',
        '  "zeus_assessment": "string",',
        '  "council_heads_involved": ["string"],',
        '  "work_packages": [{ "assigned_to": "string", "owned_by": "string", "brief": "string" }]',
        '}',
      ].join('\n'),
      `zeus-classify-${job_id.slice(-8)}-${Date.now()}`
    ),
        classifyTimeout,
      ]);
    } catch (e) {
      log('classification timed out or failed:', e.message, '— defaulting to standard');
      classifyResponse = '';
    }

    log('classification raw:', classifyResponse.slice(0, 300));

    const classification = parseJsonResponse(classifyResponse) || {
      routing_class: 'standard',
      zeus_assessment: classifyResponse,
      council_heads_involved: ['zeus', 'poseidon', 'hades'],
      work_packages: [{ assigned_to: 'hermes', owned_by: 'zeus', brief: prompt }],
    };

    const routingClass = classification.routing_class || 'standard';
    log('classified as:', routingClass);

    // ── STEP C: Update job ────────────────────────────────────────────────────
    await patchJob(job_id, {
      routing_class: routingClass,
      status: routingClass === 'trivial' ? 'executing' : 'planning',
    });

    // ── STEP D: TRIVIAL — Zeus handles directly ──────────────────────────────
    if (routingClass === 'trivial') {
      log('trivial — Zeus handling directly');
      const response = await openclawCall(
        'zeus',
        'You are Zeus. Answer this request directly and concisely. Keep your response under 1500 characters. No padding, no preamble — just the answer.',
        prompt,
        `zeus-trivial-${job_id.slice(-8)}-${Date.now()}`
      );
      log('trivial response length:', response.length);

      await patchJob(job_id, { status: 'delivered' });
      await sendTelegram(chat_id, response);
      log('=== TRIVIAL JOB DELIVERED ===');
      return;
    }

    // ── STEP E: STANDARD / STRATEGIC — full B3C pipeline ─────────────────────
    log(routingClass, '— initiating B3C pipeline');

    // E1: Create routing plan
    const workPackages = classification.work_packages?.length
      ? classification.work_packages
      : [{ assigned_to: 'hermes', owned_by: 'zeus', brief: prompt, summary: prompt }];

    // Ensure each step has a summary field (required by flywheel.js)
    const steps = workPackages.map((wp) => ({
      ...wp,
      summary: wp.brief || wp.summary || prompt,
    }));

    const plan = await flywheelPost(`/jobs/${job_id}/routing_plan`, {
      proposed_by: 'zeus',
      steps,
    });

    if (!plan) throw new Error('failed to create routing plan');
    log('plan created:', plan.id);

    // E2: Ratification — Zeus auto-ratifies, then asks Poseidon + Hades
    await flywheelPost(`/routing_plans/${plan.id}/ratify`, { ratified_by: 'zeus' });
    log('zeus ratified');

    // Ratify in parallel — Poseidon + Hades simultaneously
    const ratifyMsg = [
      `Routing plan for review:`,
      JSON.stringify(classification, null, 2),
      '',
      `Original prompt: ${prompt}`,
      '',
      `Reply JSON only: { "ratified": true, "note": "your assessment", "proposed_changes": [] }`,
    ].join('\n');

    await Promise.allSettled(
      ['poseidon', 'hades'].map(async (head) => {
        try {
          log('requesting ratification from', head);
          const resp = await openclawCall(
            head,
            `You are ${head.charAt(0).toUpperCase() + head.slice(1)}, council member of the B3C.`,
            ratifyMsg,
            `zeus-ratify-${head}-${Date.now()}`
          );
          log(head, 'responded:', resp.slice(0, 150));
          await flywheelPost(`/routing_plans/${plan.id}/ratify`, { ratified_by: head });
          log(head, 'ratification posted');
        } catch (e) {
          log(head, 'ratification error:', e.message);
        }
      })
    );

    // E3: Read updated job to get created work package IDs
    const updatedJobResp = await fetch(`${FLYWHEEL_URL}/jobs/${job_id}`);
    const updatedJob = await updatedJobResp.json();
    const wpIds = updatedJob.work_package_ids || [];
    log('work packages created:', wpIds.length);

    if (wpIds.length === 0) {
      log('no work packages created — delivering assessment directly');
      await patchJob(job_id, { status: 'delivered' });
      await sendTelegram(chat_id, `[Zeus assessment]\n\n${classification.zeus_assessment}`);
      return;
    }

    // E4: Dispatch ALL work packages in parallel (gateway.js handles node→IP+token)
    const dispatchResults = await Promise.allSettled(
      wpIds.map(async (wpId) => {
        // Read the WP to get assignee
        const wpPath = path.join(__dirname, 'work_packages', `${wpId}.json`);
        let wp;
        try { wp = JSON.parse(fs.readFileSync(wpPath, 'utf8')); } catch {
          log('wp file read failed:', wpId);
          return null;
        }

        const assignee = (wp.assigned_to || wp.scope?.assigned_to || 'hermes').toLowerCase();
        const brief = wp.scope?.brief || wp.scope?.summary || prompt;

        // Accept WP
        await flywheelPost(`/work_packages/${wpId}/accept`, { accepted_by: assignee });

        log('dispatching to', assignee);
        const result = await openclawCall(
          assignee,
          'You have a work package from the B3C council. Keep response under 1500 characters.',
          `Brief: ${brief}\n\nReturn a focused, concise response.`,
          `zeus-dispatch-${assignee}-${Date.now()}`
        );
        log(assignee, 'returned:', result.slice(0, 150));

        await flywheelPost(`/work_packages/${wpId}/return`, {
          returned_by: assignee,
          payload: { raw: result },
        });
        return { assignee, result };
      })
    );

    const returns = dispatchResults
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => r.value);
    const dispatchErrors = dispatchResults.filter((r) => r.status === 'rejected');
    if (dispatchErrors.length) log('dispatch failures:', dispatchErrors.length);

    // E5: Guard against 0 returns — all dispatches failed
    if (returns.length === 0) {
      log('ALL dispatches failed — no returns to synthesize. Delivering assessment.');
      await patchJob(job_id, { status: 'delivered' });
      await sendTelegram(chat_id, `[Zeus] All quorum dispatches failed. Assessment:

${classification.zeus_assessment || prompt}`);
      return;
    }

    // E5: Zeus synthesizes all returns
    log('synthesizing', returns.length, 'returns');
    const synthesisPrompt = [
      'You are Zeus, orchestrator of the B3C council.',
      'Synthesize these quorum member returns into a single coherent response.',
      '',
      `Original request: ${prompt}`,
      '',
      'Returns from council members:',
      ...returns.map((r) => `\n--- ${r.assignee.toUpperCase()} ---\n${r.result}`),
      '',
      'Synthesize into a single clear response UNDER 2000 CHARACTERS.',
      'Be direct. No padding, no preamble, no council references. Just the answer.',
    ].join('\n');

    const synthesis = await openclawCall(
      'zeus',
      'You are Zeus. Deliver the final synthesis. HARD LIMIT: under 2000 characters total. Be concise.',
      synthesisPrompt,
      `zeus-synthesize-${job_id.slice(-8)}-${Date.now()}`
    );

    log('synthesis length:', synthesis.length);

    // E6: Deliver
    await patchJob(job_id, { status: 'delivered' });
    await sendTelegram(chat_id, synthesis);
    log('=== JOB DELIVERED ===', job_id);

  } catch (e) {
    log('FATAL error processing job', job_id, ':', e.message);
    log(e.stack);
    try { await patchJob(job_id, { status: 'failed' }); } catch {}
    try { await sendTelegram(chat_id, `Job failed: ${e.message}`); } catch {}
  }
}
