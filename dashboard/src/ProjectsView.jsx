import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ProjectCard from "./projects/ProjectCard";
import FlagOrb from "./projects/FlagOrb";

/* ── Config ───────────────────────────────────────────────────────────── */
const GAIA_API = "http://100.74.201.75:18781";
const POLL_MS  = 30_000;

/* ── Filter definitions ───────────────────────────────────────────────── */
const FILTERS = [
  { key: "all",       label: "All",       match: () => true },
  { key: "active",    label: "Active",    match: (p) => p.status === "active"   },
  { key: "blocked",   label: "Blocked",   match: (p) => p.status === "blocked"  },
  { key: "proposals", label: "Proposals", match: (p) => p.status === "proposal" || p.status === "draft" },
  { key: "complete",  label: "Complete",  match: (p) => p.status === "complete" },
];

/* ── CSS (scoped to .projects-view) ───────────────────────────────────── */
const styles = `
  .projects-view {
    position: relative;
    width: 100%;
    height: calc(100vh - 52px);
    display: flex; flex-direction: column;
    background: transparent;
    font-family: "JetBrains Mono", monospace;
    color: #d8dcef;
    overflow: hidden;
  }

  .projects-header {
    position: relative;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 28px 12px;
    border-bottom: 1px solid #0d1225;
  }
  .projects-title {
    font-family: "Cinzel", serif;
    font-size: 16px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #c8960a;
    margin: 0;
  }
  .projects-header-right {
    display: flex; align-items: center; gap: 14px;
  }
  .projects-flag-cluster {
    display: flex; align-items: center; gap: 6px;
    min-width: 24px; min-height: 24px;
  }
  .projects-add-btn {
    font-family: "Cinzel", serif;
    font-size: 18px;
    line-height: 1;
    color: #c8960a;
    background: transparent;
    border: 1px solid #3a2d08;
    border-radius: 50%;
    width: 28px; height: 28px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  }
  .projects-add-btn:hover {
    background: rgba(200, 150, 10, 0.1);
    border-color: #c8960a;
    transform: scale(1.05);
  }

  .projects-filter-row {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 28px;
    border-bottom: 1px solid #0d1225;
  }
  .projects-pill {
    position: relative;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #4a5580;
    background: transparent;
    border: 1px solid #1a2340;
    border-radius: 999px;
    padding: 6px 14px;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }
  .projects-pill:hover { color: #8b93b7; border-color: #2a3560; }
  .projects-pill.active {
    color: #c8960a;
    border-color: #c8960a;
    background: rgba(200, 150, 10, 0.06);
  }
  .projects-pill-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 16px; height: 16px;
    padding: 0 5px;
    margin-left: 8px;
    font-size: 9px;
    color: #0d1225;
    background: #c8960a;
    border-radius: 999px;
  }

  .projects-list-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 16px 28px 40px;
  }
  .projects-list-wrap::-webkit-scrollbar { width: 6px; }
  .projects-list-wrap::-webkit-scrollbar-thumb {
    background: #1a2340; border-radius: 3px;
  }

  .projects-empty {
    padding: 48px 0;
    text-align: center;
    color: #3a4570;
    font-size: 12px;
    letter-spacing: 0.1em;
    font-style: italic;
  }
  .projects-error {
    padding: 16px 0;
    color: #fbbf24;
    font-size: 12px;
    font-style: italic;
    text-align: center;
  }

  /* ── Propose modal ─────────────────────────────────────────────────── */
  .projects-modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(5, 8, 18, 0.72);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
    animation: proj-fade-in 0.15s ease;
  }
  @keyframes proj-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .projects-modal {
    width: min(460px, 92vw);
    background: #0a0f20;
    border: 1px solid #1a2340;
    border-radius: 8px;
    padding: 22px 24px 20px;
    font-family: "JetBrains Mono", monospace;
    color: #d8dcef;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
  }
  .projects-modal-title {
    font-family: "Cinzel", serif;
    font-size: 13px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #c8960a;
    margin: 0 0 14px;
  }
  .projects-modal-field { margin-bottom: 12px; }
  .projects-modal-label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #4a5580;
    margin-bottom: 5px;
  }
  .projects-modal-input,
  .projects-modal-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(13, 18, 37, 0.7);
    border: 1px solid #1a2340;
    border-radius: 4px;
    padding: 8px 10px;
    font-family: "JetBrains Mono", monospace;
    font-size: 12px;
    color: #d8dcef;
    resize: vertical;
  }
  .projects-modal-input:focus,
  .projects-modal-textarea:focus {
    outline: none;
    border-color: #c8960a;
  }
  .projects-modal-textarea { min-height: 72px; }

  .projects-modal-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    margin-top: 16px;
  }
  .projects-modal-btn {
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 7px 14px;
    border-radius: 3px;
    cursor: pointer;
    background: transparent;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .projects-modal-btn.cancel {
    color: #4a5580;
    border: 1px solid #1a2340;
  }
  .projects-modal-btn.cancel:hover { color: #8b93b7; border-color: #2a3560; }
  .projects-modal-btn.submit {
    color: #c8960a;
    border: 1px solid #c8960a;
  }
  .projects-modal-btn.submit:hover { background: rgba(200, 150, 10, 0.1); }
  .projects-modal-btn[disabled] { opacity: 0.4; cursor: not-allowed; }

  .projects-modal-error {
    color: #fbbf24;
    font-size: 11px;
    font-style: italic;
    margin-top: 10px;
  }
`;

/* ── Component ────────────────────────────────────────────────────────── */
export default function ProjectsView() {
  const [projects, setProjects]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [activeFilter, setActiveFilter]       = useState("all");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [modalOpen, setModalOpen]             = useState(false);
  const mountedRef = useRef(true);

  /* Fetch all projects */
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${GAIA_API}/projects`);
      if (!res.ok) throw new Error(`Gaia ${res.status}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      setProjects(Array.isArray(data?.projects) ? data.projects : []);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message || "Failed to reach Gaia");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchProjects();
    const id = setInterval(fetchProjects, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchProjects]);

  /* Derived: filtered list + proposal count */
  const filteredProjects = useMemo(() => {
    const filter = FILTERS.find((f) => f.key === activeFilter) || FILTERS[0];
    return projects.filter(filter.match);
  }, [projects, activeFilter]);

  const proposalCount = useMemo(
    () => projects.filter((p) => p.status === "proposal" || p.status === "draft").length,
    [projects]
  );

  return (
    <>
      <style>{styles}</style>
      <div className="projects-view">
        {/* Header */}
        <div className="projects-header">
          <h2 className="projects-title">Projects</h2>
          <div className="projects-header-right">
            <div className="projects-flag-cluster">
              <FlagOrb />
            </div>
            <button
              type="button"
              className="projects-add-btn"
              title="Propose new project"
              onClick={() => setModalOpen(true)}
            >
              +
            </button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="projects-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`projects-pill ${activeFilter === f.key ? "active" : ""}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
              {f.key === "proposals" && proposalCount > 0 && (
                <span className="projects-pill-badge">{proposalCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="projects-list-wrap">
          {error && (
            <div className="projects-error">Gaia unreachable: {error}</div>
          )}
          {loading && projects.length === 0 && !error && (
            <div className="projects-empty">Loading…</div>
          )}
          {!loading && filteredProjects.length === 0 && !error && (
            <div className="projects-empty">
              {activeFilter === "all"
                ? "No projects yet. Press + to propose one."
                : `No ${activeFilter} projects.`}
            </div>
          )}
          {filteredProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onSelect={setSelectedProjectId}
            />
          ))}
        </div>

        {/* Propose modal */}
        {modalOpen && (
          <ProposeModal
            onClose={() => setModalOpen(false)}
            onProposed={(created) => {
              setModalOpen(false);
              if (created) {
                // Optimistic prepend, then re-sync on next poll
                setProjects((prev) => [created, ...prev]);
              }
              fetchProjects();
            }}
          />
        )}

        {/* Selected project handoff — ProjectDetail lives in a separate task.
            We expose the selection via a custom event so the parent dashboard
            can wire the full-screen view without needing prop drilling yet. */}
        {selectedProjectId && (
          <SelectionBeacon
            projectId={selectedProjectId}
            onConsumed={() => setSelectedProjectId(null)}
          />
        )}
      </div>
    </>
  );
}

/* ── Propose modal ────────────────────────────────────────────────────── */
function ProposeModal({ onClose, onProposed }) {
  const [title, setTitle]       = useState("");
  const [goal, setGoal]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg]     = useState(null);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = title.trim().length > 0 && goal.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrMsg(null);
    try {
      const res = await fetch(`${GAIA_API}/projects/propose`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), goal: goal.trim() }),
      });
      if (!res.ok) throw new Error(`Gaia ${res.status}`);
      const data = await res.json();
      onProposed(data?.project || null);
    } catch (err) {
      setErrMsg(err.message || "Propose failed");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="projects-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="projects-modal" role="dialog" aria-modal="true">
        <h3 className="projects-modal-title">Propose project</h3>

        <div className="projects-modal-field">
          <label className="projects-modal-label">Title</label>
          <input
            ref={titleRef}
            type="text"
            className="projects-modal-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Short descriptive title"
          />
        </div>

        <div className="projects-modal-field">
          <label className="projects-modal-label">Goal</label>
          <textarea
            className="projects-modal-textarea"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What does done look like?"
          />
        </div>

        {errMsg && <div className="projects-modal-error">{errMsg}</div>}

        <div className="projects-modal-footer">
          <button
            type="button"
            className="projects-modal-btn cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="projects-modal-btn submit"
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting ? "Proposing…" : "Propose"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Selection beacon ─────────────────────────────────────────────────── */
/* Card-click selection needs to reach the full-screen ProjectDetail, which
 * is built in a separate task. Rather than hard-wire a parent handler now,
 * we emit a window-level CustomEvent so the eventual parent can listen
 * without changes here. */
function SelectionBeacon({ projectId, onConsumed }) {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("olympus:project-selected", { detail: { projectId } })
    );
    onConsumed();
  }, [projectId, onConsumed]);
  return null;
}
