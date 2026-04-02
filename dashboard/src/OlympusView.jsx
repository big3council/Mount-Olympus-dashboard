import { useState, useEffect, useRef } from "react";

/* ── CSS ─────────────────────────────────────────────────────────────────── */
const styles = `
  .olympus-view {
    position: relative;
    width: 100%; height: calc(100vh - 52px);
    display: flex; flex-direction: column;
    background: transparent;
    font-family: "JetBrains Mono", monospace;
    overflow: hidden;
  }
  .olympus-panels {
    flex: 1; display: flex; align-items: stretch;
  }
  .olympus-panel {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 24px 16px 16px;
    border-right: 1px solid #0d1225;
    position: relative;
  }
  .olympus-panel:last-child { border-right: none; }

  .olympus-proj-name {
    font-family: "Cinzel", serif;
    font-size: 10px; color: #c8960a;
    letter-spacing: 0.2em; text-transform: uppercase;
    text-align: center; margin-bottom: 4px;
  }
  .olympus-proj-purpose {
    font-size: 10px; color: #2a3560;
    font-style: italic; text-align: center;
    margin-bottom: 12px; max-width: 200px;
    line-height: 1.4;
  }
  .olympus-building-wrap {
    position: relative; width: 200px; height: 170px;
    margin-bottom: 12px;
  }
  .olympus-progress-bar {
    width: 160px; height: 1px;
    background: #0d1225; border-radius: 1px;
    overflow: hidden; margin-bottom: 6px;
  }
  .olympus-progress-fill {
    height: 100%; background: #c8960a;
    transition: width 0.8s ease;
  }
  .olympus-progress-label {
    font-size: 11px; color: #4a5580;
    letter-spacing: 0.08em; text-align: center;
  }

  /* Needs-you badge */
  .olympus-needs-you {
    position: absolute; top: 8px; right: 8px;
    font-size: 10px; color: #e8b84b;
    border: 1px solid #c8960a; border-radius: 3px;
    padding: 2px 6px; letter-spacing: 0.12em;
    text-transform: uppercase;
    animation: needs-you-blink 2s ease-in-out infinite;
  }
  @keyframes needs-you-blink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.4; }
  }

  /* Amber alert panel */
  .olympus-alert-panel {
    animation: amber-breathe 3s ease-in-out infinite;
  }
  @keyframes amber-breathe {
    0%, 100% { background: transparent; }
    50%      { background: rgba(200,130,10,0.07); }
  }

  /* Column materialize */
  @keyframes materialize {
    0%   { opacity: 0; filter: blur(4px); }
    100% { opacity: 1; filter: blur(0px); }
  }

  /* Gaia strip */
  .olympus-gaia-strip {
    border-top: 1px solid #0d1225;
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 20px; min-height: 32px;
  }
  .olympus-gaia-label {
    font-family: "Cinzel", serif;
    font-size: 10px; color: #2a3560;
    letter-spacing: 0.1em;
  }
  .olympus-gaia-retro {
    font-size: 13px; color: #3a4570;
    font-style: italic; max-width: 60%;
    overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Empty state */
  .olympus-empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 12px; color: #2a3560;
  }

  /* ── Agent dispatch state bar ──────────────────────────────────── */
  .olympus-dispatch-bar {
    display: flex; gap: 12px; padding: 10px 20px;
    border-bottom: 1px solid #0d1225;
    justify-content: center; align-items: center;
  }
  .olympus-agent-card {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 4px;
    background: rgba(9,12,24,0.6);
    border: 1px solid #1a2040;
    min-width: 130px;
    transition: border-color 0.4s ease, background 0.4s ease;
  }
  .olympus-agent-card[data-state="idle"] {
    border-color: #1a2040;
  }
  .olympus-agent-card[data-state="dispatched"] {
    border-color: rgba(200,150,10,0.5);
    background: rgba(200,150,10,0.06);
  }
  .olympus-agent-card[data-state="processing"] {
    border-color: rgba(74,184,232,0.5);
    background: rgba(74,184,232,0.06);
    animation: dispatch-pulse 1.5s ease-in-out infinite;
  }
  .olympus-agent-card[data-state="returned"] {
    border-color: rgba(94,232,176,0.5);
    background: rgba(94,232,176,0.06);
  }
  @keyframes dispatch-pulse {
    0%, 100% { border-color: rgba(74,184,232,0.3); }
    50%      { border-color: rgba(74,184,232,0.7); }
  }
  .olympus-agent-dot {
    width: 6px; height: 6px; border-radius: 50%;
    flex-shrink: 0;
    transition: background 0.3s ease;
  }
  .olympus-agent-dot[data-state="idle"]       { background: #2a3050; }
  .olympus-agent-dot[data-state="dispatched"] { background: #c8960a; }
  .olympus-agent-dot[data-state="processing"] { background: #4ab8e8; animation: dot-pulse 1.5s ease-in-out infinite; }
  .olympus-agent-dot[data-state="returned"]   { background: #5ee8b0; }
  @keyframes dot-pulse {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 1; }
  }
  .olympus-agent-logo {
    width: 20px; height: 20px; border-radius: 50%;
    object-fit: cover; flex-shrink: 0;
    opacity: 0.85;
  }
  .olympus-agent-name {
    font-family: "Cinzel", serif;
    font-size: 11px; letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .olympus-agent-name[data-agent="zeus"]     { color: #e8b84b; }
  .olympus-agent-name[data-agent="poseidon"] { color: #4ab8e8; }
  .olympus-agent-name[data-agent="hades"]    { color: #b04adc; }
  .olympus-agent-name[data-agent="gaia"]     { color: #78d87a; }
  .olympus-agent-state {
    font-size: 10px; color: #4a5580;
    letter-spacing: 0.08em; text-transform: uppercase;
    margin-left: auto;
  }
`;

/* ── Building SVG ────────────────────────────────────────────────────────── */
function BuildingSVG({ tasks = {} }) {
  const completed = tasks.completed || 0;
  const active    = tasks.active    || 0;
  const blocked   = tasks.blocked   || 0;
  const totalCols = Math.max(1, completed + active + blocked);
  const colsUp    = completed;
  const pct       = totalCols > 0 ? colsUp / totalCols : 0;

  const displayTotal = Math.min(totalCols, 9);
  const displayBuilt = Math.min(colsUp, displayTotal);
  const displayGhost = displayTotal - displayBuilt;

  const xStart = 36, xEnd = 168;
  const colW = 10;
  const spacing = displayTotal > 1 ? (xEnd - xStart - colW) / (displayTotal - 1) : 0;
  const colBase = 140, colTop = 80, colH = colBase - colTop;

  const showEntablature = pct >= 0.5;
  const showPediment    = pct >= 0.8;

  return (
    <svg viewBox="0 0 200 170" width="200" height="170" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="stone-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8a870" />
          <stop offset="100%" stopColor="#7a6040" />
        </linearGradient>
        <linearGradient id="gold-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5d580" />
          <stop offset="100%" stopColor="#c8960a" />
        </linearGradient>
        <clipPath id="building-clip">
          <rect x="20" y="40" width="160" height="140" />
        </clipPath>
      </defs>

      <g clipPath="url(#building-clip)">
        <line x1="20" y1="168" x2="180" y2="168" stroke="#1a2040" strokeWidth="1" />

        <rect x="50"  y="152" width="100" height="4" fill="none" stroke="#1a2040" strokeWidth="0.5" />
        <rect x="44"  y="156" width="112" height="4" fill="none" stroke="#1a2040" strokeWidth="0.5" />
        <rect x="38"  y="160" width="124" height="8" fill="none" stroke="#1a2040" strokeWidth="0.5" />

        {colsUp > 0 && <>
          <rect x="50"  y="152" width="100" height="4" fill="#7a6040" opacity="0.5" />
          <rect x="44"  y="156" width="112" height="4" fill="#7a6040" opacity="0.4" />
          <rect x="38"  y="160" width="124" height="8" fill="#7a6040" opacity="0.35" />
        </>}

        <rect x="32" y="68" width="136" height="8" fill="none" stroke="#1a2040" strokeWidth="0.5" />
        <polygon points="100,44 32,68 168,68" fill="none" stroke="#1a2040" strokeWidth="0.5" />

        {Array.from({ length: displayGhost }).map((_, i) => {
          const idx = displayBuilt + i;
          const x = xStart + idx * spacing;
          return (
            <g key={`ghost-${idx}`}>
              <rect x={x} y={colTop} width={colW} height={colH} fill="#1a2040" opacity="0.2" rx="1" />
              <line x1={x + colW / 2} y1={colTop - 8} x2={x + colW / 2} y2={colBase + 4}
                stroke="#1a2040" strokeWidth="0.3" strokeDasharray="3,3" />
              {i === 0 && displayGhost > 1 && (
                <line x1={x} y1={colTop + colH * 0.3} x2={x + spacing * Math.min(displayGhost, 3)} y2={colTop + colH * 0.3}
                  stroke="#1a2040" strokeWidth="0.3" strokeDasharray="3,3" />
              )}
            </g>
          );
        })}

        {Array.from({ length: displayBuilt }).map((_, i) => {
          const x = xStart + i * spacing;
          const isIntegration = displayBuilt > 2 && i === displayBuilt - 1;
          const cH = isIntegration ? colH + 8 : colH;
          const cY = isIntegration ? colTop - 8 : colTop;
          const grad = isIntegration ? "url(#gold-grad)" : "url(#stone-grad)";
          return (
            <g key={`col-${i}`} style={{ animation: `materialize 1.8s ease ${i * 0.15}s both` }}>
              <rect x={x - 1} y={cY} width={colW + 2} height={4} fill={grad} rx="0.5" />
              <rect x={x} y={cY + 4} width={colW} height={cH - 8} fill={grad} rx="1" />
              <rect x={x - 1} y={colBase - 4} width={colW + 2} height={4} fill={grad} rx="0.5" />
              {isIntegration && (
                <rect x={x - 2} y={cY} width={colW + 4} height={cH}
                  fill="none" stroke="#f5d580" strokeWidth="0.5" opacity="0.4"
                  style={{ filter: "drop-shadow(0 0 4px rgba(245,213,128,0.3))" }} />
              )}
            </g>
          );
        })}

        {showEntablature && (
          <rect x="32" y="68" width="136" height="8" fill="url(#stone-grad)" opacity="0.85"
            style={{ animation: "materialize 1.8s ease both" }} />
        )}

        {showPediment && (
          <polygon points="100,44 32,68 168,68" fill="url(#stone-grad)" stroke="#c8960a" strokeWidth="0.5" opacity="0.85"
            style={{ animation: "materialize 1.8s ease both" }} />
        )}
      </g>
    </svg>
  );
}

/* ── Dispatch State Constants ────────────────────────────────────────────── */
const AGENTS = ["zeus", "poseidon", "hades", "gaia"];
const INITIAL_AGENT_STATE = { state: "idle", phase: null };
const RETURNED_FADE_MS = 5000;

/* ── Main Component ──────────────────────────────────────────────────────── */
export default function OlympusView() {
  const [projects, setProjects]     = useState([]);
  const [retroText, setRetroText]   = useState("");
  const [agentStates, setAgentStates] = useState(() =>
    Object.fromEntries(AGENTS.map(a => [a, { ...INITIAL_AGENT_STATE }]))
  );
  const fadeTimers = useRef({});
  const fetchRef = useRef(null);

  // Fetch projects
  const doFetch = () => {
    fetch("/projects")
      .then(r => r.json())
      .then(async d => {
        const summaries = d.projects || [];
        const detailed = await Promise.all(
          summaries.map(p =>
            fetch("/projects/" + p.id)
              .then(r => r.json())
              .then(full => ({
                ...p,
                tasks: {
                  completed: (full.tasks?.completed || []).filter(t => t?.completion?.council_accepted === true).length,
                  active: (full.tasks?.active || []).length,
                  blocked: (full.tasks?.blocked || []).length,
                }
              }))
              .catch(() => p)
          )
        );
        setProjects(detailed);
      })
      .catch(() => {});
  };

  useEffect(() => {
    doFetch();
    const iv = setInterval(doFetch, 15000);
    return () => clearInterval(iv);
  }, []);

  // WebSocket for live updates + dispatch state tracking
  useEffect(() => {
    let ws;
    const connect = () => {
      try {
        ws = new WebSocket(`ws${window.location.protocol === "https:" ? "s" : ""}://${window.location.host}/live`);
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);

            // Project refresh on task acceptance
            if (msg.type === "task.accepted" || msg.event === "task.accepted") {
              doFetch();
            }

            // Agent dispatch state tracking
            const agent = msg.agent;
            if (agent && AGENTS.includes(agent)) {
              if (msg.type === "agent_start") {
                // Clear any pending fade timer
                if (fadeTimers.current[agent]) clearTimeout(fadeTimers.current[agent]);
                setAgentStates(prev => ({ ...prev, [agent]: { state: "dispatched", phase: msg.phase || null } }));
              }
              else if (msg.type === "agent_thought") {
                if (fadeTimers.current[agent]) clearTimeout(fadeTimers.current[agent]);
                setAgentStates(prev => ({ ...prev, [agent]: { state: "processing", phase: msg.phase || prev[agent]?.phase || null } }));
              }
              else if (msg.type === "agent_complete" || msg.type === "agent_error") {
                setAgentStates(prev => ({ ...prev, [agent]: { state: "returned", phase: msg.phase || null } }));
                // Fade back to idle after 5s
                fadeTimers.current[agent] = setTimeout(() => {
                  setAgentStates(prev => ({ ...prev, [agent]: { state: "idle", phase: null } }));
                }, RETURNED_FADE_MS);
              }
            }

            // Reset all agents to idle when pipeline completes
            if (msg.type === "request_complete") {
              Object.keys(fadeTimers.current).forEach(k => clearTimeout(fadeTimers.current[k]));
              fadeTimers.current = {};
              setTimeout(() => {
                setAgentStates(Object.fromEntries(AGENTS.map(a => [a, { ...INITIAL_AGENT_STATE }])));
              }, RETURNED_FADE_MS);
            }
          } catch {}
        };
        ws.onclose = () => setTimeout(connect, 3000);
      } catch {}
    };
    connect();
    return () => {
      if (ws) ws.close();
      Object.values(fadeTimers.current).forEach(t => clearTimeout(t));
    };
  }, []);

  // Fetch latest Gaia retrospective
  useEffect(() => {
    fetch("/gaia/retrospectives?limit=1")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0 && d[0].text) {
          setRetroText(d[0].text.slice(0, 200));
        }
      })
      .catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <style>{styles}</style>
      <div className="olympus-view">
        {/* ── Agent dispatch state bar ──────────────────────────────── */}
        <div className="olympus-dispatch-bar">
          {AGENTS.map(agent => {
            const { state, phase } = agentStates[agent];
            return (
              <div key={agent} className="olympus-agent-card" data-state={state}>
                <img className="olympus-agent-logo" src={`/agents/${agent}/logo.svg`} alt={agent} onError={(e) => e.target.style.display="none"} />
                <div className="olympus-agent-dot" data-state={state} />
                <div className="olympus-agent-name" data-agent={agent}>{agent}</div>
                <div className="olympus-agent-state">{state}{phase ? ` · ${phase}` : ""}</div>
              </div>
            );
          })}
        </div>

        {projects.length === 0 ? (
          <div className="olympus-empty">
            <div style={{ fontSize: 32, opacity: 0.3 }}>🏛</div>
            <div style={{ fontSize: 13, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              OLYMPUS
            </div>
            <div style={{ fontSize: 12, color: "#1a2040", letterSpacing: "0.1em" }}>
              Loading projects...
            </div>
          </div>
        ) : (
          <div className="olympus-panels">
            {projects.filter(p => p.status === "active").map(proj => {
              const t = proj.tasks || {};
              const totalCols = Math.max(1, (t.completed || 0) + (t.active || 0) + (t.blocked || 0));
              const colsUp    = t.completed || 0;
              const pct       = totalCols > 0 ? colsUp / totalCols : 0;
              const needsYou  = proj.next_decision !== null || (proj.deploys && proj.deploys.staged > 0);

              return (
                <div
                  key={proj.id}
                  className={`olympus-panel ${needsYou ? "olympus-alert-panel" : ""}`}
                >
                  {needsYou && <div className="olympus-needs-you">needs you</div>}

                  <div className="olympus-proj-name">{proj.name}</div>
                  <div className="olympus-proj-purpose">{proj.purpose}</div>

                  <div className="olympus-building-wrap">
                    <BuildingSVG tasks={t} />
                  </div>

                  <div className="olympus-progress-bar">
                    <div className="olympus-progress-fill" style={{ width: `${pct * 100}%` }} />
                  </div>
                  <div className="olympus-progress-label">
                    {colsUp} of {totalCols} tasks · {proj.phase || "planning"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Gaia strip */}
        <div className="olympus-gaia-strip">
          <div className="olympus-gaia-label">GAIA · {today}</div>
          <div className="olympus-gaia-retro">
            {retroText || "No retrospective entries yet"}
          </div>
        </div>
      </div>
    </>
  );
}
