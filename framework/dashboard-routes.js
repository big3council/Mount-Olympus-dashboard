// ═══════════════════════════════════════════════════════════════
// ESM MODULE — DO NOT OVERWRITE WITH COMMONJS
// This file uses ES module syntax (import/export).
// If this file gets replaced, ensure it stays ESM.
// CommonJS (require/module.exports) will break the server on restart.
// Last verified: 2026-03-28
// ═══════════════════════════════════════════════════════════════

/**
 * dashboard-routes.js — Project/Flywheel routes for the Mount Olympus Express API
 *
 * Designed to be mounted into the existing Express server on Zeus:18780.
 * Reads project state, tasks, events, and retrospectives from the NAS.
 *
 * Integration:
 *   const projectRoutes = require('./dashboard-routes.js');
 *   app.use(projectRoutes);
 *   // Or if the server uses a prefix:
 *   app.use('/api', projectRoutes);
 *
 * Endpoints added:
 *   GET /projects              — All project summaries (sorted by tier)
 *   GET /projects/:id          — Single project detail + tasks + deploys
 *   GET /events                — Recent events from events.jsonl (?limit=50)
 *   GET /retrospectives        — Gaia's retrospective entries (?limit=7)
 *   GET /deploy/status         — Current deployment pipeline state
 *
 * Created: 2026-03-27 by Hades (Dashboard Integration)
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// ── NAS paths (adjust if NAS mounts at a different location on Zeus) ──
const NAS_BASE = process.env.NAS_PATH || '/Volumes/olympus';
const PROJECTS_DIR = path.join(NAS_BASE, 'shared', 'projects');
const EVENTS_LOG = path.join(NAS_BASE, 'logs', 'events.jsonl');
const RETRO_DIR = path.join(NAS_BASE, 'gaia', 'retrospectives');
const DEPLOY_STAGING = path.join(NAS_BASE, 'deploy', 'staging');

// ── Helpers ───────────────────────────────────────────────────────────
function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function safeReaddir(dirpath) {
  try {
    return fs.readdirSync(dirpath);
  } catch {
    return [];
  }
}

function readLastLines(filepath, n = 50) {
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    return lines.slice(-n).reverse().map(line => {
      try { return JSON.parse(line); }
      catch { return { raw: line }; }
    });
  } catch {
    return [];
  }
}

// ── GET /projects — All project summaries ─────────────────────────────
router.get('/projects', (req, res) => {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return res.json({ projects: [], count: 0 });
  }

  const dirs = safeReaddir(PROJECTS_DIR).filter(d => {
    const full = path.join(PROJECTS_DIR, d);
    return fs.statSync(full).isDirectory();
  });

  const projects = dirs.map(id => {
    const pjson = readJSON(path.join(PROJECTS_DIR, id, 'project.json'));
    return pjson || { id, status: 'error', error: 'missing project.json' };
  }).sort((a, b) => {
    // Sort by tier (core first), then by updated date
    const tierOrder = { 'core': 0, '1': 0, 'infrastructure': 1, '2': 1, 'exploratory': 2, '3': 2 };
    const aTier = tierOrder[a.tier] ?? 99;
    const bTier = tierOrder[b.tier] ?? 99;
    if (aTier !== bTier) return aTier - bTier;
    return (b.updated || '').localeCompare(a.updated || '');
  });

  // Summary stats for the status board
  const summary = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    waiting: projects.filter(p => p.requires_principal_action).length,
    completed: projects.filter(p => p.status === 'completed').length,
  };

  res.json({ projects, summary });
});

// ── GET /projects/:id — Single project detail ─────────────────────────
router.get('/projects/:id', (req, res) => {
  const projectDir = path.join(PROJECTS_DIR, req.params.id);
  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = readJSON(path.join(projectDir, 'project.json'));
  if (!project) {
    return res.status(500).json({ error: 'Invalid project.json' });
  }

  // Load tasks by status (including review for the lifecycle)
  const tasks = {};
  for (const status of ['active', 'review', 'completed', 'blocked']) {
    const taskDir = path.join(projectDir, 'tasks', status);
    tasks[status] = safeReaddir(taskDir)
      .filter(f => f.endsWith('.json'))
      .map(f => readJSON(path.join(taskDir, f)))
      .filter(Boolean);
  }
  
  // Task summary for the column model
  const taskSummary = {
    total: Object.values(tasks).flat().length,
    active: (tasks.active || []).length,
    review: (tasks.review || []).length,
    accepted: (tasks.completed || []).filter(t => t?.completion?.council_accepted).length,
    blocked: (tasks.blocked || []).length,
    columns_up: (tasks.completed || []).filter(t => t?.completion?.council_accepted).length,
  };

  // Load deploys
  const deploysDir = path.join(projectDir, 'deploys');
  const deploys = safeReaddir(deploysDir)
    .filter(d => {
      const full = path.join(deploysDir, d);
      return fs.existsSync(full) && fs.statSync(full).isDirectory();
    })
    .map(d => {
      const statusFile = path.join(deploysDir, d, 'status.txt');
      const manifestFile = path.join(deploysDir, d, 'MANIFEST.md');
      return {
        id: d,
        status: fs.existsSync(statusFile)
          ? fs.readFileSync(statusFile, 'utf-8').trim()
          : 'unknown',
        has_manifest: fs.existsSync(manifestFile),
      };
    });

  // Load README if exists
  const readmePath = path.join(projectDir, 'README.md');
  const readme = fs.existsSync(readmePath)
    ? fs.readFileSync(readmePath, 'utf-8')
    : null;

  res.json({ ...project, tasks, taskSummary, deploys, readme });
});

// ── GET /events — Recent events from the event log ────────────────────
router.get('/events', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50'), 500);
  const project = req.query.project || null;

  let events = readLastLines(EVENTS_LOG, limit * 2); // Read extra for filtering

  if (project) {
    events = events.filter(e => e.project === project);
  }

  res.json({
    events: events.slice(0, limit),
    count: events.length,
    source: EVENTS_LOG,
  });
});

// ── GET /retrospectives — Gaia's retrospective entries ────────────────
router.get('/retrospectives', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '7'), 30);

  const files = safeReaddir(RETRO_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, limit);

  const entries = files.map(f => ({
    date: f.replace('.md', ''),
    filename: f,
    content: fs.readFileSync(path.join(RETRO_DIR, f), 'utf-8'),
  }));

  res.json({ retrospectives: entries, count: entries.length });
});

// ── GET /deploy/status — Deployment pipeline state ────────────────────
router.get('/deploy/status', (req, res) => {
  const staged = safeReaddir(DEPLOY_STAGING)
    .filter(d => {
      const full = path.join(DEPLOY_STAGING, d);
      return fs.existsSync(full) && fs.statSync(full).isDirectory();
    })
    .map(d => {
      const statusFile = path.join(DEPLOY_STAGING, d, 'status.txt');
      const targetFile = path.join(DEPLOY_STAGING, d, 'target.txt');
      return {
        id: d,
        status: fs.existsSync(statusFile)
          ? fs.readFileSync(statusFile, 'utf-8').trim()
          : 'unknown',
        target: fs.existsSync(targetFile)
          ? fs.readFileSync(targetFile, 'utf-8').trim()
          : 'unknown',
      };
    });

  res.json({
    deployments: staged,
    count: staged.length,
    pipeline: {
      staged: staged.filter(d => d.status === 'STAGED').length,
      executing: staged.filter(d => d.status === 'EXECUTING').length,
      executed: staged.filter(d => d.status === 'EXECUTED').length,
      failed: staged.filter(d => d.status === 'FAILED').length,
    },
  });
});

export default router;
