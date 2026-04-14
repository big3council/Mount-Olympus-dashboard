/**
 * council-memory.js — hybrid persistent memory for B3C council (T2) sessions.
 *
 * The individual agents (Zeus, Poseidon, Hades) already remember Carson via
 * their own OpenClaw instances. But the COUNCIL as a body has artifacts that
 * don't belong to any single agent: the deliberation arc, the verdict, the
 * quorum results, the pattern across many convenings. Those need their own
 * persistent store so a second council session can reference the first.
 *
 * Hybrid scope:
 *   - Per-user:       council rulings specific to one user
 *     /Volumes/olympus/pool/memory/{user}/council/archive.jsonl
 *     /Volumes/olympus/pool/memory/{user}/council/session.json  (rolling summary + last N)
 *
 *   - Institutional:  the council's voice-of-the-body across ALL users
 *     /Volumes/olympus/pool/memory/council/institutional/archive.jsonl
 *     /Volumes/olympus/pool/memory/council/institutional/patterns.json
 *
 * Read at the start of runTier2() to inject prior-council context into Zeus's
 * opening prompt. Write at the end of runTier2() to append this session.
 *
 * Patterns.json is distilled by Gaia during her nightly retrospective and
 * evolves slowly. This module only reads it — updates are owned by gaia.js.
 */

import fs from 'fs';
import path from 'path';

const MEMORY_ROOT         = '/Volumes/olympus/pool/memory';
const INSTITUTIONAL_DIR   = path.join(MEMORY_ROOT, 'council', 'institutional');
const SESSION_RECENT_N    = 5;   // keep the last N session summaries hot
const SUMMARY_CHAR_CAP    = 400; // per-session summary budget

// ── Path helpers ─────────────────────────────────────────────────────────────

function userIdToKey(userId) {
  if (userId == null) return 'anonymous';
  // Carson / Tyler map — anyone else stays as their raw id.
  const s = String(userId);
  if (s === '8150818650') return 'carson';
  if (s === '874345067')  return 'tyler';
  return s;
}

function userCouncilDir(userKey) {
  return path.join(MEMORY_ROOT, userKey, 'council');
}

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}

// ── Safe JSON/JSONL helpers ──────────────────────────────────────────────────

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
  catch (err) { console.warn('[council-memory] write failed', filePath, err.message); }
}

function appendJsonl(filePath, entry) {
  ensureDir(path.dirname(filePath));
  try { fs.appendFileSync(filePath, JSON.stringify(entry) + '\n'); }
  catch (err) { console.warn('[council-memory] append failed', filePath, err.message); }
}

// ── Read: prior-session context for an upcoming T2 ───────────────────────────

/**
 * Build the context block to inject into Zeus's opening prompt for a new
 * council session. Combines per-user session continuity with institutional
 * patterns. Safe to call with unknown user — returns null.
 */
export function loadCouncilContext(userId) {
  const userKey = userIdToKey(userId);
  const userSessionPath = path.join(userCouncilDir(userKey), 'session.json');
  const instPatternsPath = path.join(INSTITUTIONAL_DIR, 'patterns.json');

  const userSession   = readJson(userSessionPath, null);
  const institutional = readJson(instPatternsPath, null);

  const parts = [];

  if (userSession?.sessions?.length) {
    const recent = userSession.sessions.slice(-SESSION_RECENT_N);
    const lines  = recent.map((s, i) => {
      const idx = recent.length - i; // 1 = oldest in the window
      return `  • ${s.timestamp?.slice(0, 10) ?? 'unknown'} — ${s.summary || s.verdict || '(no summary)'}`;
    });
    parts.push(
      `Prior council sessions with this user (${recent.length} most recent):\n${lines.join('\n')}`
    );
  }

  if (institutional?.patterns?.length) {
    parts.push(
      `Institutional patterns across all users (Gaia-distilled):\n` +
      institutional.patterns.map(p => `  • ${p}`).join('\n')
    );
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n');
}

// ── Write: persist a completed council session ───────────────────────────────

/**
 * Called at the end of runTier2() with a structured session record.
 * Appends to both per-user and institutional archives, and updates the
 * rolling per-user session.json.
 *
 * @param {object} session
 * @param {string} session.id             — mission/request id
 * @param {string|number|null} session.userId
 * @param {string} session.userInput       — the triggering prompt
 * @param {string} session.finalOutput     — Zeus's synthesis
 * @param {Array<{speaker,text}>} session.councilInitial
 * @param {Array<{speaker,text}>} session.councilBackend
 * @param {Array<string>}   session.failures
 * @param {number}          session.elapsedMs
 * @param {string}         [session.summary] — optional pre-distilled summary
 */
export function persistCouncilSession(session) {
  const ts = new Date().toISOString();
  const userKey = userIdToKey(session.userId);

  const entry = {
    id:        session.id,
    timestamp: ts,
    userKey,
    userInput: (session.userInput || '').slice(0, 1000),
    verdict:   truncate(session.finalOutput, SUMMARY_CHAR_CAP),
    summary:   session.summary
                || quickSummary(session.userInput, session.finalOutput, SUMMARY_CHAR_CAP),
    councilInitial:  (session.councilInitial || []).slice(-6),
    councilBackend:  (session.councilBackend || []).slice(-6),
    failures:        session.failures || [],
    elapsedMs:       session.elapsedMs || null,
  };

  // Per-user archive (append)
  const userDir = userCouncilDir(userKey);
  appendJsonl(path.join(userDir, 'archive.jsonl'), entry);

  // Institutional archive (append, scrubbed of per-user detail flag for Gaia)
  appendJsonl(path.join(INSTITUTIONAL_DIR, 'archive.jsonl'), { ...entry, _scope: 'institutional' });

  // Rolling per-user session.json — keep the latest N summaries hot for quick
  // injection without re-reading the archive.
  const sessionPath = path.join(userDir, 'session.json');
  const current     = readJson(sessionPath, { sessions: [] });
  const nextSessions = [...(current.sessions || []), {
    id:        entry.id,
    timestamp: entry.timestamp,
    summary:   entry.summary,
    verdict:   truncate(entry.verdict, 200),
  }].slice(-SESSION_RECENT_N * 2); // keep 2× in case we widen the window later
  writeJson(sessionPath, { sessions: nextSessions, updated_at: ts });
}

// ── Utilities ────────────────────────────────────────────────────────────────

function truncate(s, n) {
  if (!s) return '';
  const str = String(s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

// Local quick-and-dirty summary when no Gaia distillation is available yet.
// Produces a short "user asked X, council ruled Y" line from first/last
// fragments. Gaia's nightly pass replaces these with real summaries.
function quickSummary(input, output, cap) {
  const askFragment = truncate((input || '').split('\n')[0], 120);
  const verdictFrag = truncate((output || '').split('\n').find(l => l.trim()) || '', 200);
  return truncate(`asked: "${askFragment}" → verdict: ${verdictFrag}`, cap);
}
