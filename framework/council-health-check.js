#!/usr/bin/env node
/**
 * council-health-check.js — Probe all 4 council nodes via /health endpoint
 * Zeus uses the framework port (18780), others use OpenClaw gateway (18789).
 * Reports ok/unreachable per node, exits 0 if all healthy, 1 if any down.
 *
 * Usage: node council-health-check.js
 */

const NODES = [
  { name: 'zeus',     host: 'localhost',        port: 18780, path: '/health' },
  { name: 'poseidon', host: '100.114.203.41',   port: 18789, path: '/health' },
  { name: 'hades',    host: '100.68.217.82',    port: 18789, path: '/health' },
  { name: 'gaia',     host: '100.74.201.75',    port: 18789, path: '/health' },
];

const TIMEOUT_MS = 5000;

async function checkNode(node) {
  const url = `http://${node.host}:${node.port}${node.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      let detail;
      try { detail = await res.json(); } catch { detail = { status: `HTTP ${res.status}` }; }
      return { ...node, status: 'ok', detail };
    }
    return { ...node, status: 'unreachable', detail: `HTTP ${res.status}` };
  } catch (err) {
    clearTimeout(timer);
    return { ...node, status: 'unreachable', detail: err.message };
  }
}

(async () => {
  const results = await Promise.all(NODES.map(checkNode));
  let allHealthy = true;

  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : '❌';
    const svc = r.detail?.service || r.detail?.status || 'ok';
    const detail = r.status === 'ok' ? `(${svc})` : `(${r.detail})`;
    console.log(`${icon} ${r.name.padEnd(10)} ${r.status.padEnd(12)} ${detail}`);
    if (r.status !== 'ok') allHealthy = false;
  }

  console.log(`\n${allHealthy ? 'ALL HEALTHY' : 'DEGRADED'}`);
  process.exit(allHealthy ? 0 : 1);
})();
