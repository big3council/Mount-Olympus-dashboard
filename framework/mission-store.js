/**
 * mission-store.js — NAS-backed mission persistence for Mount Olympus B3C pipeline.
 *
 * Writes mission state to /Volumes/olympus/pool/missions/{id}.json at every
 * phase transition. Persistence failures NEVER crash the pipeline — they log
 * and continue. All operations are synchronous (fs.*Sync) to keep them simple
 * and atomic within the Node event loop.
 *
 * Also writes findings to /Volumes/olympus/pool/findings/{id}.json after delivery.
 */

import fs from 'fs';
import path from 'path';

const MISSIONS_DIR = '/Volumes/olympus/pool/missions';
const FINDINGS_DIR = '/Volumes/olympus/pool/findings';

// Ensure directories exist (once at load time)
try { fs.mkdirSync(MISSIONS_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(FINDINGS_DIR, { recursive: true }); } catch {}

/**
 * Write a full mission object to NAS. Creates or overwrites.
 * @param {object} mission — must have an `id` field
 */
export function writeMission(mission) {
  if (!mission?.id) return;
  try {
    const fp = path.join(MISSIONS_DIR, `${mission.id}.json`);
    fs.writeFileSync(fp, JSON.stringify(mission, null, 2));
  } catch (e) {
    console.error('[mission-store] writeMission error:', e.message);
  }
}

/**
 * Read a mission by ID. Returns null if not found or on error.
 * @param {string} id
 * @returns {object|null}
 */
export function readMission(id) {
  try {
    const fp = path.join(MISSIONS_DIR, `${id}.json`);
    if (!fs.existsSync(fp)) return null;
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.error('[mission-store] readMission error:', e.message);
    return null;
  }
}

/**
 * Merge updates into an existing mission. Read → merge → write.
 * Creates the mission if it doesn't exist yet.
 * @param {string} id
 * @param {object} updates — fields to merge
 */
export function updateMission(id, updates) {
  try {
    const existing = readMission(id) || { id };
    const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
    writeMission(merged);
  } catch (e) {
    console.error('[mission-store] updateMission error:', e.message);
  }
}

/**
 * List the N most recent missions by file modification time.
 * @param {number} [limit=20]
 * @returns {object[]}
 */
export function listMissions(limit = 20) {
  try {
    if (!fs.existsSync(MISSIONS_DIR)) return [];
    const files = fs.readdirSync(MISSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const fp = path.join(MISSIONS_DIR, f);
        return { path: fp, mtime: fs.statSync(fp).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit);
    return files.map(f => {
      try { return JSON.parse(fs.readFileSync(f.path, 'utf8')); }
      catch { return null; }
    }).filter(Boolean);
  } catch (e) {
    console.error('[mission-store] listMissions error:', e.message);
    return [];
  }
}

/**
 * Write a finding after delivery. Extracts topic tags from the prompt.
 * @param {string} missionId
 * @param {string} prompt — original user request
 * @param {string} tier — T1, T2, TIER_1, etc.
 * @param {string} agent — which agent handled (for T1) or 'council' (for T2)
 * @param {string} synthesis — final output text
 */
export function writeFinding(missionId, prompt, tier, agent, synthesis) {
  try {
    // Simple keyword extraction for topic tags
    const words = prompt.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 10);
    const uniqueWords = [...new Set(words)];

    const finding = {
      id: missionId,
      prompt: prompt.slice(0, 500),
      tier,
      agent: agent || 'council',
      synthesis: synthesis.slice(0, 500),
      topic_tags: uniqueWords,
      created_at: new Date().toISOString(),
    };

    const fp = path.join(FINDINGS_DIR, `${missionId}.json`);
    fs.writeFileSync(fp, JSON.stringify(finding, null, 2));
    console.log('[mission-store] finding saved:', missionId);
  } catch (e) {
    console.error('[mission-store] writeFinding error:', e.message);
  }
}
