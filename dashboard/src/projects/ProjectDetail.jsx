import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ── ProjectDetail — full screen view ─────────────────────────────────────
 *
 * Spec (mo_projects_ui_spec, locked Apr 15 2026):
 *   Always full screen. No side panels. Top bar with project title, status
 *   badge, lead agent, exit (top left), Create Flywheel Job (top right).
 *   Body: truth_state in clean readable block (briefing feel) → divider →
 *   write feed (oldest first) — agent name, timestamp, work_done,
 *   observations, next_steps per entry.
 *   Drafts/proposals: same screen + banner: "Proposed by [agent]. Activate
 *   or dismiss."
 *   Edit: goal/notes agent-driven by default. Manual edit allowed inline.
 *
 * API base: http://100.74.201.75:18781 (mo-projects-api on Gaia)
 *   GET  /projects/:id  →  { project, recent_writes, flags }
 *
 * Write-side endpoints intentionally surface a no-op notice when missing —
 * Gaia API does not yet have:
 *   PATCH  /projects/:id           (status / inline edit)
 *   DELETE /projects/:id           (dismiss)
 *   POST   /projects/:id/flywheel  (job creation)
 * When those land, this file does not need to change.
 * ──────────────────────────────────────────────────────────────────────── */

const API_BASE = "http://100.74.201.75:18781";
const POLL_MS  = 20000;

/* Spec-locked status palette — same as ProjectCard. */
const STATUS_COLORS = {
  active:    "#4ade80",
  blocked:   "#fbbf24",
  draft:     "#6b7280",
  proposal:  "#60a5fa",
  complete:  "#475569",
  paused:    "#6b7280",
  dismissed: "#3a3a3a",
};

const AGENT_COLORS = {
  zeus:     "#e8b84b",
  poseidon: "#4ab8e8",
  hades:    "#b04adc",
  gaia:     "#78d87a",
};

function statusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.draft;
}

function agentColor(agent) {
  if (!agent) return "#3a4570";
  return AGENT_COLORS[String(agent).toLowerCase()] || "#d8dcef";
}

function relTime(iso) {
  if (!iso) return "";
  const norm = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const t = new Date(norm).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/* ── Tiny markdown renderer ───────────────────────────────────────────────
 * Just enough to render the truth_state blocks Gaia produces — h1–h4,
 * **bold**, `code`, ordered/unordered lists.
 * ──────────────────────────────────────────────────────────────────────── */
function renderMarkdown(md) {
  if (!md) return null;
  const lines = md.split("\n");
  const blocks = [];
  let listBuf = null;

  const flushList = () => {
    if (listBuf) {
      blocks.push({ type: "list", ordered: listBuf.ordered, items: listBuf.items });
      listBuf = null;
    }
  };

  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, "");
    if (line === "") { flushList(); blocks.push({ type: "blank" }); return; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushList();
      blocks.push({ type: "h", level: m[1].length, text: m[2] });
      return;
    }
    if ((m = line.match(/^(\d+)\.\s+(.*)$/))) {
      if (!listBuf || !listBuf.ordered) { flushList(); listBuf = { ordered: true, items: [] }; }
      listBuf.items.push(m[2]);
      return;
    }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (!listBuf || listBuf.ordered) { flushList(); listBuf = { ordered: false, items: [] }; }
      listBuf.items.push(m[1]);
      return;
    }
    flushList();
    blocks.push({ type: "p", text: line });
  });
  flushList();

  const inline = (text) => {
    const parts = [];
    let rest = text;
    let key = 0;
    const pushRaw = (s) => { if (s) parts.push(s); };
    while (rest.length) {
      const bold = rest.match(/\*\*(.+?)\*\*/);
      const code = rest.match(/`([^`]+)`/);
      let next = null;
      if (bold && (!code || bold.index <= code.index)) next = { kind: "b", m: bold };
      else if (code) next = { kind: "c", m: code };
      if (!next) { pushRaw(rest); break; }
      pushRaw(rest.slice(0, next.m.index));
      if (next.kind === "b") {
        parts.push(<strong key={`b${key++}`} className="pd-bold">{next.m[1]}</strong>);
      } else {
        parts.push(<code key={`c${key++}`} className="pd-code">{next.m[1]}</code>);
      }
      rest = rest.slice(next.m.index + next.m[0].length);
    }
    return parts;
  };

  const out = [];
  blocks.forEach((b, i) => {
    if (b.type === "blank") { out.push(<div key={i} className="pd-md-blank" />); return; }
    if (b.type === "h") {
      out.push(
        <div key={i} className={`pd-md-h pd-md-h${b.level}`}>{inline(b.text)}</div>
      );
      return;
    }
    if (b.type === "list") {
      const Tag = b.ordered ? "ol" : "ul";
      out.push(
        <Tag key={i} className="pd-md-list">
          {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </Tag>
      );
      return;
    }
    out.push(<div key={i} className="pd-md-p">{inline(b.text)}</div>);
  });
  return out;
}

/* ── Scoped CSS ───────────────────────────────────────────────────────── */
const styles = `
  .pd-wrap {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #05070f 0%, #06091a 100%);
    color: #d8dcef;
    font-family: "JetBrains Mono", monospace;
    display: flex;
    flex-direction: column;
    z-index: 50;
    overflow: hidden;
    animation: pd-enter 0.32s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes pd-enter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Top bar ─────────────────────────────────────────────────────── */
  .pd-topbar {
    flex: 0 0 auto;
    display: flex; align-items: center; gap: 18px;
    padding: 16px 28px;
    border-bottom: 1px solid #1a2340;
    background: linear-gradient(180deg, rgba(13,18,37,0.92) 0%, rgba(9,12,24,0.85) 100%);
    box-shadow: 0 1px 0 rgba(255,255,255,0.02), 0 4px 20px rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    position: relative;
  }
  .pd-exit {
    background: rgba(13,18,37,0.85);
    border: 1px solid #1a2340;
    color: #d8dcef;
    width: 36px; height: 36px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.18s ease, color 0.18s ease;
  }
  .pd-exit:hover { border-color: #c8960a; color: #f5d580; }

  .pd-headline { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .pd-title {
    font-size: 17px; font-weight: 600;
    color: #f5d580;
    letter-spacing: 0.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-family: "Cinzel", serif;
  }
  .pd-meta-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; }

  .pd-status-badge {
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--pd-status-color, #6b7280);
    border: 1px solid color-mix(in srgb, var(--pd-status-color, #6b7280) 35%, transparent);
    background: color-mix(in srgb, var(--pd-status-color, #6b7280) 8%, transparent);
    padding: 4px 10px;
    border-radius: 4px;
  }

  .pd-agent-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--pd-agent-color, #d8dcef) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--pd-agent-color, #d8dcef) 35%, transparent);
    color: var(--pd-agent-color, #d8dcef);
    font-size: 11px; font-weight: 500;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .pd-agent-empty {
    font-size: 11px;
    color: #3a4570;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .pd-flag-pill {
    font-size: 11px;
    color: #fbbf24;
    border: 1px solid rgba(251,191,36,0.35);
    background: rgba(251,191,36,0.06);
    padding: 3px 8px; border-radius: 4px;
    letter-spacing: 0.04em; text-transform: uppercase;
    font-weight: 500;
  }

  .pd-topbar-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pd-flywheel {
    background: transparent;
    border: 1px solid #3a2d08;
    color: #c8960a;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .pd-flywheel:hover {
    background: rgba(200,150,10,0.08);
    border-color: #c8960a;
  }
  .pd-btn-complete {
    background: rgba(74,222,128,0.06);
    border: 1px solid rgba(74,222,128,0.35);
    color: #4ade80;
    padding: 8px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .pd-btn-complete:hover {
    background: rgba(74,222,128,0.14);
    border-color: rgba(74,222,128,0.7);
  }
  .pd-btn-archive {
    background: transparent;
    border: 1px solid #2a3560;
    color: #8b93b7;
    padding: 8px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .pd-btn-archive:hover {
    background: rgba(139,147,183,0.06);
    border-color: #4a5580;
    color: #d8dcef;
  }

  /* ── Proposal banner ─────────────────────────────────────────────── */
  .pd-proposal-banner {
    flex: 0 0 auto;
    padding: 12px 28px;
    background: linear-gradient(180deg, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0.04) 100%);
    border-bottom: 1px solid rgba(96,165,250,0.25);
    display: flex; align-items: center; gap: 16px;
  }
  .pd-proposal-text {
    color: #9bc4f5;
    font-size: 12px;
    letter-spacing: 0.03em;
    flex: 1;
  }
  .pd-proposal-text strong { color: #cfe2ff; font-weight: 600; }

  .pd-btn-activate {
    background: rgba(74,222,128,0.08);
    border: 1px solid rgba(74,222,128,0.4);
    color: #4ade80;
    padding: 6px 16px; border-radius: 4px;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .pd-btn-activate:hover {
    border-color: rgba(74,222,128,0.7);
    background: rgba(74,222,128,0.14);
  }

  .pd-btn-dismiss {
    background: rgba(176,74,74,0.06);
    border: 1px solid rgba(176,74,74,0.35);
    color: #d99090;
    padding: 6px 16px; border-radius: 4px;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .pd-btn-dismiss:hover { border-color: rgba(220,80,80,0.6); color: #ec7373; }

  /* ── Toast ───────────────────────────────────────────────────────── */
  .pd-toast {
    position: absolute;
    top: 84px; left: 50%;
    transform: translateX(-50%);
    background: rgba(13,18,37,0.95);
    border: 1px solid rgba(251,191,36,0.45);
    color: #f5d580;
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 12px;
    letter-spacing: 0.02em;
    box-shadow: 0 8px 28px rgba(0,0,0,0.6), 0 0 24px rgba(251,191,36,0.08);
    z-index: 60;
    animation: pd-toast 3.5s ease-out both;
    pointer-events: none;
  }
  @keyframes pd-toast {
    0%   { opacity: 0; transform: translate(-50%, -6px); }
    12%  { opacity: 1; transform: translate(-50%, 0); }
    88%  { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, -6px); }
  }

  /* ── Body ────────────────────────────────────────────────────────── */
  .pd-body {
    flex: 1;
    overflow-y: auto;
    padding: 32px 48px 64px;
  }
  .pd-body::-webkit-scrollbar { width: 10px; }
  .pd-body::-webkit-scrollbar-track { background: transparent; }
  .pd-body::-webkit-scrollbar-thumb {
    background: rgba(42,53,96,0.5);
    border-radius: 5px;
  }
  .pd-body::-webkit-scrollbar-thumb:hover { background: rgba(74,85,128,0.7); }
  .pd-body-inner { max-width: 920px; margin: 0 auto; }

  .pd-error {
    padding: 12px 16px;
    border: 1px solid rgba(220,80,80,0.4);
    background: rgba(220,80,80,0.06);
    color: #ec9090;
    border-radius: 6px;
    margin-bottom: 24px;
    font-size: 12px;
  }
  .pd-loading {
    color: #3a4570;
    padding: 40px;
    text-align: center;
    font-size: 13px;
  }

  .pd-section-label {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #3a4570;
    margin-bottom: 6px;
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .pd-section-label-meta {
    color: #2a3560;
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: none;
  }

  /* ── Goal (inline editable) ──────────────────────────────────────── */
  .pd-goal {
    border: 1px solid #1a2340;
    border-radius: 6px;
    padding: 12px 14px;
    color: #d8dcef;
    font-size: 14px;
    line-height: 1.6;
    cursor: text;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .pd-goal:hover { background: rgba(200,150,10,0.04); border-color: rgba(200,150,10,0.28); }
  .pd-goal.empty { color: #3a4570; font-style: italic; }
  .pd-goal-edit {
    width: 100%;
    background: rgba(13,18,37,0.6);
    border: 1px solid rgba(200,150,10,0.45);
    border-radius: 6px;
    color: #e8e2cf;
    font-size: 14px;
    font-family: "JetBrains Mono", monospace;
    line-height: 1.6;
    padding: 12px 14px;
    resize: vertical;
    outline: none;
  }

  /* ── Truth state block ───────────────────────────────────────────── */
  .pd-truth {
    background: linear-gradient(160deg, rgba(13,18,37,0.55) 0%, rgba(7,9,20,0.55) 100%);
    border: 1px solid #1a2340;
    border-radius: 8px;
    padding: 22px 26px;
    font-size: 14px;
    line-height: 1.75;
    box-shadow: 0 4px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.02);
    margin-top: 6px;
  }
  .pd-truth-empty { color: #3a4570; font-style: italic; }

  /* markdown */
  .pd-md-blank { height: 8px; }
  .pd-md-h     { color: #f5d580; font-weight: 600; }
  .pd-md-h1    { font-size: 22px; margin: 18px 0 8px; letter-spacing: 0.02em; font-family: "Cinzel", serif; }
  .pd-md-h2    { font-size: 18px; margin: 18px 0 8px; letter-spacing: 0.02em; }
  .pd-md-h3    { font-size: 15px; margin: 12px 0 8px; }
  .pd-md-h4    { font-size: 14px; margin: 12px 0 8px; }
  .pd-md-h:first-child { margin-top: 0; }
  .pd-md-p     { color: #d8dcef; line-height: 1.75; margin-bottom: 4px; }
  .pd-md-list  { padding-left: 22px; margin: 4px 0 8px; color: #d8dcef; line-height: 1.7; }
  .pd-md-list li { margin-bottom: 4px; }
  .pd-bold     { color: #f5d580; font-weight: 600; }
  .pd-code     {
    background: rgba(74,184,232,0.08);
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 0.92em;
    color: #9bd0f0;
    font-family: "JetBrains Mono", monospace;
  }

  /* ── Divider ─────────────────────────────────────────────────────── */
  .pd-divider {
    margin: 40px 0 20px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(42,53,96,0.6), transparent);
  }

  /* ── Write feed ──────────────────────────────────────────────────── */
  .pd-empty-feed {
    color: #3a4570;
    font-style: italic;
    padding: 16px 0;
    font-size: 13px;
  }
  .pd-feed { display: flex; flex-direction: column; gap: 12px; }
  .pd-write-card {
    background: linear-gradient(160deg, rgba(13,18,37,0.7) 0%, rgba(7,9,20,0.8) 100%);
    border: 1px solid #1a2340;
    border-left: 3px solid var(--pd-write-accent, #3a4570);
    border-radius: 6px;
    padding: 14px 18px;
    transition: border-color 0.15s ease;
  }
  .pd-write-card:hover { border-color: #2a3560; }
  .pd-write-head {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 10px;
  }
  .pd-write-time {
    color: #3a4570;
    font-size: 11px;
    letter-spacing: 0.02em;
  }
  .pd-flywheel-tag {
    margin-left: auto;
    font-size: 10px;
    color: #9bd0f0;
    background: rgba(74,184,232,0.06);
    border: 1px solid rgba(74,184,232,0.3);
    padding: 2px 8px;
    border-radius: 3px;
    font-family: "JetBrains Mono", monospace;
  }
  .pd-write-row {
    display: flex; gap: 14px; margin-bottom: 6px; align-items: baseline;
  }
  .pd-write-row:last-child { margin-bottom: 0; }
  .pd-write-row-label {
    flex: 0 0 100px;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .pd-write-row-body {
    color: #d8dcef;
    font-size: 13px;
    line-height: 1.65;
    flex: 1;
    white-space: pre-wrap;
  }
`;

/* ── Component ────────────────────────────────────────────────────────── */
export default function ProjectDetail({ projectId, onClose }) {
  const [data, setData]               = useState(null);   // { project, recent_writes, flags }
  const [error, setError]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft]     = useState("");
  const [actionMsg, setActionMsg]     = useState(null);
  const pollRef = useRef(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setData(j);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    pollRef.current = setInterval(fetchProject, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchProject]);

  // Esc to close (when not editing)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !editingGoal) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editingGoal]);

  /* ── Mutating actions ────────────────────────────────────────────── */
  const flashAction = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3500);
  };

  const patchProject = async (body, label) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { await fetchProject(); return true; }
      if (res.status === 404 || res.status === 405) {
        flashAction(`${label} — Gaia API does not yet support PATCH /projects/:id`);
        return false;
      }
      flashAction(`${label} failed (HTTP ${res.status})`);
      return false;
    } catch (e) {
      flashAction(`${label} failed: ${e.message}`);
      return false;
    }
  };

  const handleActivate = () => patchProject({ status: "active" }, "Activate");
  const handleDismiss  = () => patchProject({ status: "dismissed" }, "Dismiss");

  const handleMarkComplete = async () => {
    if (!window.confirm("Mark this project as complete?")) return;
    await patchProject({ status: "complete" }, "Mark complete");
  };

  const handleArchive = async () => {
    const ok = await patchProject({ status: "paused" }, "Archive");
    if (ok) onClose?.();
  };

  const handleSaveGoal = async () => {
    setEditingGoal(false);
    if (!data?.project) return;
    const trimmed = goalDraft.trim();
    if (trimmed === (data.project.goal || "").trim()) return;
    const ok = await patchProject({ goal: trimmed }, "Save goal");
    if (!ok) {
      // Keep the in-memory edit so user sees their text even if API can't persist
      setData((d) => d ? { ...d, project: { ...d.project, goal: trimmed } } : d);
    }
  };

  const handleCreateFlywheel = async () => {
    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/flywheel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "project_detail" }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        flashAction(`Flywheel job created${j.job_id ? `: ${j.job_id}` : ""}`);
      } else if (res.status === 404 || res.status === 405) {
        flashAction("Create Flywheel Job — endpoint not yet on Gaia API");
      } else {
        flashAction(`Flywheel job failed (HTTP ${res.status})`);
      }
    } catch (e) {
      flashAction(`Flywheel job failed: ${e.message}`);
    }
  };

  /* ── Derived ─────────────────────────────────────────────────────── */
  const project = data?.project;
  const writes  = data?.recent_writes || [];
  const flags   = data?.flags || [];
  const isProposal = project && (
    project.status === "proposal" ||
    (project.status === "draft" && project.proposed_by)
  );

  const sortedWrites = useMemo(() => (
    [...writes].sort((a, b) => {
      const ta = new Date((a.written_at || "").replace(" ", "T") + "Z").getTime();
      const tb = new Date((b.written_at || "").replace(" ", "T") + "Z").getTime();
      return ta - tb;
    })
  ), [writes]);

  return (
    <>
      <style>{styles}</style>
      <div className="pd-wrap" role="dialog" aria-label="Project detail">

        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div className="pd-topbar">
          <button
            type="button"
            className="pd-exit"
            onClick={onClose}
            aria-label="Close project detail"
            title="Close (Esc)"
          >
            ←
          </button>

          <div className="pd-headline">
            <div className="pd-title">
              {project?.title || (loading ? "Loading…" : "Project")}
            </div>
            <div className="pd-meta-row">
              {project && (
                <div
                  className="pd-status-badge"
                  style={{ "--pd-status-color": statusColor(project.status) }}
                >
                  {project.status}
                </div>
              )}
              {project?.lead_agent ? (
                <div
                  className="pd-agent-chip"
                  style={{ "--pd-agent-color": agentColor(project.lead_agent) }}
                >
                  {project.lead_agent}
                </div>
              ) : project ? (
                <div className="pd-agent-empty">unassigned</div>
              ) : null}
              {flags.length > 0 && (
                <div className="pd-flag-pill">
                  ⚑ {flags.length} flag{flags.length === 1 ? "" : "s"}
                </div>
              )}
            </div>
          </div>

          <div className="pd-topbar-actions">
            {project && project.status !== "complete" && (
              <button
                type="button"
                className="pd-btn-complete"
                onClick={handleMarkComplete}
                title="Mark this project as complete"
              >
                ✓ Mark Complete
              </button>
            )}
            {project && project.status !== "paused" && (
              <button
                type="button"
                className="pd-btn-archive"
                onClick={handleArchive}
                title="Archive (pause) this project"
              >
                ▭ Archive
              </button>
            )}
            <button
              type="button"
              className="pd-flywheel"
              onClick={handleCreateFlywheel}
              title="Spawn a flywheel job scoped to this project"
            >
              + Flywheel Job
            </button>
          </div>
        </div>

        {/* ── Proposal banner ─────────────────────────────────────── */}
        {isProposal && project && (
          <div className="pd-proposal-banner">
            <div className="pd-proposal-text">
              Proposed by <strong>{project.proposed_by || "unknown"}</strong>. Activate or dismiss.
            </div>
            <button type="button" className="pd-btn-activate" onClick={handleActivate}>
              Activate
            </button>
            <button type="button" className="pd-btn-dismiss" onClick={handleDismiss}>
              Dismiss
            </button>
          </div>
        )}

        {/* ── Toast ───────────────────────────────────────────────── */}
        {actionMsg && <div className="pd-toast">{actionMsg}</div>}

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="pd-body">
          <div className="pd-body-inner">

            {error && <div className="pd-error">Failed to load project: {error}</div>}
            {loading && !data && <div className="pd-loading">Loading project…</div>}

            {project && (
              <>
                {/* Goal — inline editable */}
                <div className="pd-section-label">Goal</div>
                {editingGoal ? (
                  <textarea
                    autoFocus
                    className="pd-goal-edit"
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(e.target.value)}
                    onBlur={handleSaveGoal}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveGoal();
                      if (e.key === "Escape") setEditingGoal(false);
                    }}
                    rows={Math.max(2, goalDraft.split("\n").length)}
                  />
                ) : (
                  <div
                    className={`pd-goal ${project.goal ? "" : "empty"}`}
                    onClick={() => { setGoalDraft(project.goal || ""); setEditingGoal(true); }}
                    title="Click to edit"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setGoalDraft(project.goal || "");
                        setEditingGoal(true);
                      }
                    }}
                  >
                    {project.goal || "No goal set — click to add one."}
                  </div>
                )}

                {/* Truth state */}
                <div className="pd-section-label" style={{ marginTop: 32 }}>
                  <span>Current State</span>
                  {project.truth_state_updated_at && (
                    <span className="pd-section-label-meta">
                      updated {relTime(project.truth_state_updated_at)}
                    </span>
                  )}
                </div>
                <div className="pd-truth">
                  {project.truth_state
                    ? renderMarkdown(project.truth_state)
                    : <div className="pd-truth-empty">No truth state yet — agent writes will consolidate here.</div>}
                </div>

                {/* Divider */}
                <div className="pd-divider" />

                {/* Write feed */}
                <div className="pd-section-label">
                  <span>Write Feed</span>
                  <span className="pd-section-label-meta">
                    {sortedWrites.length} {sortedWrites.length === 1 ? "entry" : "entries"} · oldest first
                  </span>
                </div>

                {sortedWrites.length === 0 ? (
                  <div className="pd-empty-feed">No writes yet.</div>
                ) : (
                  <div className="pd-feed">
                    {sortedWrites.map((w) => (
                      <div
                        key={w.id}
                        className="pd-write-card"
                        style={{ "--pd-write-accent": agentColor(w.agent_name) }}
                      >
                        <div className="pd-write-head">
                          <div
                            className="pd-agent-chip"
                            style={{ "--pd-agent-color": agentColor(w.agent_name) }}
                          >
                            {w.agent_name}
                          </div>
                          <div className="pd-write-time">{relTime(w.written_at)}</div>
                          {w.flywheel_job_id && (
                            <div className="pd-flywheel-tag" title="Triggered a flywheel job">
                              ⚙ {w.flywheel_job_id}
                            </div>
                          )}
                        </div>
                        {w.work_done && (
                          <WriteRow label="Work done" body={w.work_done} accent="#4ade80" />
                        )}
                        {w.observations && (
                          <WriteRow label="Observations" body={w.observations} accent="#9bc4f5" />
                        )}
                        {w.next_steps && (
                          <WriteRow label="Next steps" body={w.next_steps} accent="#f5d580" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function WriteRow({ label, body, accent }) {
  return (
    <div className="pd-write-row">
      <div className="pd-write-row-label" style={{ color: accent }}>{label}</div>
      <div className="pd-write-row-body">{body}</div>
    </div>
  );
}
