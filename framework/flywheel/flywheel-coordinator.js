// ~/olympus/framework/flywheel/flywheel-coordinator.js
// Mount Olympus Flywheel — Timeout Coordinator
// Runs as PM2 process `olympus-flywheel-coordinator`.
// Every 30s, scans flywheel storage for stale records and expires them.
// ADDITIVE ONLY — does not touch any pre-existing framework files.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = __dirname;
const DIRS = {
  work_packages:       path.join(ROOT, 'work_packages'),
  dependency_requests: path.join(ROOT, 'dependency_requests'),
  routing_plans:       path.join(ROOT, 'routing_plans'),
};

// Tuneables
const POLL_INTERVAL_MS              = 30 * 1000;
const WORK_PACKAGE_ACCEPT_TIMEOUT_MS = 15 * 60 * 1000; // 15 min to accept an open WP
const DEPENDENCY_REQUEST_TIMEOUT_MS  = 30 * 60 * 1000; // 30 min to respond to an open dep req

function log(...args) {
  console.log('[flywheel-coordinator]', new Date().toISOString(), ...args);
}

function readAllJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    } catch (e) {
      log('parse error', f, e.message);
    }
  }
  return out;
}

function writeJson(dir, id, data) {
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(data, null, 2));
}

function tick() {
  const now = Date.now();
  let expired_wp = 0;
  let expired_dep = 0;

  // Work packages that never got accepted within the window.
  for (const wp of readAllJson(DIRS.work_packages)) {
    if (wp.status === 'open' && !wp.accepted_at) {
      const age = now - new Date(wp.created_at).getTime();
      if (age > WORK_PACKAGE_ACCEPT_TIMEOUT_MS) {
        wp.status = 'timed_out';
        wp.updated_at = new Date().toISOString();
        wp.signals = wp.signals || [];
        wp.signals.push({
          signal: 'timeout',
          note: `no accept within ${WORK_PACKAGE_ACCEPT_TIMEOUT_MS / 1000}s`,
          from: 'flywheel-coordinator',
          at: wp.updated_at,
        });
        writeJson(DIRS.work_packages, wp.id, wp);
        expired_wp++;
      }
    }
  }

  // Dependency requests that never got a response.
  for (const dep of readAllJson(DIRS.dependency_requests)) {
    if (dep.status === 'open') {
      const age = now - new Date(dep.created_at).getTime();
      if (age > DEPENDENCY_REQUEST_TIMEOUT_MS) {
        dep.status = 'expired';
        dep.responded_at = new Date().toISOString();
        writeJson(DIRS.dependency_requests, dep.id, dep);
        expired_dep++;
      }
    }
  }

  // Routing plans stuck in proposed for >20 min
  let expired_plans = 0;
  for (const plan of readAllJson(DIRS.routing_plans)) {
    if (plan.status === 'proposed') {
      const age = now - new Date(plan.created_at).getTime();
      if (age > 20 * 60 * 1000) {
        plan.status = 'timed_out';
        plan.updated_at = new Date().toISOString();
        writeJson(DIRS.routing_plans, plan.id, plan);
        expired_plans++;
      }
    }
  }

  if (expired_wp || expired_dep || expired_plans) {
    log(`tick: expired ${expired_wp} WP, ${expired_dep} dep req, ${expired_plans} routing plans`);
  }
}

// Graceful shutdown for PM2 restarts
function shutdown() {
  log('shutting down');
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

log('starting — poll interval', POLL_INTERVAL_MS, 'ms');
// First tick immediately, then on the interval.
tick();
setInterval(tick, POLL_INTERVAL_MS);
