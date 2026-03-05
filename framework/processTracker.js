/**
 * processTracker.js — Registry for tracking active child processes per requestId.
 * Allows queue.js to kill SSH sessions when a mission is cancelled.
 */

import { execFile } from 'child_process';

// requestId → Set<ChildProcess>
const registry = new Map();

/**
 * Register a child process under a requestId.
 * Auto-removes when the process exits.
 */
export function register(requestId, cp) {
  if (!registry.has(requestId)) registry.set(requestId, new Set());
  const set = registry.get(requestId);
  set.add(cp);
  cp.once('exit', () => {
    set.delete(cp);
    if (set.size === 0) registry.delete(requestId);
  });
}

/**
 * Kill all registered processes for a requestId.
 * Returns number of processes signalled.
 */
export function killAll(requestId) {
  const set = registry.get(requestId);
  if (!set || set.size === 0) return 0;
  let killed = 0;
  for (const cp of set) {
    try {
      process.kill(cp.pid, 'SIGTERM');
      killed++;
    } catch { /* already exited */ }
  }
  return killed;
}

/**
 * Remove all tracking data for a completed requestId.
 */
export function cleanup(requestId) {
  registry.delete(requestId);
}

/**
 * Promisified execFile that registers the child process for potential cancellation.
 * Drop-in replacement for promisify(execFile) calls.
 */
export function execFileTracked(file, args, opts, requestId) {
  return new Promise((resolve, reject) => {
    const cp = execFile(file, args, opts, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
    if (requestId) register(requestId, cp);
  });
}
