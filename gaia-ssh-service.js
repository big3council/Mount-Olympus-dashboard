/**
 * gaia-ssh-service.js — Gaia's SSH Control Service
 *
 * Runs on Gaia's machine (192.168.1.14) on port 18790.
 * Accepts POST /ssh-control from the Zeus framework and executes SSH commands
 * locally using Gaia's own keypair (~/.ssh/id_ed25519).
 *
 * Zero external dependencies — only Node.js built-ins.
 *
 * Start:
 *   GAIA_SSH_SERVICE_TOKEN=<shared-secret> node gaia-ssh-service.js
 *
 * Or with pm2:
 *   GAIA_SSH_SERVICE_TOKEN=<shared-secret> pm2 start gaia-ssh-service.js --name gaia-ssh-ctrl
 */

import http     from 'http';
import { execFile } from 'child_process';
import fs       from 'fs';
import path     from 'path';
import os       from 'os';

const PORT     = 18790;
const SSH_KEY  = path.join(os.homedir(), '.ssh', 'id_ed25519');
const LOG_FILE = path.join(os.homedir(), 'olympus', 'gaia', 'ssh-control.log');
const TOKEN    = process.env.GAIA_SSH_SERVICE_TOKEN ?? '';

const VALID_NODES = {
  zeus:     'zeus@192.168.1.11',
  poseidon: 'poseidon@192.168.1.12',
  hades:    'hades@192.168.1.13',
};

function writeLog(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, entry + '\n', 'utf8');
  } catch (err) {
    console.error('[SSH Ctrl] Log write failed:', err.message);
  }
}

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  // Auth check
  if (TOKEN) {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${TOKEN}`) {
      return jsonResponse(res, 401, { error: 'unauthorized' });
    }
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    return jsonResponse(res, 200, { ok: true, service: 'gaia-ssh-control', nodes: Object.keys(VALID_NODES) });
  }

  // SSH control
  if (req.method === 'POST' && req.url === '/ssh-control') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        return jsonResponse(res, 400, { error: 'invalid JSON' });
      }

      const { node, command, reason } = payload;
      if (!node || !command || !reason) {
        return jsonResponse(res, 400, { error: 'node, command, and reason are required' });
      }

      const nodeIp = VALID_NODES[node];
      if (!nodeIp) {
        return jsonResponse(res, 400, { error: `Unknown node: "${node}". Valid: zeus, poseidon, hades` });
      }

      const timestamp = new Date().toISOString();
      console.log(`[SSH Ctrl] → ${node} (${nodeIp}): ${command}`);
      console.log(`[SSH Ctrl]   reason: ${reason}`);

      const args = [
        '-i', SSH_KEY,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=10',
        '-o', 'BatchMode=yes',
        '-o', 'LogLevel=ERROR',
        nodeIp,
        command,
      ];

      execFile('ssh', args, { timeout: 30000 }, (err, stdout, stderr) => {
        const stdoutTrim = (stdout ?? '').trim();
        const stderrTrim = (stderr ?? '').trim();
        const ok         = !err;
        const result     = ok
          ? (stdoutTrim || '(no output)')
          : `ERROR: ${err.message}${stderrTrim ? '\n' + stderrTrim : ''}`;

        const logEntry = [
          `[${timestamp}]`,
          `  node:    ${node} (${nodeIp})`,
          `  command: ${command}`,
          `  reason:  ${reason}`,
          `  status:  ${ok ? 'OK' : 'FAILED'}`,
          `  result:  ${result}`,
          '',
        ].join('\n');
        writeLog(logEntry);

        console.log(`[SSH Ctrl] ${node} → ${ok ? 'OK' : 'FAILED'}: ${result.slice(0, 80)}`);
        jsonResponse(res, 200, { ok, result, node, command, timestamp });
      });
    });
    return;
  }

  jsonResponse(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SSH Ctrl] Gaia SSH control service listening on :${PORT}`);
  console.log(`[SSH Ctrl] SSH key: ${SSH_KEY}`);
  console.log(`[SSH Ctrl] Valid nodes: ${Object.entries(VALID_NODES).map(([n, ip]) => `${n} → ${ip}`).join(', ')}`);
  if (!TOKEN) {
    console.warn('[SSH Ctrl] WARNING: GAIA_SSH_SERVICE_TOKEN not set — service running without auth');
  } else {
    console.log('[SSH Ctrl] Token auth: enabled');
  }
});

server.on('error', (err) => {
  console.error('[SSH Ctrl] Server error:', err.message);
  process.exit(1);
});
