import { useEffect, useMemo, useRef, useState } from "react";

/* ── FlagOrb.jsx ──────────────────────────────────────────────────────────
 * Pulsing flag orbs in the top-right of the Projects tab header.
 * One orb per open Gaia flag. Click expands a popover anchored under the
 * orb with project title, issue, flagged_to, Resolve and View Project
 * actions. Pulse animation stops while that orb's popover is open. When
 * a flag resolves, the orb disappears and the popover closes. Empty
 * state renders nothing.
 *
 * Props:
 *   flags:           Flag[]   — open flags to render. Shape:
 *                               { id, project_id, issue, flagged_to, status, created_at }
 *   projects:        Project[] — used for client-side name lookup
 *   onSelectProject: (projectId) => void
 *   onFlagResolved:  (flagId)    => void — parent re-fetches flag list
 * ─────────────────────────────────────────────────────────────────────── */

const API_BASE = "http://100.74.201.75:18781";

const styles = `
  .flag-orb-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .flag-orb-slot {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .flag-orb {
    position: relative;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fbbf24;
    border: none;
    padding: 0;
    cursor: pointer;
    flex: 0 0 auto;
    box-shadow:
      0 0 6px rgba(251, 191, 36, 0.75),
      0 0 14px rgba(251, 191, 36, 0.32);
    transition: transform 0.15s ease;
  }
  .flag-orb:hover { transform: scale(1.12); }
  .flag-orb:focus-visible {
    outline: 1px solid #c8960a;
    outline-offset: 2px;
  }

  .flag-orb.pulsing {
    animation: flag-orb-pulse 1.8s ease-in-out infinite;
  }

  @keyframes flag-orb-pulse {
    0%, 100% {
      box-shadow:
        0 0 6px rgba(251, 191, 36, 0.75),
        0 0 14px rgba(251, 191, 36, 0.32);
      transform: scale(1);
    }
    50% {
      box-shadow:
        0 0 12px rgba(251, 191, 36, 1),
        0 0 28px rgba(251, 191, 36, 0.55);
      transform: scale(1.08);
    }
  }

  .flag-orb-popover {
    position: absolute;
    top: calc(100% + 12px);
    right: -4px;
    width: 280px;
    background: rgba(10, 14, 28, 0.96);
    border: 1px solid #2a3560;
    border-radius: 6px;
    padding: 14px 16px 12px;
    font-family: "JetBrains Mono", monospace;
    color: #d8dcef;
    box-shadow:
      0 10px 30px rgba(0, 0, 0, 0.6),
      0 0 20px rgba(251, 191, 36, 0.14);
    z-index: 50;
  }
  .flag-orb-popover::before {
    content: "";
    position: absolute;
    top: -6px;
    right: 8px;
    width: 10px;
    height: 10px;
    background: rgba(10, 14, 28, 0.96);
    border-left: 1px solid #2a3560;
    border-top: 1px solid #2a3560;
    transform: rotate(45deg);
  }

  .flag-orb-project {
    font-family: "Cinzel", serif;
    font-size: 13px;
    font-weight: 600;
    color: #c8960a;
    letter-spacing: 0.04em;
    margin: 0 0 6px;
    text-transform: uppercase;
  }
  .flag-orb-issue {
    font-size: 12px;
    color: #d8dcef;
    line-height: 1.45;
    margin: 0 0 8px;
    word-break: break-word;
  }
  .flag-orb-flagged {
    font-size: 10px;
    color: #7883ab;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0 0 12px;
  }
  .flag-orb-flagged strong {
    color: #d8dcef;
    font-weight: 500;
  }

  .flag-orb-actions {
    display: flex;
    gap: 8px;
  }
  .flag-orb-btn {
    flex: 1;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: transparent;
    border-radius: 3px;
    padding: 6px 8px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .flag-orb-btn.resolve {
    color: #4ade80;
    border: 1px solid #1e3a24;
  }
  .flag-orb-btn.resolve:hover:not([disabled]) {
    background: rgba(74, 222, 128, 0.08);
    border-color: #4ade80;
  }
  .flag-orb-btn.view {
    color: #c8960a;
    border: 1px solid #3a2d08;
  }
  .flag-orb-btn.view:hover:not([disabled]) {
    background: rgba(200, 150, 10, 0.08);
    border-color: #c8960a;
  }
  .flag-orb-btn[disabled] {
    opacity: 0.5;
    cursor: default;
  }

  .flag-orb-error {
    font-size: 10px;
    color: #f87171;
    margin: 8px 0 0;
    letter-spacing: 0.04em;
  }
`;

export default function FlagOrb({
  flags = [],
  projects = [],
  onSelectProject,
  onFlagResolved,
}) {
  const [openId, setOpenId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);

  const openFlags = useMemo(
    () => (flags || []).filter((f) => f && f.status === "open"),
    [flags]
  );

  const projectsById = useMemo(() => {
    const map = new Map();
    for (const p of projects || []) {
      if (p && p.id) map.set(p.id, p);
    }
    return map;
  }, [projects]);

  // If the currently-open flag disappears from the list, close the popover.
  useEffect(() => {
    if (openId && !openFlags.some((f) => f.id === openId)) {
      setOpenId(null);
      setError(null);
    }
  }, [openFlags, openId]);

  // Close popover on outside click or Escape.
  useEffect(() => {
    if (!openId) return undefined;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenId(null);
        setError(null);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenId(null);
        setError(null);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  if (openFlags.length === 0) return null;

  const toggleOrb = (id) => {
    setError(null);
    setOpenId((prev) => (prev === id ? null : id));
  };

  const handleResolve = async (flag) => {
    setResolvingId(flag.id);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/flags/${encodeURIComponent(flag.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOpenId(null);
      if (typeof onFlagResolved === "function") onFlagResolved(flag.id);
    } catch (err) {
      setError(err?.message || "failed to resolve");
    } finally {
      setResolvingId(null);
    }
  };

  const handleView = (flag) => {
    setOpenId(null);
    if (typeof onSelectProject === "function") onSelectProject(flag.project_id);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="flag-orb-wrap" ref={wrapRef}>
        {openFlags.map((flag) => {
          const project = projectsById.get(flag.project_id);
          const projectTitle = project?.title || "(unknown project)";
          const isOpen = openId === flag.id;
          const isResolving = resolvingId === flag.id;
          return (
            <div className="flag-orb-slot" key={flag.id}>
              <button
                type="button"
                className={`flag-orb${isOpen ? "" : " pulsing"}`}
                aria-label={`Open flag on ${projectTitle}`}
                aria-expanded={isOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOrb(flag.id);
                }}
              />
              {isOpen && (
                <div
                  className="flag-orb-popover"
                  role="dialog"
                  aria-label={`Flag on ${projectTitle}`}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <h4 className="flag-orb-project">{projectTitle}</h4>
                  <p className="flag-orb-issue">
                    {flag.issue || "(no issue text)"}
                  </p>
                  <p className="flag-orb-flagged">
                    Flagged to{" "}
                    <strong>{flag.flagged_to || "unassigned"}</strong>
                  </p>
                  <div className="flag-orb-actions">
                    <button
                      type="button"
                      className="flag-orb-btn resolve"
                      disabled={isResolving}
                      onClick={() => handleResolve(flag)}
                    >
                      {isResolving ? "Resolving…" : "Resolve"}
                    </button>
                    <button
                      type="button"
                      className="flag-orb-btn view"
                      disabled={isResolving}
                      onClick={() => handleView(flag)}
                    >
                      View Project
                    </button>
                  </div>
                  {error && <p className="flag-orb-error">⚠ {error}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
