import { useMemo } from "react";

/* ── Status palette (spec-locked) ──────────────────────────────────────── */
const STATUS_COLORS = {
  active:   "#4ade80",
  blocked:  "#fbbf24",
  draft:    "#6b7280",
  proposal: "#60a5fa",
  complete: "#475569",
};

/* ── Relative time helper ─────────────────────────────────────────────── */
function relTime(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60)       return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)       return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)       return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)       return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)      return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/* ── CSS (scoped to .proj-card) ───────────────────────────────────────── */
const styles = `
  .proj-card {
    position: relative;
    display: flex; flex-direction: column; justify-content: space-between;
    box-sizing: border-box;
    height: 112px;
    padding: 14px 18px 12px 22px;
    margin-bottom: 10px;
    background: rgba(13, 18, 37, 0.55);
    border: 1px solid #0d1225;
    border-radius: 6px;
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  }
  .proj-card:hover {
    background: rgba(22, 28, 50, 0.7);
    border-color: #1a2340;
    transform: translateX(1px);
  }
  .proj-card::before {
    content: "";
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 3px;
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
    background: var(--proj-status-color, #475569);
  }

  .proj-card-top {
    display: flex; align-items: center; gap: 10px; min-width: 0;
  }
  .proj-card-agent {
    flex: 0 0 auto;
    width: 22px; height: 22px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: "Cinzel", serif;
    font-size: 11px; font-weight: 600;
    color: #0d1225;
    background: #c8960a;
    letter-spacing: 0;
  }
  .proj-card-agent.empty {
    background: transparent; color: #2a3560;
    border: 1px dashed #2a3560;
  }
  .proj-card-title {
    flex: 1; min-width: 0;
    color: #d8dcef;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .proj-card-status {
    flex: 0 0 auto;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--proj-status-color, #475569);
  }

  .proj-card-truth {
    color: #7883ab;
    font-size: 11px;
    line-height: 1.4;
    margin: 6px 0 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-style: italic;
  }

  .proj-card-bottom {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 4px;
  }
  .proj-card-time {
    font-size: 10px;
    color: #3a4570;
    letter-spacing: 0.06em;
  }
  .proj-card-flywheel {
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #c8960a;
    background: transparent;
    border: 1px solid #3a2d08;
    border-radius: 3px;
    padding: 4px 9px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .proj-card-flywheel:hover {
    background: rgba(200, 150, 10, 0.08);
    border-color: #c8960a;
  }
`;

/* ── Component ────────────────────────────────────────────────────────── */
export default function ProjectCard({ project, onSelect }) {
  const color = STATUS_COLORS[project.status] || STATUS_COLORS.draft;
  const agentInitial = useMemo(() => {
    if (!project.lead_agent) return "";
    return project.lead_agent.trim().charAt(0).toUpperCase();
  }, [project.lead_agent]);

  const handleCardClick = () => {
    if (typeof onSelect === "function") onSelect(project.id);
  };

  const handleFlywheel = (e) => {
    e.stopPropagation();
    // Flywheel wiring lives in a separate task — stub for now.
    // eslint-disable-next-line no-console
    console.log("[ProjectCard] Create Flywheel Job:", project.id, project.title);
  };

  return (
    <>
      <style>{styles}</style>
      <div
        className="proj-card"
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        style={{ "--proj-status-color": color }}
      >
        <div className="proj-card-top">
          <div className={`proj-card-agent ${agentInitial ? "" : "empty"}`}>
            {agentInitial || "·"}
          </div>
          <div className="proj-card-title">{project.title || "(untitled)"}</div>
          <div className="proj-card-status">{project.status || "draft"}</div>
        </div>

        <p className="proj-card-truth">
          {project.truth_state || "No truth state yet."}
        </p>

        <div className="proj-card-bottom">
          <span className="proj-card-time">
            {relTime(project.truth_state_updated_at || project.updated_at)}
          </span>
          <button
            type="button"
            className="proj-card-flywheel"
            onClick={handleFlywheel}
          >
            Create Flywheel Job
          </button>
        </div>
      </div>
    </>
  );
}
