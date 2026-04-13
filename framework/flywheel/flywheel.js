// ~/olympus/framework/flywheel/flywheel.js
// Mount Olympus Flywheel Backend — Additive module
// 12 API endpoints + 6 file-backed primitives
// Mount point: /flywheel (see server.js)
// ADDITIVE ONLY: Does not touch any existing endpoints, files, or data.

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { executeJob } from './zeus-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Storage layout — all primitive records live under this module's directory.
// NAS-backed primitives (SharedResourcePool, PoolDirectory) live on the NAS
// at /Volumes/olympus/pool/ and are read directly from there by consumers.
// ---------------------------------------------------------------------------
const ROOT = __dirname;
const DIRS = {
  jobs:                path.join(ROOT, 'jobs'),
  routing_plans:       path.join(ROOT, 'routing_plans'),
  work_packages:       path.join(ROOT, 'work_packages'),
  dependency_requests: path.join(ROOT, 'dependency_requests'),
  returns:             path.join(ROOT, 'returns'),
  findings:            path.join(ROOT, 'findings'),
};

for (const d of Object.values(DIRS)) {
  try { fs.mkdirSync(d, { recursive: true }); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// File helpers — plain JSON, one file per record, id as filename stem.
// ---------------------------------------------------------------------------
const nowIso = () => new Date().toISOString();

function writeJson(dir, id, data) {
  const fp = path.join(dir, `${id}.json`);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  return data;
}

function readJson(dir, id) {
  const fp = path.join(dir, `${id}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.error('[flywheel] parse error', fp, e.message);
    return null;
  }
}

function updateJson(dir, id, mutator) {
  const existing = readJson(dir, id);
  if (!existing) return null;
  const updated = mutator({ ...existing });
  return writeJson(dir, id, updated);
}

// ---------------------------------------------------------------------------
// Express router
// ---------------------------------------------------------------------------
const router = express.Router();

// ---- 1. POST /jobs -------------------------------------------------------
router.post('/jobs', (req, res) => {
  const { title, description, submitter, routing_class = 'standard', callback = null } = req.body || {};
  if (!title || !submitter) {
    return res.status(400).json({ error: 'title and submitter required' });
  }
  if (!['trivial', 'standard', 'strategic', 'pending_classification'].includes(routing_class)) {
    return res.status(400).json({ error: 'routing_class must be trivial|standard|strategic|pending_classification' });
  }

  const id = `job-${crypto.randomUUID()}`;
  const job = {
    id,
    title,
    description: description || '',
    submitter,
    routing_class,
    status: 'submitted',
    routing_plan_id: null,
    work_package_ids: [],
    callback: callback || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  writeJson(DIRS.jobs, id, job);

  // Trivial jobs skip routing plans — create a WorkPackage directly.
  // pending_classification jobs skip this too — Zeus classifies and handles.
  if (routing_class === 'trivial') {
    const wpId = `wp-${crypto.randomUUID()}`;
    const wp = {
      id: wpId,
      job_id: id,
      plan_id: null,
      plan_version: 0,
      assigned_to: null,
      scope: { summary: title, details: description || '' },
      status: 'open',
      signals: [],
      created_at: nowIso(),
      updated_at: nowIso(),
      accepted_at: null,
      returned_at: null,
    };
    writeJson(DIRS.work_packages, wpId, wp);
    job.work_package_ids.push(wpId);
    job.status = 'awaiting_accept';
    job.updated_at = nowIso();
    writeJson(DIRS.jobs, id, job);
  }

  res.status(201).json(job);
});

// ---- 2. GET /jobs/:id ----------------------------------------------------
router.get('/jobs/:id', (req, res) => {
  const job = readJson(DIRS.jobs, req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json(job);
});

// ---- 3. POST /jobs/:id/routing_plan --------------------------------------
router.post('/jobs/:id/routing_plan', (req, res) => {
  const job = readJson(DIRS.jobs, req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  if (job.routing_class === 'trivial') {
    return res.status(400).json({ error: 'trivial jobs skip routing plans' });
  }

  const { proposed_by, steps } = req.body || {};
  if (!proposed_by || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'proposed_by and non-empty steps[] required' });
  }

  const id = `plan-${crypto.randomUUID()}`;
  const plan = {
    id,
    job_id: job.id,
    version: 1,
    steps,
    proposed_by,
    ratified_by: [],
    status: 'proposed',
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  writeJson(DIRS.routing_plans, id, plan);

  updateJson(DIRS.jobs, job.id, (j) => ({
    ...j,
    routing_plan_id: id,
    status: 'plan_proposed',
    updated_at: nowIso(),
  }));

  res.status(201).json(plan);
});

// ---- 4. POST /routing_plans/:id/ratify -----------------------------------
const COUNCIL_HEADS = ['zeus', 'poseidon', 'hades'];
const RATIFY_THRESHOLD = 2; // 2-of-3 quorum

router.post('/routing_plans/:id/ratify', (req, res) => {
  const plan = readJson(DIRS.routing_plans, req.params.id);
  if (!plan) return res.status(404).json({ error: 'plan not found' });

  const { ratified_by } = req.body || {};
  if (!ratified_by) return res.status(400).json({ error: 'ratified_by required' });

  // Idempotent: re-ratify from same head is a no-op.
  if (plan.ratified_by.includes(ratified_by)) {
    return res.json({ plan, created_work_packages: [] });
  }
  plan.ratified_by.push(ratified_by);
  plan.updated_at = nowIso();

  const ratifiedCouncil = plan.ratified_by.filter((r) => COUNCIL_HEADS.includes(r));
  const createdWorkPackages = [];

  if (ratifiedCouncil.length >= RATIFY_THRESHOLD && plan.status !== 'ratified') {
    plan.status = 'ratified';

    for (const step of plan.steps) {
      const wpId = `wp-${crypto.randomUUID()}`;
      const wp = {
        id: wpId,
        job_id: plan.job_id,
        plan_id: plan.id,
        plan_version: plan.version,
        assigned_to: step.assigned_to || null,
        scope: step,
        status: 'open',
        signals: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        accepted_at: null,
        returned_at: null,
      };
      writeJson(DIRS.work_packages, wpId, wp);
      createdWorkPackages.push(wpId);
    }

    updateJson(DIRS.jobs, plan.job_id, (j) => ({
      ...j,
      work_package_ids: [...(j.work_package_ids || []), ...createdWorkPackages],
      status: 'work_in_progress',
      updated_at: nowIso(),
    }));
  }

  writeJson(DIRS.routing_plans, plan.id, plan);
  res.json({ plan, created_work_packages: createdWorkPackages });
});

// ---- 5. POST /work_packages/:id/accept -----------------------------------
router.post('/work_packages/:id/accept', (req, res) => {
  const wp = readJson(DIRS.work_packages, req.params.id);
  if (!wp) return res.status(404).json({ error: 'work package not found' });

  const { accepted_by } = req.body || {};
  if (!accepted_by) return res.status(400).json({ error: 'accepted_by required' });

  if (wp.status !== 'open') {
    return res.status(409).json({ error: `cannot accept WP in status ${wp.status}` });
  }

  wp.assigned_to = accepted_by;
  wp.accepted_at = nowIso();
  wp.status = 'accepted';
  wp.updated_at = nowIso();
  writeJson(DIRS.work_packages, wp.id, wp);
  res.json(wp);
});

// ---- 6. POST /work_packages/:id/signal -----------------------------------
router.post('/work_packages/:id/signal', (req, res) => {
  const wp = readJson(DIRS.work_packages, req.params.id);
  if (!wp) return res.status(404).json({ error: 'work package not found' });

  const { signal, note, from } = req.body || {};
  if (!signal) return res.status(400).json({ error: 'signal required' });

  wp.signals = wp.signals || [];
  wp.signals.push({ signal, note: note || '', from: from || null, at: nowIso() });
  wp.updated_at = nowIso();
  writeJson(DIRS.work_packages, wp.id, wp);
  res.json(wp);
});

// ---- 7. POST /work_packages/:id/return -----------------------------------
router.post('/work_packages/:id/return', (req, res) => {
  const wp = readJson(DIRS.work_packages, req.params.id);
  if (!wp) return res.status(404).json({ error: 'work package not found' });

  const { payload, returned_by, findings_ref } = req.body || {};
  if (!returned_by) return res.status(400).json({ error: 'returned_by required' });

  // Stale check: plan version bumped since this WP was created → Return is stale.
  let stale = false;
  let stale_reason = null;
  if (wp.plan_id) {
    const plan = readJson(DIRS.routing_plans, wp.plan_id);
    if (plan && plan.version !== wp.plan_version) {
      stale = true;
      stale_reason = `plan_version_mismatch: wp=${wp.plan_version} plan=${plan.version}`;
    }
  }
  // Also stale if a Finding for this WP has already been synthesized/converged.
  if (!stale) {
    const finding = readJson(DIRS.findings, `find-${wp.id}`);
    if (finding && ['synthesized', 'converged', 'approved'].includes(finding.status)) {
      stale = true;
      stale_reason = `finding_already_${finding.status}`;
    }
  }

  const id = `ret-${crypto.randomUUID()}`;
  const ret = {
    id,
    work_package_id: wp.id,
    job_id: wp.job_id,
    returned_by,
    payload: payload || {},
    findings_ref: findings_ref || null,
    stale,
    stale_reason,
    returned_at: nowIso(),
  };
  writeJson(DIRS.returns, id, ret);

  wp.status = stale ? 'returned_stale' : 'returned';
  wp.returned_at = nowIso();
  wp.updated_at = nowIso();
  writeJson(DIRS.work_packages, wp.id, wp);

  res.status(201).json(ret);
});

// ---- 8. POST /dependency_requests ---------------------------------------
router.post('/dependency_requests', (req, res) => {
  const { from, to, cc = [], resource_type, payload } = req.body || {};
  if (!from || !to || !resource_type) {
    return res.status(400).json({ error: 'from, to, resource_type required' });
  }

  const id = `dep-${crypto.randomUUID()}`;
  const dep = {
    id,
    from,
    to,
    cc,                       // council heads CC-only, not recipients
    resource_type,
    payload: payload || {},
    status: 'open',
    response: null,
    created_at: nowIso(),
    responded_at: null,
  };
  writeJson(DIRS.dependency_requests, id, dep);
  res.status(201).json(dep);
});

// ---- 9. POST /dependency_requests/:id/respond ---------------------------
router.post('/dependency_requests/:id/respond', (req, res) => {
  const dep = readJson(DIRS.dependency_requests, req.params.id);
  if (!dep) return res.status(404).json({ error: 'dependency request not found' });
  if (dep.status !== 'open') {
    return res.status(409).json({ error: `already ${dep.status}` });
  }

  const { responded_by, outcome, payload } = req.body || {};
  if (!responded_by || !outcome) {
    return res.status(400).json({ error: 'responded_by and outcome required' });
  }
  if (!['granted', 'denied'].includes(outcome)) {
    return res.status(400).json({ error: 'outcome must be granted|denied' });
  }

  dep.response = { responded_by, outcome, payload: payload || {} };
  dep.responded_at = nowIso();
  dep.status = outcome;
  writeJson(DIRS.dependency_requests, dep.id, dep);
  res.json(dep);
});

// ---- 10. POST /findings/:id/synthesize (domain synthesis) ---------------
// :id here is the work_package_id. A single Finding record per WP,
// keyed as find-<work_package_id>. Domain must be poseidon or hades.
router.post('/findings/:id/synthesize', (req, res) => {
  const workPackageId = req.params.id;
  const wp = readJson(DIRS.work_packages, workPackageId);
  if (!wp) return res.status(404).json({ error: 'work package not found' });

  const { synthesized_by, body, domain } = req.body || {};
  if (!synthesized_by || !body || !domain) {
    return res.status(400).json({ error: 'synthesized_by, body, domain required' });
  }
  if (!['poseidon', 'hades'].includes(domain)) {
    return res.status(400).json({ error: 'domain must be poseidon|hades' });
  }

  const findingId = `find-${wp.id}`;
  let finding = readJson(DIRS.findings, findingId);
  if (!finding) {
    finding = {
      id: findingId,
      work_package_id: wp.id,
      job_id: wp.job_id,
      kind: 'domain',
      domain,
      body,
      synthesized_by,
      converged_by: null,
      approved_by: null,
      status: 'synthesized',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
  } else {
    finding.domain = domain;
    finding.body = body;
    finding.synthesized_by = synthesized_by;
    finding.kind = 'domain';
    finding.status = 'synthesized';
    finding.updated_at = nowIso();
  }
  writeJson(DIRS.findings, findingId, finding);
  res.status(201).json(finding);
});

// ---- 11. POST /findings/:id/converge (Zeus convergence) ------------------
router.post('/findings/:id/converge', (req, res) => {
  const finding = readJson(DIRS.findings, req.params.id);
  if (!finding) return res.status(404).json({ error: 'finding not found' });

  const { converged_by, body } = req.body || {};
  if (!converged_by || !body) {
    return res.status(400).json({ error: 'converged_by and body required' });
  }
  if (converged_by !== 'zeus') {
    return res.status(403).json({ error: 'only zeus may converge findings' });
  }

  finding.kind = 'convergence';
  finding.body = body;
  finding.converged_by = converged_by;
  finding.status = 'converged';
  finding.updated_at = nowIso();
  writeJson(DIRS.findings, finding.id, finding);
  res.json(finding);
});

// ---- 12. POST /findings/:id/approve --------------------------------------
router.post('/findings/:id/approve', (req, res) => {
  const finding = readJson(DIRS.findings, req.params.id);
  if (!finding) return res.status(404).json({ error: 'finding not found' });

  const { approved_by } = req.body || {};
  if (!approved_by) return res.status(400).json({ error: 'approved_by required' });

  finding.approved_by = approved_by;
  finding.status = 'approved';
  finding.updated_at = nowIso();
  writeJson(DIRS.findings, finding.id, finding);
  res.json(finding);
});

// ---- PATCH /jobs/:id — update job fields (status, routing_class, etc.) ----
router.patch('/jobs/:id', (req, res) => {
  const job = readJson(DIRS.jobs, req.params.id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  const allowed = ['status', 'routing_class', 'routing_plan_id'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) job[key] = req.body[key];
  }
  job.updated_at = nowIso();
  writeJson(DIRS.jobs, job.id, job);
  res.json(job);
});

// ---- GET /work_packages/:id — read a single work package ----
router.get('/work_packages/:id', (req, res) => {
  const wp = readJson(DIRS.work_packages, req.params.id);
  if (!wp) return res.status(404).json({ error: 'work package not found' });
  res.json(wp);
});

// ---- POST /wake-zeus — event-driven job handler trigger ----
router.post('/wake-zeus', (req, res) => {
  const { job_id, prompt, chat_id } = req.body ?? {};
  if (!job_id) return res.status(400).json({ error: 'job_id required' });
  // Respond immediately — handler runs async
  res.json({ status: 'zeus_waking', job_id });
  // Fire and forget
  executeJob({ job_id, prompt, chat_id }).catch((err) => {
    console.error('[wake-zeus] handler error:', err.message);
  });
});

// ---- Auxiliary: health + list endpoints ----
router.get('/health', (req, res) => {
  res.json({ ok: true, module: 'flywheel', primitives: Object.keys(DIRS), now: nowIso() });
});

router.get('/jobs', (req, res) => {
  try {
    const files = fs.readdirSync(DIRS.jobs).filter((f) => f.endsWith('.json'));
    const jobs = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIRS.jobs, f), 'utf8')));
    res.json({ count: jobs.length, jobs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
