import { useState, useEffect, useRef, useCallback } from "react";
import OlympusView from "./OlympusView";
import CouncilChamber from "./CouncilChamber";
import FlywheelView from "./FlywheelView.jsx";

function StarField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 260 }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      r:  Math.random() * 1.3 + 0.15,
      a:  Math.random() * 0.7 + 0.1,
      da: (Math.random() - 0.5) * 0.007,
      vy: Math.random() * 0.04 + 0.005,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.y += s.vy;
        if (s.y > canvas.height + 2) { s.y = -2; s.x = Math.random() * canvas.width; }
        s.a = Math.max(0.06, Math.min(0.9, s.a + s.da));
        if (s.a >= 0.9 || s.a <= 0.06) s.da = -s.da;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190, 210, 255, ${s.a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      pointerEvents: "none", zIndex: 0,
    }} />
  );
}

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@700&family=JetBrains+Mono:wght@300;400;500&display=swap');`;


// ── Smart naming utility ─────────────────────────────────────────────────────
function smartNameFallback(text, maxWords = 5) {
  if (!text) return "Untitled";
  let clean = text.replace(/^(Message from \w+:\s*|ZEUS PROTOCOL:\s*)/i, "").trim();
  const words = clean.split(/\s+/).filter(w => w.length > 2).slice(0, maxWords);
  if (words.length === 0) return clean.slice(0, 30) || "Untitled";
  let name = words.join(" ");
  if (name.length > 40) name = name.slice(0, 37) + "\u2026";
  return name;
}


// ── Quorum mapping ───────────────────────────────────────────────────────────
const QUORUM_MAP = {
  ZEUS:     ["Hermes", "Athena", "Apollo", "Hestia"],
  POSEIDON: ["Aphrodite", "Iris", "Demeter", "Prometheus"],
  HADES:    ["Hephaestus", "Nike", "Artemis", "Ares"],
  GAIA:     [],
};

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #05070f; }

  :root {
    --bg:        #05070f;
    --bg2:       #090c18;
    --bg3:       #0d1225;
    --border:    #1a2040;
    --border2:   #2a3560;
    --gold:      #c8960a;
    --gold2:     #e8b84b;
    --gold3:     #f5d580;
    --text:      #c2cce8;
    --muted:     #4a5580;
    --dim:       #2a3050;
    --active:    #f0c060;
    --done:      #5ee8b0;
    --pending:   #4a5580;
    --zeus:      #e8b84b;
    --poseidon:  #4ab8e8;
    --hades:     #b04adc;
    --gaia:      #78d87a;
  }

  html, body { width: 100%; height: 100%; overflow: hidden; }

  .dashboard {
    font-family: 'JetBrains Mono', monospace;
    background: var(--bg);
    color: var(--text);
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    transition: background 0.6s ease;
  }

  /* Grain overlay */
  .dashboard::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
    opacity: 0.25;
  }

  /* Deep vignette */
  .dashboard::after {
    content: '';
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 50% 0%, rgba(30,40,100,0.12) 0%, rgba(5,7,15,0.6) 100%);
    pointer-events: none;
    z-index: 0;
    transition: background 0.6s ease;
  }

  /* ── Mode backgrounds ───────────────────────────────────────────────── */
  .mode-zeus_protocol { background: #000000 !important; }
  .mode-zeus_protocol::after { background: none !important; }
  .mode-poseidon { background: #01080f !important; }
  .mode-poseidon::after { background: radial-gradient(ellipse at 50% 0%, rgba(0,30,60,0.3) 0%, rgba(1,8,15,0.7) 100%) !important; }
  .mode-hades    { background: #04020a !important; }
  .mode-hades::after { background: radial-gradient(ellipse at 50% 0%, rgba(40,0,80,0.3) 0%, rgba(4,2,10,0.7) 100%) !important; }
  .mode-gaia     { background: #020706 !important; }
  .mode-gaia::after { background: radial-gradient(ellipse at 50% 0%, rgba(0,40,20,0.3) 0%, rgba(2,7,6,0.7) 100%) !important; }

  /* ── Gaia full dashboard takeover ──────────────────────────────── */
  .mode-gaia .topbar {
    background: linear-gradient(180deg, rgba(2,14,5,0.99) 0%, rgba(1,9,3,0.96) 100%) !important;
    border-bottom-color: rgba(120,216,122,0.12) !important;
    box-shadow: 0 1px 0 rgba(120,216,122,0.08), 0 4px 24px rgba(0,0,0,0.6) !important;
  }
  .mode-gaia .topbar::after { background: linear-gradient(90deg, transparent, rgba(120,216,122,0.35), transparent) !important; }
  .mode-gaia .logo { color: rgba(120,216,122,0.92) !important; text-shadow: 0 0 24px rgba(120,216,122,0.22) !important; }
  .mode-gaia .logo-mark { filter: drop-shadow(0 0 8px rgba(120,216,122,0.5)) !important; }
  .mode-gaia .node-chip { background: rgba(1,9,3,0.85) !important; border-color: rgba(120,216,122,0.1) !important; }
  .mode-gaia .node-chip.online { border-color: rgba(120,216,122,0.28) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 10px rgba(120,216,122,0.05), inset 0 1px 0 rgba(255,255,255,0.02) !important; }
  .mode-gaia .input-bar { background: rgba(1,9,3,0.97) !important; border-top-color: rgba(120,216,122,0.15) !important; }
  .mode-gaia .input-bar::before { background: linear-gradient(90deg, transparent, rgba(120,216,122,0.28), transparent) !important; }
  .mode-gaia .mode-badge { color: var(--gaia) !important; border-color: rgba(120,216,122,0.35) !important; background: rgba(120,216,122,0.06) !important; }
  .mode-tier1    { background: #03050c !important; }

  /* ── Mode canvas transition ─────────────────────────────────────────── */
  @keyframes mode-enter {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .main-canvas {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    z-index: 1;
    animation: mode-enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* Topbar */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 32px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(10,14,30,0.98) 0%, rgba(5,7,15,0.92) 100%);
    position: relative;
    z-index: 10;
    flex-shrink: 0;
    box-shadow: 0 1px 0 rgba(42,53,96,0.5), 0 4px 24px rgba(0,0,0,0.5);
    backdrop-filter: blur(12px);
    transition: background 0.6s ease;
  }
  .topbar::after {
    content: '';
    position: absolute;
    bottom: -1px; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(200,150,10,0.15) 20%, rgba(232,184,75,0.25) 50%, rgba(200,150,10,0.15) 80%, transparent 100%);
    transition: background 0.6s ease;
  }
  .mode-zeus_protocol .topbar { background: linear-gradient(180deg, rgba(0,0,0,0.99) 0%, rgba(0,0,0,0.95) 100%); }
  .mode-zeus_protocol .topbar::after { background: linear-gradient(90deg, transparent, rgba(232,184,75,0.4), transparent); }
  .mode-poseidon .topbar::after { background: linear-gradient(90deg, transparent, rgba(74,184,232,0.3), transparent); }
  .mode-hades    .topbar::after { background: linear-gradient(90deg, transparent, rgba(176,74,220,0.3), transparent); }
  .mode-gaia     .topbar::after { background: linear-gradient(90deg, transparent, rgba(120,216,122,0.3), transparent); }

  .logo {
    font-family: 'Cinzel Decorative', serif;
    font-size: 17px;
    color: var(--gold2);
    letter-spacing: 0.18em;
    display: flex;
    align-items: center;
    gap: 10px;
    text-shadow: 0 0 20px rgba(232,184,75,0.3);
  }
  .logo-mark { font-size: 22px; filter: drop-shadow(0 0 8px rgba(232,184,75,0.5)); }

  .cluster-nodes { display: flex; gap: 8px; align-items: center; }

  .node-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 14px; border-radius: 4px;
    background: rgba(9,12,24,0.8); border: 1px solid var(--border);
    font-size: 12px; letter-spacing: 0.1em; font-weight: 500;
    transition: all 0.4s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03);
  }
  .node-chip.online  { border-color: rgba(94,232,176,0.35); box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 12px rgba(94,232,176,0.06), inset 0 1px 0 rgba(255,255,255,0.03); }
  .node-chip.offline { border-color: rgba(255,80,80,0.35); }
  .node-chip .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); transition: all 0.4s; }
  .node-chip.online  .dot { background: var(--done); box-shadow: 0 0 8px var(--done), 0 0 16px rgba(94,232,176,0.3); animation: pulse-dot 2s ease infinite; }
  .node-chip.offline .dot { background: #ff5050; box-shadow: 0 0 8px #ff5050; }
  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .topbar-time { font-size: 12px; color: var(--muted); letter-spacing: 0.1em; }

  /* Mode badge */
  .mode-badge {
    font-family: 'Cinzel', serif;
    font-size: 10px;
    letter-spacing: 0.2em;
    padding: 3px 9px;
    border-radius: 3px;
    text-transform: uppercase;
    border: 1px solid var(--border);
    color: var(--muted);
    transition: all 0.5s ease;
  }
  .mode-badge.badge-tier1, .mode-badge.badge-zeus_protocol { color: var(--gold); border-color: rgba(232,184,75,0.35); background: rgba(232,184,75,0.06); }
  .mode-badge.badge-tier2 { color: var(--text); border-color: var(--border2); background: transparent; }
  .mode-badge.badge-poseidon { color: var(--poseidon); border-color: rgba(74,184,232,0.35); background: rgba(74,184,232,0.06); }
  .mode-badge.badge-hades    { color: var(--hades);    border-color: rgba(176,74,220,0.35); background: rgba(176,74,220,0.06); }
  .mode-badge.badge-gaia     { color: var(--gaia);     border-color: rgba(120,216,122,0.35); background: rgba(120,216,122,0.06); }

  /* ── Sidebar ────────────────────────────────────────────────────────── */
  .sidebar {
    width: 300px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: rgba(9,12,24,0.85);
    flex-shrink: 0;
    overflow-y: auto;
    backdrop-filter: blur(8px);
    box-shadow: inset -1px 0 0 rgba(42,53,96,0.3);
  }
  .sidebar-section { padding: 16px; border-bottom: 1px solid var(--border); }
  .sidebar-label {
    font-size: 11px; letter-spacing: 0.2em; color: var(--muted);
    text-transform: uppercase; margin-bottom: 10px; font-family: 'Cinzel', serif;
  }
  .new-mission-btn {
    padding: 3px 10px;
    background: rgba(42,53,96,0.3); border: 1px solid var(--border2);
    border-radius: 3px; color: var(--text);
    font-family: 'Cinzel', serif; font-size: 10px;
    letter-spacing: 0.12em; cursor: pointer; transition: all 0.2s;
  }
  .new-mission-btn:hover { border-color: var(--gold); color: var(--gold2); background: rgba(200,150,10,0.08); }

  .sidebar-tabs { display: flex; gap: 5px; margin-bottom: 10px; }
  .sidebar-tab {
    flex: 1; padding: 4px 0; font-size: 10px; font-family: 'Cinzel', serif;
    letter-spacing: 0.12em; border: 1px solid var(--border); background: transparent;
    color: var(--muted); cursor: pointer; border-radius: 2px; text-align: center;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .sidebar-tab:hover:not(.active) { border-color: var(--border2); color: var(--text); }
  .sidebar-tab.active { background: rgba(200,150,10,0.07); border-color: var(--gold); color: var(--gold2); }

  .req-user-badge {
    display: inline-block; font-size: 12px; font-family: 'Cinzel', serif;
    letter-spacing: 0.08em; color: rgba(255,255,255,0.85);
    border: 1px solid var(--border); border-radius: 2px;
    padding: 1px 5px; margin-top: 3px;
  }

  .req-item {
    padding: 10px 12px; border-radius: 4px; border: 1px solid var(--border);
    margin-bottom: 6px; cursor: pointer; transition: all 0.2s;
    background: var(--bg3); font-size: 12px; color: var(--text);
  }
  .req-item:hover { border-color: var(--border2); }
  .req-item.selected { border-color: var(--gold); background: rgba(200,150,10,0.06); }
  .req-item.active   { border-color: rgba(240,192,96,0.4); }

  .req-status { display: inline-block; width: 5px; height: 5px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .req-status.pending { background: var(--muted); }
  .req-status.active  { background: var(--active); box-shadow: 0 0 5px var(--active); animation: pulse-dot 1s ease infinite; }
  .req-status.done    { background: var(--done); }

  .req-text { display: block; font-size: 14px; color: var(--text); margin-top: 4px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .req-time { font-size: 11px; color: var(--muted); margin-top: 4px; }
  .req-tier { font-size: 13px; color: rgba(255,255,255,0.85); font-family: 'Cinzel', serif; letter-spacing: 0.08em; margin-top: 2px; }

  /* ── Tier 3 — Full flow area ────────────────────────────────────────── */
  .flow-area {
    flex: 1; overflow: auto; display: flex;
    flex-direction: column; align-items: center;
    padding: 32px 24px; position: relative;
  }
  .flow-container { position: relative; width: 1000px; flex-shrink: 0; }
  .flow-svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }

  .conn-line { fill: none; stroke: rgba(42,53,96,0.6); stroke-width: 1.5; transition: stroke 0.5s, filter 0.5s, stroke-width 0.3s; }
  .conn-line.active { stroke: var(--gold); stroke-width: 2.5; filter: drop-shadow(0 0 6px var(--gold)) drop-shadow(0 0 12px rgba(200,150,10,0.4)); stroke-dasharray: 10 5; animation: dash-flow 0.7s linear infinite; }
  .conn-line.done   { stroke: rgba(94,232,176,0.5); stroke-width: 1.5; filter: drop-shadow(0 0 3px rgba(94,232,176,0.3)); }
  @keyframes dash-flow { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }

  .flow-nodes { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0; }
  .flow-row   { display: flex; justify-content: center; gap: 16px; position: relative; z-index: 2; margin-bottom: 0; }
  .spacer    { height: 80px; }
  .spacer-sm { height: 64px; }

  .agent-node {
    width: 205px; border: 1px solid var(--border); border-radius: 8px;
    background: linear-gradient(160deg, rgba(14,18,38,0.97) 0%, rgba(7,9,20,0.98) 100%);
    padding: 16px 15px 14px; cursor: pointer; transition: all 0.35s;
    position: relative; overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .agent-node::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: transparent; transition: background 0.35s, box-shadow 0.35s; }
  .agent-node::after  { content: ''; position: absolute; top: 0; left: -100%; right: auto; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent); transition: left 0.5s; }
  .agent-node.idle { opacity: 0.4; }
  .agent-node.idle:hover { opacity: 0.7; border-color: var(--border2); }
  .agent-node.idle:hover::after { left: 150%; }
  .agent-node.thinking { border-color: rgba(200,150,10,0.6); opacity: 1; animation: node-glow 2s ease infinite; }
  .agent-node.thinking::before { background: var(--gold2); box-shadow: 0 0 8px var(--gold2), 0 0 16px rgba(232,184,75,0.5); }
  .agent-node.done { border-color: rgba(94,232,176,0.35); opacity: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4), 0 0 16px rgba(94,232,176,0.05), inset 0 1px 0 rgba(94,232,176,0.06); }
  .agent-node.done::before { background: var(--done); box-shadow: 0 0 6px var(--done); }
  .agent-node.selected { border-color: var(--gold2) !important; box-shadow: 0 0 0 1px rgba(232,184,75,0.5), 0 0 24px rgba(232,184,75,0.2), 0 0 48px rgba(232,184,75,0.08), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(232,184,75,0.1) !important; }
  @keyframes node-glow {
    0%, 100% { box-shadow: 0 0 0 1px rgba(200,150,10,0.4), 0 0 16px rgba(200,150,10,0.2), 0 0 32px rgba(200,150,10,0.08), 0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,184,75,0.06); }
    50%       { box-shadow: 0 0 0 1px rgba(200,150,10,0.7), 0 0 24px rgba(200,150,10,0.35), 0 0 48px rgba(200,150,10,0.15), 0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,184,75,0.12); }
  }

  .node-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .node-symbol { font-size: 24px; line-height: 1; filter: drop-shadow(0 0 6px currentColor); }
  .node-status-icon { font-size: 13px; color: var(--muted); }
  .node-status-icon.thinking { color: var(--active); animation: blink 1s step-end infinite; }
  .node-status-icon.done     { color: var(--done); }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  .node-name { font-family: 'Cinzel', serif; font-size: 15px; font-weight: 600; letter-spacing: 0.12em; color: var(--text); margin-bottom: 3px; }
  .node-role { font-size: 12px; color: var(--muted); letter-spacing: 0.06em; line-height: 1.3; }
  .node-progress { margin-top: 10px; height: 2px; background: var(--bg2); border-radius: 2px; overflow: hidden; }
  .node-progress-bar { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
  .thinking .node-progress-bar { background: linear-gradient(90deg, var(--gold), var(--gold2)); box-shadow: 0 0 8px var(--gold2); animation: progress-pulse 1.5s ease infinite; }
  .done     .node-progress-bar { background: linear-gradient(90deg, var(--done), rgba(94,232,176,0.7)); box-shadow: 0 0 6px var(--done); width: 100% !important; }
  @keyframes progress-pulse { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; box-shadow: 0 0 12px var(--gold2), 0 0 20px rgba(232,184,75,0.3); } }

  .council-node {
    width: 580px; border: 1px solid var(--border); border-radius: 8px;
    background: linear-gradient(160deg, rgba(14,18,38,0.97) 0%, rgba(7,9,20,0.98) 100%);
    padding: 16px 18px 14px; cursor: pointer; transition: all 0.35s;
    position: relative; overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .council-node::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: transparent; transition: background 0.35s, box-shadow 0.35s; }
  .council-node.idle     { opacity: 0.4; }
  .council-node.thinking { border-color: rgba(200,150,10,0.6); opacity: 1; animation: node-glow 2s ease infinite; }
  .council-node.thinking::before { background: var(--gold2); box-shadow: 0 0 8px var(--gold2), 0 0 16px rgba(232,184,75,0.5); }
  .council-node.done     { border-color: rgba(94,232,176,0.35); opacity: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4), 0 0 16px rgba(94,232,176,0.05), inset 0 1px 0 rgba(94,232,176,0.06); }
  .council-node.done::before { background: var(--done); }
  .council-node.selected { border-color: var(--gold2) !important; box-shadow: 0 0 0 1px rgba(232,184,75,0.5), 0 0 24px rgba(232,184,75,0.2), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(232,184,75,0.1) !important; }

  .council-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .council-title  { font-family: 'Cinzel', serif; font-size: 14px; font-weight: 600; letter-spacing: 0.18em; color: var(--gold2); text-transform: uppercase; }
  .council-members { display: flex; gap: 6px; }
  .member-badge { font-size: 12px; padding: 2px 8px; border-radius: 3px; border: 1px solid var(--border); font-family: 'Cinzel', serif; letter-spacing: 0.06em; }
  .member-badge.zeus-c     { border-color: rgba(232,184,75,0.4); color: var(--zeus);     background: rgba(232,184,75,0.06); }
  .member-badge.poseidon-c { border-color: rgba(74,184,232,0.4); color: var(--poseidon); background: rgba(74,184,232,0.06); }
  .member-badge.hades-c    { border-color: rgba(176,74,220,0.4); color: var(--hades);    background: rgba(176,74,220,0.06); }
  .council-chat-preview { display: flex; flex-direction: column; gap: 4px; max-height: 84px; overflow: hidden; }
  .chat-line { font-size: 12px; color: var(--muted); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chat-line .speaker { font-weight: 500; margin-right: 4px; }
  .chat-line .speaker.zeus     { color: var(--zeus); }
  .chat-line .speaker.poseidon { color: var(--poseidon); }
  .chat-line .speaker.hades    { color: var(--hades); }

  /* Detail panel */
  .detail-panel { width: 380px; border-left: 1px solid var(--border); background: rgba(9,12,24,0.88); display: flex; flex-direction: column; flex-shrink: 0; transition: width 0.3s ease; overflow: hidden; backdrop-filter: blur(8px); box-shadow: inset 1px 0 0 rgba(42,53,96,0.3); }
  .detail-panel.closed { width: 0; border-left: none; }
  .panel-header { padding: 16px 18px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .panel-title  { font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 0.15em; font-weight: 600; color: var(--gold2); }
  .panel-close  { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 3px; transition: color 0.2s; font-family: monospace; }
  .panel-close:hover { color: var(--text); }
  .panel-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
  .panel-body::-webkit-scrollbar { width: 4px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
  .panel-section { margin-bottom: 20px; }
  .panel-section-label { font-size: 11px; letter-spacing: 0.2em; color: var(--muted); text-transform: uppercase; margin-bottom: 10px; font-family: 'Cinzel', serif; }

  .thought-block { background: linear-gradient(160deg, rgba(13,18,37,0.9) 0%, rgba(7,9,20,0.95) 100%); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; font-size: 12px; line-height: 1.8; color: var(--text); margin-bottom: 8px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03); }
  .thought-block::before { content: ''; position: absolute; top: 6px; left: 0; width: 2px; height: calc(100% - 12px); border-radius: 0 2px 2px 0; background: var(--gold); box-shadow: 0 0 6px var(--gold); opacity: 0.7; }

  @keyframes chat-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .chat-message   { display: flex; gap: 8px; margin-bottom: 12px; align-items: flex-start; animation: chat-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .chat-avatar    { width: 22px; height: 22px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
  .chat-avatar.zeus     { background: rgba(232,184,75,0.15); border: 1px solid rgba(232,184,75,0.3); }
  .chat-avatar.poseidon { background: rgba(74,184,232,0.15); border: 1px solid rgba(74,184,232,0.3); }
  .chat-avatar.hades    { background: rgba(176,74,220,0.15); border: 1px solid rgba(176,74,220,0.3); }
  .chat-content { flex: 1; }
  .chat-speaker { font-size: 14px; letter-spacing: 0.1em; font-family: 'Cinzel', serif; margin-bottom: 3px; }
  .chat-speaker.zeus     { color: var(--zeus); }
  .chat-speaker.poseidon { color: var(--poseidon); }
  .chat-speaker.hades    { color: var(--hades); }
  .chat-text { font-size: 12px; line-height: 1.7; color: var(--text); background: linear-gradient(160deg, rgba(13,18,37,0.9) 0%, rgba(7,9,20,0.95) 100%); border: 1px solid var(--border); border-radius: 5px; padding: 9px 11px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }

  .vote-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 3px; font-size: 11px; letter-spacing: 0.1em; margin-top: 4px; font-family: 'Cinzel', serif; }
  .vote-badge.approve { background: rgba(94,232,176,0.12); border: 1px solid rgba(94,232,176,0.4); color: var(--done); box-shadow: 0 0 10px rgba(94,232,176,0.15); }
  .vote-badge.calling { background: rgba(240,192,96,0.08); border: 1px solid rgba(240,192,96,0.3); color: var(--active); }
  .vote-badge.aye     { background: rgba(94,232,176,0.06); border: 1px solid rgba(94,232,176,0.2); color: rgba(94,232,176,0.7); }

  @keyframes vote-burst { 0% { opacity: 0; transform: scale(0.85); } 40% { opacity: 1; transform: scale(1.04); box-shadow: 0 0 40px rgba(94,232,176,0.35); } 70% { transform: scale(0.98); } 100% { transform: scale(1); } }
  @keyframes unanimous-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }

  .vote-unanimous { margin-top: 8px; padding: 12px 16px; border-radius: 6px; background: rgba(94,232,176,0.07); border: 1px solid rgba(94,232,176,0.4); box-shadow: 0 0 20px rgba(94,232,176,0.12), inset 0 1px 0 rgba(94,232,176,0.1); display: flex; align-items: center; gap: 10px; animation: vote-burst 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; position: relative; overflow: hidden; }
  .vote-unanimous::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(94,232,176,0.06) 50%, transparent 100%); background-size: 200% 100%; animation: unanimous-shimmer 2.5s ease infinite; }
  .vote-unanimous-mark { font-size: 18px; color: var(--done); }
  .vote-unanimous-text { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 0.15em; color: var(--done); }
  .vote-unanimous-sub  { font-size: 11px; color: rgba(94,232,176,0.5); letter-spacing: 0.05em; margin-top: 2px; }

  .timing-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); padding: 5px 0; border-bottom: 1px solid var(--border); }
  .timing-row:last-child { border-bottom: none; }
  .timing-val { color: var(--text); }

  /* Vote stamps */
  @keyframes stamp-down { 0% { transform: scale(1.4); opacity: 0; filter: blur(3px); } 45% { transform: scale(0.91); opacity: 1; filter: blur(0); } 65% { transform: scale(1.06); } 82% { transform: scale(0.97); } 100% { transform: scale(1); } }
  .stamp-section { margin-bottom: 16px; }
  .stamp-row { display: flex; gap: 8px; padding: 10px; background: rgba(5,7,15,0.55); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 10px; }
  .stamp-box { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px 8px; border-radius: 5px; border: 1px solid var(--border); background: rgba(13,18,37,0.9); min-height: 68px; justify-content: center; transition: border-color 0.35s, background 0.35s, box-shadow 0.35s; }
  .stamp-icon  { font-size: 22px; line-height: 1; opacity: 0.15; transition: opacity 0.3s; }
  .stamp-label { font-family: 'Cinzel', serif; font-size: 9.5px; letter-spacing: 0.1em; color: var(--muted); transition: color 0.3s; }
  .stamp-aye   { font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 0.12em; margin-top: 1px; }
  .stamp-voted { animation: stamp-down 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
  .stamp-voted .stamp-icon { opacity: 1; }
  .stamp-voted-zeus     { border-color: rgba(232,184,75,0.5);  background: rgba(232,184,75,0.07);  box-shadow: 0 0 14px rgba(232,184,75,0.1),  inset 0 1px 0 rgba(232,184,75,0.08); }
  .stamp-voted-poseidon { border-color: rgba(74,184,232,0.5);  background: rgba(74,184,232,0.07);  box-shadow: 0 0 14px rgba(74,184,232,0.1),  inset 0 1px 0 rgba(74,184,232,0.08); }
  .stamp-voted-hades    { border-color: rgba(176,74,220,0.5);  background: rgba(176,74,220,0.07);  box-shadow: 0 0 14px rgba(176,74,220,0.1),  inset 0 1px 0 rgba(176,74,220,0.08); }
  .stamp-voted-zeus     .stamp-label, .stamp-voted-zeus     .stamp-aye { color: var(--zeus);     }
  .stamp-voted-poseidon .stamp-label, .stamp-voted-poseidon .stamp-aye { color: var(--poseidon); }
  .stamp-voted-hades    .stamp-label, .stamp-voted-hades    .stamp-aye { color: var(--hades);    }

  /* Output block */
  .output-text-block { width: 90%; max-width: 1100px; background: linear-gradient(160deg, rgba(6,11,26,0.99) 0%, rgba(4,7,16,0.99) 100%); border: 1px solid rgba(94,232,176,0.4); border-radius: 8px; padding: 22px 26px 26px; box-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 12px 32px rgba(0,0,0,0.5), 0 0 48px rgba(94,232,176,0.06), inset 0 1px 0 rgba(94,232,176,0.1); animation: vote-burst 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; position: relative; overflow: hidden; }
  .output-text-block::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent 0%, rgba(94,232,176,0.4) 25%, rgba(94,232,176,0.85) 50%, rgba(94,232,176,0.4) 75%, transparent 100%); border-radius: 8px 8px 0 0; box-shadow: 0 0 14px rgba(94,232,176,0.4); }
  .output-text-block::after  { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(94,232,176,0.025) 50%, transparent 100%); background-size: 200% 100%; animation: unanimous-shimmer 4s ease infinite; pointer-events: none; }
  .output-text-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid rgba(94,232,176,0.14); font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 0.22em; color: var(--done); text-transform: uppercase; }
  .output-timing { margin-left: auto; font-size: 11px; color: rgba(94,232,176,0.5); letter-spacing: 0.08em; font-family: 'JetBrains Mono', monospace; }
  .output-text-body { font-family: 'JetBrains Mono', monospace; font-size: 13.5px; line-height: 1.85; color: #d8e4f0; white-space: pre-wrap; word-break: break-word; max-height: calc(100vh - 280px); overflow-y: auto; }

  /* ── Tier 1 — Intimate ──────────────────────────────────────────────── */
  .tier1-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 40px; gap: 0; }

  @keyframes symbol-pulse-gold     { 0%, 100% { filter: drop-shadow(0 0 24px rgba(232,184,75,0.5)); } 50% { filter: drop-shadow(0 0 48px rgba(232,184,75,0.9)); } }
  @keyframes symbol-pulse-poseidon { 0%, 100% { filter: drop-shadow(0 0 24px rgba(74,184,232,0.5)); } 50% { filter: drop-shadow(0 0 48px rgba(74,184,232,0.9)); } }
  @keyframes symbol-pulse-hades    { 0%, 100% { filter: drop-shadow(0 0 24px rgba(176,74,220,0.5)); } 50% { filter: drop-shadow(0 0 48px rgba(176,74,220,0.9)); } }
  @keyframes symbol-pulse-gaia     { 0%, 100% { filter: drop-shadow(0 0 24px rgba(120,216,122,0.5)); } 50% { filter: drop-shadow(0 0 48px rgba(120,216,122,0.9)); } }

  .tier1-symbol      { font-size: 72px; line-height: 1; margin-bottom: 14px; animation: symbol-pulse-gold 3s ease infinite; }
  .tier1-agent-label { font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 0.32em; color: var(--gold); opacity: 0.65; margin-bottom: 40px; }
  .tier1-thinking    { font-size: 11px; color: var(--gold); letter-spacing: 0.2em; font-family: 'Cinzel', serif; animation: blink 1.4s step-end infinite; margin-bottom: 20px; opacity: 0.7; }
  .tier1-response {
    max-width: 1100px; width: 90%;
    background: rgba(8,11,22,0.92); border: 1px solid rgba(232,184,75,0.18);
    border-radius: 8px; padding: 24px 28px;
    font-family: 'JetBrains Mono', monospace; font-size: 13.5px; line-height: 1.85; color: #d8e4f0;
    max-height: calc(100vh - 260px); overflow-y: auto;
    white-space: pre-wrap; word-break: break-word;
    box-shadow: 0 0 40px rgba(232,184,75,0.04), 0 12px 32px rgba(0,0,0,0.5);
    animation: mode-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    position: relative;
  }
  .tier1-response::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(232,184,75,0.35), transparent); border-radius: 8px 8px 0 0; }

  /* ── Tier 2 — Focused trio ──────────────────────────────────────────── */
  .tier2-area { flex: 1; overflow: auto; display: flex; flex-direction: column; align-items: center; padding: 32px 24px; }

  .tier2-request-pill { max-width: 720px; width: 100%; padding: 10px 20px; background: var(--bg3); border: 1px solid var(--border2); border-radius: 4px; font-size: 12px; color: var(--text); font-family: 'JetBrains Mono', monospace; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 10px; }

  .tier2-status { font-family: 'Cinzel', serif; font-size: 8.5px; letter-spacing: 0.22em; color: var(--muted); text-transform: uppercase; margin-bottom: 28px; display: flex; align-items: center; gap: 8px; }
  .tier2-status-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 6px var(--gold); animation: pulse-dot 1s ease infinite; }

  .tier2-agents { display: flex; gap: 18px; max-width: 900px; width: 100%; margin-bottom: 28px; }

  .tier2-card {
    flex: 1; border: 1px solid var(--border); border-radius: 8px;
    background: linear-gradient(160deg, rgba(14,18,38,0.97) 0%, rgba(7,9,20,0.98) 100%);
    padding: 18px 16px; transition: all 0.35s;
    position: relative; overflow: hidden;
    box-shadow: 0 2px 4px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .tier2-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: transparent; transition: background 0.35s; }
  .tier2-card.idle     { opacity: 0.35; }
  .tier2-card.thinking { border-color: rgba(200,150,10,0.5); opacity: 1; animation: node-glow 2s ease infinite; }
  .tier2-card.thinking::before { background: var(--gold2); }
  .tier2-card.done::before { background: var(--done); }
  .tier2-card.zeus-done     { border-color: rgba(232,184,75,0.3); opacity: 1; }
  .tier2-card.zeus-done::before { background: var(--zeus); }
  .tier2-card.poseidon-done { border-color: rgba(74,184,232,0.3); opacity: 1; }
  .tier2-card.poseidon-done::before { background: var(--poseidon); }
  .tier2-card.hades-done    { border-color: rgba(176,74,220,0.3); opacity: 1; }
  .tier2-card.hades-done::before { background: var(--hades); }
  .tier2-card.working  { border-color: rgba(200,150,10,0.5); opacity: 1; animation: node-glow 2s ease infinite; }
  .tier2-card.working::before { background: var(--gold2); }
  .tier2-card.complete { border-color: rgba(94,232,176,0.35); opacity: 1; }
  .tier2-card.complete::before { background: var(--done); }
  .tier2-card.failed   { border-color: rgba(255,80,80,0.5); opacity: 1; background: linear-gradient(160deg, rgba(28,8,8,0.97) 0%, rgba(14,4,4,0.98) 100%); }
  .tier2-card.failed::before { background: #ff5050; box-shadow: 0 0 8px rgba(255,80,80,0.5); }

  .tier2-status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; letter-spacing: 0.14em; font-family: 'Cinzel', serif; padding: 2px 7px; border-radius: 3px; }
  .tier2-status-badge.assigned { color: var(--muted); border: 1px solid var(--border); }
  .tier2-status-badge.working  { color: var(--active); border: 1px solid rgba(232,184,75,0.4); animation: blink 1s step-end infinite; }
  .tier2-status-badge.complete { color: var(--done); border: 1px solid rgba(94,232,176,0.3); }
  .tier2-status-badge.failed   { color: #ff5050; border: 1px solid rgba(255,80,80,0.4); }
  .tier2-timer { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--active); margin-left: auto; }
  .tier2-error-msg { font-size: 11px; color: #ff7070; font-family: 'JetBrains Mono', monospace; line-height: 1.5; margin-top: 6px; background: rgba(255,80,80,0.07); padding: 6px 8px; border-radius: 4px; border-left: 2px solid rgba(255,80,80,0.5); }

  .zeus-diagnostic { max-width: 720px; width: 100%; background: linear-gradient(160deg, rgba(18,14,4,0.99) 0%, rgba(10,8,2,0.99) 100%); border: 1px solid rgba(232,184,75,0.4); border-radius: 8px; padding: 18px 22px; box-shadow: 0 0 32px rgba(232,184,75,0.06), 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(232,184,75,0.08); position: relative; overflow: hidden; }
  .zeus-diagnostic::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(232,184,75,0.6), transparent); }
  .zeus-diagnostic-header { font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.22em; color: var(--gold); text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .zeus-diagnostic-meta { font-size: 10px; color: rgba(232,184,75,0.5); font-family: 'JetBrains Mono', monospace; margin-bottom: 8px; }
  .zeus-diagnostic-body { font-size: 10.5px; line-height: 1.75; color: rgba(232,184,75,0.85); font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; word-break: break-word; }

  .phase-timer-badge { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: rgba(232,184,75,0.6); margin-left: auto; padding: 1px 6px; border: 1px solid rgba(232,184,75,0.2); border-radius: 3px; }
  .council-speaker-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 10px; letter-spacing: 0.1em; color: var(--active); font-family: 'Cinzel', serif; animation: blink 1.2s step-end infinite; }
  .agent-node.failed { border-color: rgba(255,80,80,0.5); opacity: 1; background: linear-gradient(160deg, rgba(28,8,8,0.97) 0%, rgba(14,4,4,0.98) 100%); }
  .agent-node.failed::before { background: #ff5050; box-shadow: 0 0 8px rgba(255,80,80,0.5); }

  .tier2-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .tier2-card-symbol { font-size: 22px; }
  .tier2-card-name   { font-family: 'Cinzel', serif; font-size: 13px; font-weight: 600; letter-spacing: 0.12em; flex: 1; }
  .tier2-card-status { font-size: 12px; color: var(--muted); }
  .tier2-card-status.thinking { color: var(--active); animation: blink 1s step-end infinite; }
  .tier2-card-status.done     { color: var(--done); }
  .tier2-card-domain  { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; margin-bottom: 10px; }
  .tier2-card-content { font-size: 9.5px; line-height: 1.65; color: var(--text); max-height: 130px; overflow: hidden; mask-image: linear-gradient(180deg, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%); }

  .tier2-synthesis {
    max-width: 720px; width: 100%;
    background: linear-gradient(160deg, rgba(6,11,26,0.99) 0%, rgba(4,7,16,0.99) 100%);
    border: 1px solid rgba(94,232,176,0.35); border-radius: 8px;
    padding: 22px 26px;
    box-shadow: 0 0 48px rgba(94,232,176,0.05), 0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(94,232,176,0.08);
    animation: vote-burst 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    position: relative; overflow: hidden;
  }
  .tier2-synthesis::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(94,232,176,0.5), transparent); border-radius: 8px 8px 0 0; }
  .tier2-synth-header { font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.22em; color: var(--done); text-transform: uppercase; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .tier2-synth-body   { font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.85; color: #d8e4f0; white-space: pre-wrap; word-break: break-word; max-height: calc(100vh - 280px); overflow-y: auto; }

  /* ── Direct modes (zeus_protocol, poseidon, hades, gaia) ────────────── */
  .direct-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 40px; gap: 0; }

  .direct-symbol { font-size: 80px; line-height: 1; margin-bottom: 18px; }
  .mode-zeus_protocol .direct-symbol { animation: symbol-pulse-gold 3s ease infinite; }
  .mode-poseidon      .direct-symbol { animation: symbol-pulse-poseidon 3s ease infinite; }
  .mode-hades         .direct-symbol { animation: symbol-pulse-hades 3s ease infinite; }
  .mode-gaia          .direct-symbol { animation: symbol-pulse-gaia 3s ease infinite; }

  .direct-agent-label { font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 0.35em; margin-bottom: 6px; }
  .mode-zeus_protocol .direct-agent-label { color: var(--gold); }
  .mode-poseidon      .direct-agent-label { color: var(--poseidon); }
  .mode-hades         .direct-agent-label { color: var(--hades); }
  .mode-gaia          .direct-agent-label { color: var(--gaia); }

  .direct-channel-label { font-size: 10px; letter-spacing: 0.2em; color: var(--muted); font-family: 'Cinzel', serif; text-transform: uppercase; margin-bottom: 42px; opacity: 0.45; }

  .direct-thinking { font-size: 11px; letter-spacing: 0.2em; font-family: 'Cinzel', serif; animation: blink 1.4s step-end infinite; margin-bottom: 24px; opacity: 0.8; }
  .mode-zeus_protocol .direct-thinking { color: var(--gold); }
  .mode-poseidon      .direct-thinking { color: var(--poseidon); }
  .mode-hades         .direct-thinking { color: var(--hades); }
  .mode-gaia          .direct-thinking { color: var(--gaia); }

  .direct-response { max-width: 1100px; width: 90%; border-radius: 8px; padding: 24px 28px; font-family: 'JetBrains Mono', monospace; font-size: 13.5px; line-height: 1.85; white-space: pre-wrap; word-break: break-word; animation: mode-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; position: relative; max-height: calc(100vh - 280px); overflow-y: auto; }
  .direct-response::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; border-radius: 8px 8px 0 0; }
  .mode-zeus_protocol .direct-response { background: rgba(8,8,8,0.95); border: 1px solid rgba(232,184,75,0.25); color: var(--gold2); box-shadow: 0 0 40px rgba(232,184,75,0.05); }
  .mode-zeus_protocol .direct-response::before { background: linear-gradient(90deg, transparent, rgba(232,184,75,0.45), transparent); }
  .mode-poseidon .direct-response { background: rgba(2,10,20,0.96); border: 1px solid rgba(74,184,232,0.25); color: #b8d8ea; box-shadow: 0 0 40px rgba(74,184,232,0.05); }
  .mode-poseidon .direct-response::before { background: linear-gradient(90deg, transparent, rgba(74,184,232,0.45), transparent); }
  .mode-hades    .direct-response { background: rgba(6,3,14,0.96); border: 1px solid rgba(176,74,220,0.25); color: #caa8da; box-shadow: 0 0 40px rgba(176,74,220,0.05); }
  .mode-hades    .direct-response::before { background: linear-gradient(90deg, transparent, rgba(176,74,220,0.45), transparent); }
  .mode-gaia     .direct-response { background: rgba(3,9,6,0.96); border: 1px solid rgba(120,216,122,0.25); color: #a8d8aa; box-shadow: 0 0 40px rgba(120,216,122,0.05); }
  .mode-gaia     .direct-response::before { background: linear-gradient(90deg, transparent, rgba(120,216,122,0.45), transparent); }

  .direct-streaming { max-width: 1100px; width: 90%; border-radius: 8px; padding: 24px 28px; font-family: 'JetBrains Mono', monospace; font-size: 13.5px; line-height: 1.85; white-space: pre-wrap; word-break: break-word; position: relative; max-height: calc(100vh - 280px); overflow-y: auto; opacity: 0.75; }
  .mode-zeus_protocol .direct-streaming { background: rgba(8,8,8,0.9); border: 1px solid rgba(232,184,75,0.15); color: rgba(232,184,75,0.7); }
  .mode-poseidon      .direct-streaming { background: rgba(2,10,20,0.9); border: 1px solid rgba(74,184,232,0.15); color: rgba(74,184,232,0.7); }
  .mode-hades         .direct-streaming { background: rgba(6,3,14,0.9); border: 1px solid rgba(176,74,220,0.15); color: rgba(176,74,220,0.7); }
  .mode-gaia          .direct-streaming { background: rgba(3,9,6,0.9); border: 1px solid rgba(120,216,122,0.15); color: rgba(120,216,122,0.7); }
  .streaming-cursor { display: inline-block; width: 2px; height: 1em; vertical-align: text-bottom; animation: blink 1s step-end infinite; margin-left: 2px; }
  .mode-zeus_protocol .streaming-cursor { background: var(--gold); }
  .mode-poseidon      .streaming-cursor { background: var(--poseidon); }
  .mode-hades         .streaming-cursor { background: var(--hades); }
  .mode-gaia          .streaming-cursor { background: var(--gaia); }

  /* ── Gaia mode view ─────────────────────────────────────────────────── */
  .gaia-area {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    padding: 36px 40px 24px; overflow-y: auto; gap: 0;
  }
  .gaia-symbol { font-size: 64px; line-height: 1; margin-bottom: 12px; animation: symbol-pulse-gaia 3s ease infinite; }
  .gaia-label  { font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 0.35em; color: var(--gaia); opacity: 0.8; margin-bottom: 4px; }
  .gaia-sublabel { font-size: 10px; letter-spacing: 0.2em; color: var(--muted); font-family: 'Cinzel', serif; text-transform: uppercase; opacity: 0.45; margin-bottom: 20px; }
  .gaia-tabs { display: flex; gap: 5px; margin-bottom: 24px; }

  .gaia-messages { width: 100%; max-width: 720px; display: flex; flex-direction: column; gap: 14px; }
  .gaia-empty { font-size: 11px; color: var(--dim); font-family: 'Cinzel', serif; letter-spacing: 0.15em; text-align: center; padding: 32px 0; }
  .gaia-message-item {
    background: rgba(3,9,6,0.85); border: 1px solid rgba(120,216,122,0.14);
    border-radius: 8px; padding: 16px 20px; position: relative;
    animation: mode-enter 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }
  .gaia-message-item::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(120,216,122,0.3), transparent); border-radius: 8px 8px 0 0; }
  .gaia-msg-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .gaia-msg-user { font-size: 10px; font-family: 'Cinzel', serif; letter-spacing: 0.12em; color: var(--gaia); opacity: 0.7; }
  .gaia-msg-time { font-size: 10px; color: var(--muted); font-family: 'JetBrains Mono', monospace; }
  .gaia-msg-question { font-size: 12px; color: var(--text); font-family: 'JetBrains Mono', monospace; line-height: 1.6; margin-bottom: 10px; opacity: 0.7; padding-bottom: 10px; border-bottom: 1px solid rgba(120,216,122,0.08); }
  .gaia-msg-response { font-size: 13px; color: #a8d8aa; font-family: 'JetBrains Mono', monospace; line-height: 1.85; white-space: pre-wrap; word-break: break-word; max-height: calc(100vh - 520px); overflow-y: auto; }
  .gaia-msg-response, .gaia-area { scrollbar-width: thin; scrollbar-color: rgba(42,96,52,0.6) transparent; }
  .gaia-msg-response::-webkit-scrollbar, .gaia-area::-webkit-scrollbar { width: 3px; }
  .gaia-msg-response::-webkit-scrollbar-track, .gaia-area::-webkit-scrollbar-track { background: transparent; }
  .gaia-msg-response::-webkit-scrollbar-thumb, .gaia-area::-webkit-scrollbar-thumb { background: rgba(42,96,52,0.6); border-radius: 2px; }

  /* ── User context badge (input bar) ─────────────────────────────────── */
  .user-context-btn {
    padding: 3px 10px; border-radius: 2px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); font-family: 'Cinzel', serif;
    font-size: 10px; letter-spacing: 0.12em; cursor: pointer; transition: all 0.2s;
    white-space: nowrap;
  }
  .user-context-btn.user-active  { border-color: var(--gold); color: var(--gold2); background: rgba(200,150,10,0.07); }
  .user-context-btn.user-none    { opacity: 0.5; }
  .user-context-btn:hover { border-color: var(--border2); opacity: 1; color: var(--text); }

  /* ── Scrollable output — thin dark scrollbar ───────────────────────── */
  .tier1-response, .direct-response, .output-text-body, .tier2-synth-body {
    scrollbar-width: thin;
    scrollbar-color: rgba(42,53,96,0.7) transparent;
  }
  .tier1-response::-webkit-scrollbar,
  .direct-response::-webkit-scrollbar,
  .output-text-body::-webkit-scrollbar,
  .tier2-synth-body::-webkit-scrollbar { width: 3px; }
  .tier1-response::-webkit-scrollbar-track,
  .direct-response::-webkit-scrollbar-track,
  .output-text-body::-webkit-scrollbar-track,
  .tier2-synth-body::-webkit-scrollbar-track { background: transparent; }
  .tier1-response::-webkit-scrollbar-thumb,
  .direct-response::-webkit-scrollbar-thumb,
  .output-text-body::-webkit-scrollbar-thumb,
  .tier2-synth-body::-webkit-scrollbar-thumb { background: rgba(42,53,96,0.7); border-radius: 2px; }
  .tier1-response::-webkit-scrollbar-thumb:hover,
  .direct-response::-webkit-scrollbar-thumb:hover,
  .output-text-body::-webkit-scrollbar-thumb:hover,
  .tier2-synth-body::-webkit-scrollbar-thumb:hover { background: rgba(74,85,128,0.9); }

  /* ── Idle triangle ─────────────────────────────────────────────────── */
  .idle-triangle-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    animation: mode-enter 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes pipeline-enter {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .pipeline-content { animation: pipeline-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }

  /* ── Input bar ──────────────────────────────────────────────────────── */
  .input-bar { border-top: 1px solid var(--border); background: rgba(9,12,24,0.92); padding: 14px 20px 16px; flex-shrink: 0; position: relative; z-index: 10; backdrop-filter: blur(12px); box-shadow: 0 -1px 0 rgba(42,53,96,0.4), 0 -4px 24px rgba(0,0,0,0.4); }
  .input-bar::before { content: ''; position: absolute; top: -1px; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(200,150,10,0.1) 20%, rgba(232,184,75,0.2) 50%, rgba(200,150,10,0.1) 80%, transparent 100%); transition: background 0.6s ease; }
  .mode-zeus_protocol .input-bar { background: rgba(0,0,0,0.96); }
  .mode-zeus_protocol .input-bar::before { background: linear-gradient(90deg, transparent, rgba(232,184,75,0.35), transparent); }
  .mode-poseidon      .input-bar::before { background: linear-gradient(90deg, transparent, rgba(74,184,232,0.25), transparent); }
  .mode-hades         .input-bar::before { background: linear-gradient(90deg, transparent, rgba(176,74,220,0.25), transparent); }
  .mode-gaia          .input-bar::before { background: linear-gradient(90deg, transparent, rgba(120,216,122,0.25), transparent); }

  .input-inner { max-width: 800px; margin: 0 auto; }
  .input-textarea { width: 100%; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; padding: 10px 12px; resize: none; height: 68px; outline: none; transition: border-color 0.2s; }
  .input-textarea::placeholder { color: var(--dim); }
  .input-textarea:focus { border-color: var(--border2); }
  .input-textarea:disabled { opacity: 0.5; cursor: not-allowed; }
  .mode-zeus_protocol .input-textarea { background: rgba(8,8,8,0.9); border-color: rgba(232,184,75,0.15); color: var(--gold2); }
  .mode-zeus_protocol .input-textarea::placeholder { color: rgba(232,184,75,0.2); }
  .mode-zeus_protocol .input-textarea:focus { border-color: rgba(232,184,75,0.35); }
  .mode-poseidon .input-textarea:focus { border-color: rgba(74,184,232,0.35); }
  .mode-hades    .input-textarea:focus { border-color: rgba(176,74,220,0.35); }
  .mode-gaia     .input-textarea:focus { border-color: rgba(120,216,122,0.35); }

  .input-controls { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; gap: 10px; }
  .target-btns { display: flex; gap: 6px; flex-wrap: wrap; }

  .target-btn { padding: 4px 11px; background: var(--bg3); border: 1px solid var(--border); border-radius: 3px; color: var(--muted); font-family: 'Cinzel', serif; font-size: 8.5px; letter-spacing: 0.08em; cursor: pointer; transition: all 0.25s; }
  .target-btn:hover { border-color: var(--border2); color: var(--text); }

  /* Active state — default (tier3/tier2) */
  .target-btn.active { border-color: var(--gold); color: var(--gold2); background: rgba(200,150,10,0.08); }

  /* Mode-specific active target button */
  .mode-zeus_protocol .target-btn.active { border-color: var(--gold2); color: var(--gold2); background: rgba(232,184,75,0.12); box-shadow: 0 0 10px rgba(232,184,75,0.1); }
  .mode-poseidon      .target-btn.active { border-color: var(--poseidon); color: var(--poseidon); background: rgba(74,184,232,0.1); }
  .mode-hades         .target-btn.active { border-color: var(--hades);    color: var(--hades);    background: rgba(176,74,220,0.1); }
  .mode-gaia          .target-btn.active { border-color: var(--gaia);     color: var(--gaia);     background: rgba(120,216,122,0.1); }

  .send-btn { padding: 6px 22px; background: rgba(200,150,10,0.1); border: 1px solid rgba(200,150,10,0.35); border-radius: 3px; color: var(--gold2); font-family: 'Cinzel', serif; font-size: 9.5px; letter-spacing: 0.18em; cursor: pointer; transition: all 0.25s; white-space: nowrap; flex-shrink: 0; }
  .send-btn:hover:not(:disabled) { background: rgba(200,150,10,0.18); box-shadow: 0 0 14px rgba(200,150,10,0.2); }
  .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .send-btn.sending  { animation: pulse-dot 1s ease infinite; }
  .mode-poseidon .send-btn { border-color: rgba(74,184,232,0.35); color: var(--poseidon); background: rgba(74,184,232,0.08); }
  .mode-poseidon .send-btn:hover:not(:disabled) { background: rgba(74,184,232,0.16); box-shadow: 0 0 14px rgba(74,184,232,0.15); }
  .mode-hades .send-btn    { border-color: rgba(176,74,220,0.35); color: var(--hades); background: rgba(176,74,220,0.08); }
  .mode-hades .send-btn:hover:not(:disabled) { background: rgba(176,74,220,0.16); box-shadow: 0 0 14px rgba(176,74,220,0.15); }
  .mode-gaia .send-btn     { border-color: rgba(120,216,122,0.35); color: var(--gaia); background: rgba(120,216,122,0.08); }
  .mode-gaia .send-btn:hover:not(:disabled) { background: rgba(120,216,122,0.16); box-shadow: 0 0 14px rgba(120,216,122,0.15); }




  /* ── Quorum sub-pills ────────────────────────────────────────── */
  .node-health-expanded {
    position: absolute; top: 100%; right: 0; margin-top: 4px;
    background: rgba(9,12,24,0.98); border: 1px solid #1a2040;
    border-radius: 4px; padding: 12px 14px; z-index: 100;
    animation: mode-enter 0.2s ease both; min-width: 280px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  }
  .node-health-group { margin-bottom: 10px; }
  .node-health-group:last-child { margin-bottom: 0; }
  .node-health-head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .quorum-row { display: flex; gap: 4px; margin-left: 18px; flex-wrap: wrap; }
  .quorum-chip {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 7px; border-radius: 3px;
    background: rgba(9,12,24,0.6); border: 1px solid rgba(26,32,64,0.6);
    font-family: 'JetBrains Mono', monospace; font-size: 9px;
    letter-spacing: 0.08em; color: var(--dim); text-transform: uppercase;
    opacity: 0.7;
  }
  .quorum-chip .dot { width: 4px; height: 4px; border-radius: 50%; background: var(--muted); }
  .quorum-chip.online .dot { background: var(--done); box-shadow: 0 0 4px var(--done); }
  .quorum-chip.offline .dot { background: #ff5050; }
  /* ── Queue expand prompt ─────────────────────────────────────── */
  .queue-item-name { font-size: 14px; color: var(--text); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
  .queue-expand-btn {
    display: none; align-items: center; justify-content: center;
    width: 14px; height: 14px; border-radius: 2px;
    background: transparent; border: none; cursor: pointer;
    color: var(--dim); font-size: 9px; transition: all 0.15s;
    flex-shrink: 0; padding: 0;
  }
  .queue-item:hover .queue-expand-btn { display: flex; }
  .queue-expand-btn.open { display: flex; color: var(--gold); transform: rotate(180deg); }
  .queue-expanded-text {
    margin-top: 3px; padding: 4px 6px;
    background: rgba(5,7,15,0.5); border-radius: 2px;
    border-left: 2px solid rgba(200,150,10,0.1);
    font-size: 10px; color: var(--dim); line-height: 1.4;
    max-height: 60px; overflow-y: auto; word-break: break-word;
  }

  /* ── Smart name + trash + expand ─────────────────────────────── */
  .req-trash-btn {
    display: none; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 3px;
    background: transparent; border: none; cursor: pointer;
    color: var(--dim); font-size: 13px; transition: all 0.15s;
    flex-shrink: 0; padding: 0;
  }
  .req-item:hover .req-trash-btn { display: flex; }
  .req-trash-btn:hover { background: rgba(255,60,60,0.25); color: #ff6060; box-shadow: 0 0 6px rgba(255,60,60,0.18); }
  .req-expand-btn {
    display: none; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 3px;
    background: transparent; border: none; cursor: pointer;
    color: var(--dim); font-size: 10px; transition: all 0.15s;
    flex-shrink: 0; padding: 0; margin-left: 2px;
  }
  .req-item:hover .req-expand-btn { display: flex; }
  .req-expand-btn:hover { background: rgba(200,150,10,0.15); color: var(--muted); }
  .req-expand-btn.open { display: flex; color: var(--gold); transform: rotate(180deg); }
  .req-expanded-prompt {
    margin-top: 4px; padding: 6px 8px;
    background: rgba(5,7,15,0.6); border-radius: 3px;
    border-left: 2px solid rgba(200,150,10,0.15);
    font-size: 11px; color: var(--muted); line-height: 1.5;
    max-height: 80px; overflow-y: auto; word-break: break-word;
  }
  .req-expanded-prompt::-webkit-scrollbar { width: 2px; }
  .req-expanded-prompt::-webkit-scrollbar-thumb { background: rgba(200,150,10,0.15); border-radius: 2px; }

  /* ── Unified input container ─────────────────────────────────── */
  .input-unified {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg3);
    overflow: visible;
    transition: border-color 0.2s;
  }
  .input-unified:focus-within { border-color: var(--border2); }
  .mode-zeus_protocol .input-unified { background: rgba(8,8,8,0.9); border-color: rgba(232,184,75,0.15); }
  .mode-zeus_protocol .input-unified:focus-within { border-color: rgba(232,184,75,0.35); }
  .mode-poseidon .input-unified:focus-within { border-color: rgba(74,184,232,0.35); }
  .mode-hades    .input-unified:focus-within { border-color: rgba(176,74,220,0.35); }
  .mode-gaia     .input-unified:focus-within { border-color: rgba(120,216,122,0.35); }
  .input-unified .input-textarea { border: none !important; border-radius: 0; background: transparent !important; }
  .input-unified .input-controls { margin-top: 0; padding: 6px 10px; border-top: 1px solid var(--border); background: rgba(5,7,15,0.4); }
  .route-selector { position: relative; }
  .route-current {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 11px; background: var(--bg3); border: 1px solid var(--border);
    border-radius: 3px; color: var(--gold2); font-family: 'Cinzel', serif;
    font-size: 8.5px; letter-spacing: 0.08em; cursor: pointer; transition: all 0.25s;
    white-space: nowrap;
  }
  .route-current:hover { border-color: var(--border2); }
  .route-current .route-chevron { font-size: 9px; opacity: 0.6; transition: transform 0.2s; }
  .route-current .route-chevron.open { transform: rotate(180deg); }
  .route-dropdown {
    position: absolute; bottom: calc(100% + 4px); left: 0;
    background: rgba(9,12,24,0.98); border: 1px solid var(--border);
    border-radius: 4px; padding: 4px 0; z-index: 100; min-width: 160px;
    animation: mode-enter 0.15s ease both;
    box-shadow: 0 -4px 16px rgba(0,0,0,0.4);
  }
  .route-option {
    display: block; width: 100%; padding: 6px 12px; background: none; border: none;
    color: var(--muted); font-family: 'Cinzel', serif; font-size: 8.5px;
    letter-spacing: 0.08em; cursor: pointer; text-align: left; transition: all 0.15s;
  }
  .route-option:hover { background: rgba(200,150,10,0.08); color: var(--text); }
  .route-option.active { color: var(--gold2); background: rgba(200,150,10,0.06); }
  .send-arrow {
    width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
    background: rgba(200,150,10,0.1); border: 1px solid rgba(200,150,10,0.35);
    border-radius: 50%; color: var(--gold2); font-size: 16px; cursor: pointer;
    transition: all 0.25s; flex-shrink: 0; line-height: 1;
  }
  .send-arrow:hover:not(:disabled) { background: rgba(200,150,10,0.18); box-shadow: 0 0 14px rgba(200,150,10,0.2); }
  .send-arrow:disabled { opacity: 0.35; cursor: not-allowed; }
  .send-arrow.sending { animation: pulse-dot 1s ease infinite; }
  .mode-poseidon .send-arrow { border-color: rgba(74,184,232,0.35); color: var(--poseidon); background: rgba(74,184,232,0.08); }
  .mode-poseidon .send-arrow:hover:not(:disabled) { background: rgba(74,184,232,0.16); box-shadow: 0 0 14px rgba(74,184,232,0.15); }
  .mode-hades .send-arrow { border-color: rgba(176,74,220,0.35); color: var(--hades); background: rgba(176,74,220,0.08); }
  .mode-hades .send-arrow:hover:not(:disabled) { background: rgba(176,74,220,0.16); box-shadow: 0 0 14px rgba(176,74,220,0.15); }
  .mode-gaia .send-arrow { border-color: rgba(120,216,122,0.35); color: var(--gaia); background: rgba(120,216,122,0.08); }
  .mode-gaia .send-arrow:hover:not(:disabled) { background: rgba(120,216,122,0.16); box-shadow: 0 0 14px rgba(120,216,122,0.15); }
  .gaia-input-bar .send-arrow { background: rgba(8,25,10,0.88) !important; border-color: rgba(120,216,122,0.45) !important; color: var(--gaia) !important; }
  .gaia-input-bar .send-arrow:hover:not(:disabled) { background: rgba(12,38,15,0.92) !important; box-shadow: 0 0 18px rgba(120,216,122,0.28) !important; }
  .gaia-input-bar .input-unified { border-color: rgba(120,216,122,0.18); }
  .gaia-input-bar .input-unified:focus-within { border-color: rgba(120,216,122,0.45); box-shadow: 0 0 14px rgba(120,216,122,0.07); }

  /* ── Gaia input bar ──────────────────────────────────────────────── */
  .gaia-input-bar { border-top-color: rgba(120,216,122,0.2) !important; }
  .gaia-input-bar::before { background: linear-gradient(90deg, transparent, rgba(120,216,122,0.3), transparent) !important; }
  .gaia-input-bar .input-textarea { border-color: rgba(120,216,122,0.18); }
  .gaia-input-bar .input-textarea:focus { border-color: rgba(120,216,122,0.45); box-shadow: 0 0 14px rgba(120,216,122,0.07); }
  .gaia-send-btn { background: rgba(8,25,10,0.88) !important; border-color: rgba(120,216,122,0.45) !important; color: var(--gaia) !important; }
  .gaia-send-btn:hover:not(:disabled) { background: rgba(12,38,15,0.92) !important; box-shadow: 0 0 18px rgba(120,216,122,0.28) !important; }

  /* ── Gaia topbar button ───────────────────────────────────────────── */
  .gaia-topbar-btn {
    display: flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; border-radius: 6px;
    background: rgba(9,12,24,0.8); border: 1px solid rgba(120,216,122,0.25);
    cursor: pointer; font-size: 22px; transition: all 0.3s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(120,216,122,0);
    animation: gaia-idle-pulse 4s ease-in-out infinite;
    position: relative; flex-shrink: 0;
  }
  @keyframes gaia-idle-pulse {
    0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 8px rgba(120,216,122,0.08); border-color: rgba(120,216,122,0.22); }
    50%       { box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 18px rgba(120,216,122,0.28); border-color: rgba(120,216,122,0.5); }
  }
  .gaia-topbar-btn:hover {
    background: rgba(12,20,12,0.9); border-color: rgba(120,216,122,0.7);
    box-shadow: 0 0 20px rgba(120,216,122,0.3), 0 0 40px rgba(120,216,122,0.1);
    transform: scale(1.05);
    animation: none;
  }
  .gaia-topbar-btn.gaia-active {
    background: rgba(8,20,10,0.95); border-color: var(--gaia);
    box-shadow: 0 0 24px rgba(120,216,122,0.4), 0 0 48px rgba(120,216,122,0.15), inset 0 0 12px rgba(120,216,122,0.06);
    animation: gaia-active-pulse 2s ease-in-out infinite;
  }
  @keyframes gaia-active-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(120,216,122,0.35), 0 0 40px rgba(120,216,122,0.12); }
    50%       { box-shadow: 0 0 30px rgba(120,216,122,0.55), 0 0 60px rgba(120,216,122,0.2); }
  }

  /* ── Top-level view toggle ──────────────────────────────────────────── */
  .top-toggle {
    display: flex;
    gap: 2px;
    background: rgba(13,18,37,0.8);
    border: 1px solid #1a2040;
    border-radius: 4px;
    padding: 2px;
  }
  .top-toggle-btn {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 3px;
    border: none;
    background: transparent;
    color: #2a3560;
    cursor: pointer;
    transition: all 0.2s;
  }
  .top-toggle-btn:hover { color: #4a5580; }
  .top-toggle-btn.active {
    background: rgba(200,150,10,0.1);
    color: #e8b84b;
  }
  .node-health-btn {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid #1a2040;
    background: transparent;
    color: #2a3560;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .node-health-btn:hover { border-color: #2a3560; color: #4a5580; }
  .node-health-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: rgba(9,12,24,0.98);
    border: 1px solid #1a2040;
    border-radius: 4px;
    padding: 8px 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    z-index: 100;
    animation: mode-enter 0.2s ease both;
  }

  /* ── Gaia tree layout ─────────────────────────────────────────────── */
  .gaia-tree-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
  .gaia-canvas-center { flex: 1; overflow: hidden; position: relative; display: flex; flex-direction: column; }

  /* ── Gaia view toggle ──────────────────────────────────────────────── */
  .gaia-view-toggle-bar {
    position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
    z-index: 20; pointer-events: all;
  }
  .gaia-view-toggle {
    display: flex; gap: 2px;
    background: rgba(3,14,5,0.85);
    border: 1px solid rgba(120,216,122,0.22);
    border-radius: 20px; padding: 3px;
    backdrop-filter: blur(12px);
    box-shadow: 0 0 20px rgba(120,216,122,0.08), 0 2px 16px rgba(0,0,0,0.5);
  }
  .gaia-toggle-btn {
    background: transparent; border: none; cursor: pointer;
    font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 0.15em;
    color: rgba(120,216,122,0.45); padding: 5px 16px; border-radius: 16px;
    transition: all 0.25s ease;
  }
  .gaia-toggle-btn:hover { color: rgba(120,216,122,0.75); }
  .gaia-toggle-btn.active {
    background: rgba(120,216,122,0.14);
    color: #78d87a;
    box-shadow: 0 0 12px rgba(120,216,122,0.2), inset 0 0 8px rgba(120,216,122,0.06);
    text-shadow: 0 0 10px rgba(120,216,122,0.5);
  }


  /* ── Cinematic Takeover (T2/T3) ──────────────────────────────────── */
  @keyframes takeover-fade { from { opacity: 0; } to { opacity: 1; } }

  .cinematic-takeover {
    position: fixed; inset: 0; z-index: 1000;
    background: #05070f;
    display: grid; grid-template-columns: 1fr 1fr;
    animation: takeover-fade 0.3s ease both;
  }
  .cinematic-exit {
    position: absolute; top: 16px; right: 20px; z-index: 1001;
    background: none; border: 1px solid rgba(255,255,255,0.12); color: var(--muted);
    font-size: 11px; padding: 4px 10px; border-radius: 3px; cursor: pointer;
    font-family: "Cinzel", serif; letter-spacing: 0.1em;
    transition: border-color 0.2s, color 0.2s;
  }
  .cinematic-exit:hover { border-color: var(--gold); color: var(--gold); }

  .cinematic-left {
    height: 100vh; display: flex; flex-direction: column;
    padding: 20px 24px 0; overflow: hidden;
    border-right: 1px solid rgba(232,184,75,0.12);
  }
  .cinematic-right {
    height: 100vh; display: flex; flex-direction: column;
    padding: 20px 24px; overflow: hidden;
  }

  .cinematic-tier-badge {
    font-family: "Cinzel", serif; font-size: 10px; letter-spacing: 0.2em;
    color: var(--gold); margin-bottom: 8px; display: flex; align-items: center; gap: 10px;
    flex-shrink: 0;
  }
  .cinematic-tier-badge .tier-label {
    padding: 3px 10px; border: 1px solid rgba(232,184,75,0.3);
    border-radius: 3px; background: rgba(232,184,75,0.06);
  }
  .cinematic-mission-text {
    font-size: 12px; color: var(--text); font-family: "JetBrains Mono", monospace;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 80%;
  }

  /* Wrap the existing mode view and make it fill the left panel */
  .cinematic-flow-wrap {
    flex: 1; min-height: 0; display: flex; overflow: hidden;
  }
  /* Constrain existing flow-area / tier2-area to fit in takeover */
  .cinematic-flow-wrap .flow-area,
  .cinematic-flow-wrap .tier2-area {
    flex: 1; overflow-y: auto; overflow-x: hidden;
  }
  /* Scale the flow diagram to fit viewport */
  .cinematic-flow-wrap .flow-container {
    transform-origin: top center;
    transform: scale(0.78);
    width: 100% !important;
  }
  .cinematic-flow-wrap .flow-svg {
    height: 670px !important;
  }
  /* Compact tier2 cards slightly */
  .cinematic-flow-wrap .tier2-area { padding: 16px 12px; }
  .cinematic-flow-wrap .tier2-card { padding: 10px 12px; }
  .cinematic-flow-wrap .tier2-agents { gap: 10px; }

  /* Right panel */
  .cinematic-right-header {
    font-family: "Cinzel", serif; font-size: 11px; letter-spacing: 0.15em;
    color: var(--gold); margin-bottom: 12px; flex-shrink: 0;
  }
  .cinematic-council-section {
    flex: 1; min-height: 0; overflow-y: auto;
    display: flex; flex-direction: column; gap: 12px;
  }
  .cinematic-council-section::-webkit-scrollbar { width: 3px; }
  .cinematic-council-section::-webkit-scrollbar-thumb { background: rgba(232,184,75,0.15); border-radius: 2px; }

  .cinematic-phase-label {
    font-family: "Cinzel", serif; font-size: 9px; letter-spacing: 0.15em;
    color: var(--muted); margin-top: 8px; margin-bottom: 4px; flex-shrink: 0;
  }

  /* ── Gaia chat view ────────────────────────────────────────────────── */
  .gaia-chat-view {
    flex: 1; overflow: hidden; display: flex; flex-direction: column;
    padding-top: 52px; /* space for toggle bar */
  }

  /* ── Gaia council view (OLYMPUS CHANNEL) ───────────────────────────── */
  .gaia-council-view {
    flex: 1; overflow-y: auto; padding: 16px 20px;
    display: flex; flex-direction: column; gap: 6px;
    padding-top: 58px;
  }
  .gaia-council-view::-webkit-scrollbar { width: 3px; }
  .gaia-council-view::-webkit-scrollbar-thumb { background: rgba(120,216,122,0.2); border-radius: 2px; }
  .gaia-council-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: rgba(120,216,122,0.5); font-family: 'Cinzel', serif; letter-spacing: 0.12em;
    text-align: center;
  }
  .gaia-council-exchange {
    display: flex; flex-direction: column; gap: 6px;
    margin-bottom: 16px; padding-bottom: 16px;
    border-bottom: 1px solid rgba(120,216,122,0.08);
  }
  .gaia-council-msg {
    max-width: 78%; padding: 10px 14px; border-radius: 8px; font-size: 14px;
    line-height: 1.55;
  }
  .gaia-council-msg.gaia-left {
    align-self: flex-start;
    background: rgba(120,216,122,0.07); border: 1px solid rgba(120,216,122,0.18);
  }
  .gaia-council-msg.council-right {
    align-self: flex-end;
    background: rgba(232,184,75,0.07); border: 1px solid rgba(232,184,75,0.18);
  }
  .gaia-council-speaker {
    font-size: 11px; font-family: 'Cinzel', serif; letter-spacing: 0.15em;
    margin-bottom: 6px; font-weight: 600;
  }
  .gaia-council-speaker.gaia     { color: var(--gaia); }
  .gaia-council-speaker.zeus     { color: var(--gold); }
  .gaia-council-speaker.poseidon { color: var(--teal); }
  .gaia-council-speaker.hades    { color: #b04adc; }
  .gaia-council-text {
    color: rgba(220,240,220,0.88); white-space: pre-wrap; word-break: break-word;
  }
  .gaia-council-msg.council-right .gaia-council-text { color: rgba(255,240,185,0.88); }
  .gaia-council-meta {
    font-size: 11px; color: var(--dim); margin-top: 6px;
    font-family: 'JetBrains Mono', monospace; opacity: 0.6;
  }

  /* ── SSH CTRL tab ───────────────────────────────────────────────── */
  .gaia-feed-tab.ssh-tab-active { color: var(--gold); border-bottom-color: var(--gold); }
  .gaia-ssh-entry {
    margin-bottom: 12px; padding: 10px 12px; border-radius: 6px;
    border-left: 2px solid transparent;
  }
  .gaia-ssh-entry.ok     { border-left-color: rgba(120,216,122,0.5); background: rgba(120,216,122,0.04); }
  .gaia-ssh-entry.failed { border-left-color: rgba(220,80,80,0.5);   background: rgba(220,80,80,0.04); }
  .gaia-ssh-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .gaia-ssh-status { font-size: 13px; font-weight: 700; }
  .gaia-ssh-status.ok     { color: var(--gaia); }
  .gaia-ssh-status.failed { color: #dc5050; }
  .gaia-ssh-node { font-size: 11px; font-family: 'Cinzel', serif; letter-spacing: 0.12em; color: var(--gold); }
  .gaia-ssh-time { font-size: 11px; color: var(--dim); margin-left: auto; font-family: 'JetBrains Mono', monospace; }
  .gaia-ssh-command { font-size: 12px; font-family: 'JetBrains Mono', monospace; color: rgba(200,230,200,0.85); margin-bottom: 4px; }
  .gaia-ssh-command code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; }
  .gaia-ssh-reason { font-size: 12px; color: var(--muted); margin-bottom: 4px; font-style: italic; }
  .gaia-ssh-result { font-size: 12px; color: var(--dim); font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; word-break: break-all; }
  .gaia-chat-messages {
    flex: 1; overflow-y: auto; padding: 16px 24px 24px;
    display: flex; flex-direction: column; gap: 24px;
    scrollbar-width: thin; scrollbar-color: rgba(120,216,122,0.2) transparent;
  }
  .gaia-chat-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: rgba(120,216,122,0.35); font-family: 'Cinzel', serif; font-size: 14px;
    letter-spacing: 0.12em; text-align: center; gap: 4px;
  }
  .gaia-chat-entry { display: flex; flex-direction: column; gap: 6px; }
  .gaia-chat-user-label {
    font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 0.2em;
    color: rgba(232,184,75,0.5); text-align: right; padding-right: 2px;
  }
  .gaia-chat-user-msg {
    background: rgba(232,184,75,0.07); border: 1px solid rgba(232,184,75,0.14);
    border-radius: 12px 12px 2px 12px; padding: 10px 14px; align-self: flex-end;
    max-width: 80%; font-size: 15px; color: rgba(255,255,255,0.82); line-height: 1.55;
  }
  .gaia-chat-gaia-label {
    font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 0.2em;
    color: rgba(120,216,122,0.55); padding-left: 2px;
  }
  .gaia-chat-gaia-msg {
    background: rgba(120,216,122,0.06); border: 1px solid rgba(120,216,122,0.14);
    border-radius: 2px 12px 12px 12px; padding: 10px 14px; align-self: flex-start;
    max-width: 86%; font-size: 15px; color: rgba(200,240,200,0.88); line-height: 1.65;
    box-shadow: 0 0 20px rgba(120,216,122,0.06);
  }
  .gaia-chat-thinking {
    display: flex; align-items: center; padding: 10px 14px;
    font-size: 14px; color: rgba(120,216,122,0.5); font-style: italic;
  }
  .gaia-thinking-dot {
    display: inline-block; width: 5px; height: 5px; border-radius: 50%;
    background: rgba(120,216,122,0.55); margin: 0 2px;
    animation: gaia-dot-pulse 1.4s ease-in-out infinite;
  }
  .gaia-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
  .gaia-thinking-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes gaia-dot-pulse {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
    40% { transform: scale(1.15); opacity: 1; }
  }

  /* ── Gaia sidebar ─────────────────────────────────────────────────── */
  .gaia-sidebar {
    width: 256px; flex-shrink: 0;
    background: rgba(3,9,4,0.92);
    border-right: 1px solid rgba(120,216,122,0.14);
    display: flex; flex-direction: column;
    overflow-y: auto;
    backdrop-filter: blur(10px);
    box-shadow: inset -1px 0 0 rgba(120,216,122,0.07), 1px 0 16px rgba(0,0,0,0.45);
  }
  .gaia-sidebar-section { padding: 14px 14px; border-bottom: 1px solid rgba(120,216,122,0.07); }
  .gaia-sidebar-label {
    font-size: 11px; letter-spacing: 0.22em; color: rgba(120,216,122,0.52);
    text-transform: uppercase; margin-bottom: 10px; font-family: 'Cinzel', serif;
  }
  .gaia-sidebar-tabs { display: flex; gap: 4px; margin-bottom: 10px; }
  .gaia-sidebar-tab {
    flex: 1; padding: 4px 0; font-size: 10px; font-family: 'Cinzel', serif;
    letter-spacing: 0.12em; border: 1px solid rgba(120,216,122,0.14); background: transparent;
    color: rgba(120,216,122,0.38); cursor: pointer; border-radius: 2px; text-align: center;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .gaia-sidebar-tab:hover:not(.active) { border-color: rgba(120,216,122,0.35); color: rgba(120,216,122,0.72); }
  .gaia-sidebar-tab.active { background: rgba(120,216,122,0.08); border-color: rgba(120,216,122,0.50); color: var(--gaia); }
  .gaia-conv-item {
    padding: 9px 10px; border-radius: 4px; border: 1px solid rgba(120,216,122,0.10);
    margin-bottom: 6px; background: rgba(5,15,6,0.65);
    transition: border-color 0.2s, background 0.2s;
  }
  .gaia-conv-item:hover { border-color: rgba(120,216,122,0.28); background: rgba(8,22,9,0.85); }
  .gaia-conv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; }
  .gaia-conv-badge { font-size: 12px; line-height: 1; filter: drop-shadow(0 0 4px rgba(120,216,122,0.5)); }
  .gaia-conv-user { font-size: 9.5px; font-family: 'Cinzel', serif; letter-spacing: 0.10em; color: var(--gaia); opacity: 0.75; }
  .gaia-conv-time { font-size: 10px; color: rgba(120,216,122,0.32); }
  .gaia-conv-text {
    font-size: 9.5px; color: rgba(175,210,175,0.82); line-height: 1.45;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px;
  }
  .gaia-conv-response {
    font-size: 8.5px; color: rgba(100,148,100,0.62); line-height: 1.42;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .gaia-conv-empty { font-size: 11px; color: rgba(120,216,122,0.24); line-height: 1.75; font-style: italic; padding: 6px 0; }
  .gaia-right-panel {
    width: 360px; flex-shrink: 0;
    background: rgba(3,9,4,0.95); border-left: 1px solid rgba(120,216,122,0.15);
    display: flex; flex-direction: column; overflow: hidden;
    animation: mode-enter 0.3s cubic-bezier(0.16,1,0.3,1) both;
  }
  .gaia-panel-header {
    padding: 14px 16px 10px; border-bottom: 1px solid rgba(120,216,122,0.10);
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .gaia-panel-title { font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 0.22em; color: var(--gaia); }
  .gaia-panel-subtitle { font-size: 10px; color: var(--muted); letter-spacing: 0.12em; margin-top: 3px; }
  .gaia-channel-tabs { display: flex; border-bottom: 1px solid rgba(120,216,122,0.08); flex-shrink: 0; }
  .gaia-panel-body { flex: 1; overflow-y: auto; padding: 12px 14px; }
  .olympus-msg { padding: 7px 0; border-bottom: 1px solid rgba(120,216,122,0.05); }
  .olympus-msg:last-child { border-bottom: none; }
  .olympus-msg.council-side { padding-left: 10px; border-left: 2px solid rgba(120,216,122,0.14); margin-left: 4px; }
  .gaia-canvas-center canvas { display: block; width: 100%; height: 100%; }

  /* ── Gaia below-tree feed ─────────────────────────────────────────── */
  .gaia-feed {
    height: 190px; flex-shrink: 0; border-top: 1px solid rgba(120,216,122,0.12);
    background: rgba(2,8,4,0.92); backdrop-filter: blur(8px);
    overflow-y: auto; display: flex; flex-direction: column;
  }
  .gaia-feed-tabs {
    display: flex; gap: 0; border-bottom: 1px solid rgba(120,216,122,0.1);
    flex-shrink: 0;
  }
  .gaia-feed-tab {
    flex: 1; padding: 6px 0; font-size: 9.5px; font-family: 'Cinzel', serif;
    letter-spacing: 0.14em; border: none; border-bottom: 2px solid transparent;
    background: transparent; color: var(--muted); cursor: pointer; text-align: center;
    transition: color 0.15s, border-color 0.15s;
  }
  .gaia-feed-tab:hover { color: var(--gaia); }
  .gaia-feed-tab.active { color: var(--gaia); border-bottom-color: var(--gaia); }
  .gaia-feed-body { flex: 1; overflow-y: auto; padding: 10px 14px; }
  .gaia-feed-empty { font-size: 11px; color: var(--dim); text-align: center; padding: 20px 0; font-family: 'Cinzel', serif; letter-spacing: 0.1em; }
  .gaia-feed-msg {
    padding: 8px 0; border-bottom: 1px solid rgba(120,216,122,0.06);
    display: flex; gap: 8px; align-items: flex-start;
  }
  .gaia-feed-msg:last-child { border-bottom: none; }
  .gaia-feed-speaker {
    font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 0.1em;
    min-width: 64px; padding-top: 1px; flex-shrink: 0;
  }
  .gaia-feed-speaker.gaia     { color: var(--gaia); }
  .gaia-feed-speaker.zeus     { color: var(--zeus); }
  .gaia-feed-speaker.poseidon { color: var(--poseidon); }
  .gaia-feed-speaker.hades    { color: var(--hades); }
  .gaia-feed-text { font-size: 11px; color: var(--text); line-height: 1.6; }
  .gaia-feed-meta { font-size: 10px; color: var(--dim); margin-top: 3px; }

  /* ── Fruit detail panel ───────────────────────────────────────────── */
  .fruit-panel {
    width: 340px; flex-shrink: 0;
    background: rgba(4,10,5,0.96); border-left: 1px solid rgba(120,216,122,0.18);
    display: flex; flex-direction: column; overflow: hidden;
    animation: mode-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .fruit-panel-header {
    padding: 16px 18px 12px; border-bottom: 1px solid rgba(120,216,122,0.12);
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .fruit-panel-symbol { font-size: 26px; filter: drop-shadow(0 0 12px currentColor); }
  .fruit-panel-name {
    font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 0.2em;
    margin-top: 2px;
  }
  .fruit-panel-domain { font-size: 10px; color: var(--muted); letter-spacing: 0.12em; margin-top: 3px; font-family: 'Cinzel', serif; }
  .fruit-panel-close {
    background: none; border: none; color: var(--muted); cursor: pointer;
    font-size: 16px; padding: 4px; transition: color 0.2s;
  }
  .fruit-panel-close:hover { color: var(--gaia); }
  .fruit-panel-body { flex: 1; overflow-y: auto; padding: 14px 18px; }
  .fruit-panel-section { margin-bottom: 18px; }
  .fruit-panel-label {
    font-size: 10px; letter-spacing: 0.2em; color: var(--muted);
    font-family: 'Cinzel', serif; text-transform: uppercase; margin-bottom: 8px;
  }
  .fruit-ripeness-bar {
    height: 5px; background: var(--bg3); border-radius: 3px;
    border: 1px solid var(--border); overflow: hidden; margin-bottom: 6px;
  }
  .fruit-ripeness-fill {
    height: 100%; border-radius: 3px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .fruit-ripeness-label { font-size: 11px; font-family: 'Cinzel', serif; letter-spacing: 0.12em; }
  .fruit-directive-item {
    padding: 8px 0; border-bottom: 1px solid rgba(120,216,122,0.06); font-size: 11px;
    line-height: 1.6; color: var(--text);
  }
  .fruit-directive-item:last-child { border-bottom: none; }
  .fruit-directive-ts { font-size: 10px; color: var(--dim); margin-bottom: 3px; }

  /* ── Queue UI ─────────────────────────────────────────────────────── */
  .queue-pos-badge {
    display: inline-flex; align-items: center; justify-content: center;
    font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 0.06em;
    color: var(--active); border: 1px solid rgba(240,192,96,0.4);
    background: rgba(240,192,96,0.07); border-radius: 3px; padding: 0 5px; min-width: 20px;
  }
  .req-cancel-btn {
    display: none; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0;
    background: rgba(255,60,60,0.1); border: 1px solid rgba(255,80,80,0.3);
    color: rgba(255,110,110,0.75); font-size: 11px; cursor: pointer;
    transition: all 0.15s; line-height: 1; padding: 0;
  }
  .req-item:hover .req-cancel-btn { display: flex; }
  .req-cancel-btn:hover { background: rgba(255,60,60,0.25); color: #ff6060; box-shadow: 0 0 6px rgba(255,60,60,0.18); }
  .req-status.cancelled { background: var(--muted); opacity: 0.35; }

  .priority-btn {
    padding: 4px 10px; border-radius: 3px; background: transparent;
    border: 1px solid var(--border); color: var(--muted);
    font-family: 'Cinzel', serif; font-size: 8.5px; letter-spacing: 0.08em;
    cursor: pointer; transition: all 0.25s;
  }
  .priority-btn.active {
    border-color: rgba(240,192,96,0.55); color: var(--active);
    background: rgba(240,192,96,0.08); box-shadow: 0 0 10px rgba(240,192,96,0.1);
  }
  .priority-btn:hover:not(.active) { border-color: var(--border2); color: var(--text); }

  .zeus-reorder-notif {
    padding: 8px 12px; margin-bottom: 8px; border-radius: 4px;
    background: rgba(232,184,75,0.05); border: 1px solid rgba(232,184,75,0.22);
    font-size: 11px; color: rgba(232,184,75,0.65); line-height: 1.55;
    animation: mode-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  /* ── Queue Panel redesign ─────────────────────────────────────── */
  .queue-slot-pills { display: flex; gap: 5px; margin-bottom: 10px; }
  .queue-slot-pill {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    padding: 6px 4px 5px; border-radius: 5px;
    border: 1px solid rgba(26,32,64,0.7); background: rgba(9,12,24,0.5);
    transition: all 0.35s;
  }
  .queue-slot-pill.t1.occupied { border-color: rgba(94,232,176,0.4); background: rgba(94,232,176,0.05); box-shadow: 0 0 10px rgba(94,232,176,0.08); }
  .queue-slot-pill.t2.occupied { border-color: rgba(240,192,96,0.4); background: rgba(240,192,96,0.05); box-shadow: 0 0 10px rgba(240,192,96,0.08); }
  .queue-slot-pill.t3.occupied { border-color: rgba(200,150,10,0.4); background: rgba(200,150,10,0.05); box-shadow: 0 0 10px rgba(200,150,10,0.08); }
  .queue-pill-label {
    font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 0.1em;
    color: var(--muted); margin-bottom: 2px; text-transform: uppercase;
  }
  .queue-slot-pill.occupied .queue-pill-label { color: var(--text); }
  .queue-pill-count { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--dim); }
  .queue-slot-pill.t1.occupied .queue-pill-count { color: var(--done); text-shadow: 0 0 8px rgba(94,232,176,0.5); }
  .queue-slot-pill.t2.occupied .queue-pill-count { color: var(--active); text-shadow: 0 0 8px rgba(240,192,96,0.5); }
  .queue-slot-pill.t3.occupied .queue-pill-count { color: var(--gold2); text-shadow: 0 0 8px rgba(200,150,10,0.5); }
  .queue-item {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 0; border-bottom: 1px solid rgba(26,32,64,0.4);
  }
  .queue-item:last-child { border-bottom: none; }
  .queue-item-run-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    background: #ff4040; box-shadow: 0 0 6px rgba(255,64,64,0.7);
    animation: pulse-dot 1s ease infinite;
  }
  .queue-item-pos {
    display: inline-flex; align-items: center; justify-content: center;
    font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 0.05em;
    color: var(--active); border: 1px solid rgba(240,192,96,0.4);
    background: rgba(240,192,96,0.06); border-radius: 2px;
    padding: 0 4px; min-width: 18px; flex-shrink: 0;
  }
  .queue-item-tier { font-family: 'Cinzel', serif; font-size: 11px; color: rgba(255,255,255,0.85); flex-shrink: 0; }
  .queue-item-user { font-family: 'Cinzel', serif; font-size: 11px; color: rgba(255,255,255,0.85); flex-shrink: 0; }
  .queue-item-text { font-size: 11px; color: var(--text); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .queue-item-wait { font-size: 9px; color: rgba(232,184,75,0.55); font-family: 'JetBrains Mono', monospace; flex-shrink: 0; letter-spacing: 0.04em; }
  .queue-item-cancel {
    opacity: 0; transition: opacity 0.15s;
    background: rgba(255,60,60,0.08); border: 1px solid rgba(255,80,80,0.25);
    color: rgba(255,110,110,0.7); font-size: 10px; cursor: pointer;
    border-radius: 2px; padding: 1px 4px; flex-shrink: 0; line-height: 1;
  }
  .queue-item:hover .queue-item-cancel { opacity: 1; }
  .queue-item-cancel:hover { background: rgba(255,60,60,0.2); color: #ff6060; }
  .queue-empty-line { font-size: 11px; color: var(--dim); text-align: center; padding: 8px 0; letter-spacing: 0.08em; }

  /* ── Gaia conversation cards ──────────────────────────────────── */
  .gaia-conv-card {
    padding: 8px 10px; border-radius: 4px; margin-bottom: 5px;
    border: 1px solid rgba(120,216,122,0.1); background: rgba(2,10,4,0.5);
    cursor: pointer; transition: all 0.2s;
  }
  .gaia-conv-card:hover { border-color: rgba(120,216,122,0.35); background: rgba(3,14,6,0.75); }
  .gaia-conv-card.active-conv { border-color: rgba(120,216,122,0.55); background: rgba(3,16,6,0.85); box-shadow: 0 0 10px rgba(120,216,122,0.08); }
  .gaia-conv-card-time { font-size: 10px; color: rgba(120,216,122,0.45); font-family: 'Cinzel', serif; letter-spacing: 0.06em; margin-bottom: 4px; }
  .gaia-conv-card.active-conv .gaia-conv-card-time { color: rgba(120,216,122,0.7); }
  .gaia-conv-card-preview { font-size: 11px; color: var(--text); line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gaia-conv-card-count { font-size: 10px; color: var(--muted); margin-top: 3px; }

  /* ── Gaia NEW CHAT button ─────────────────────────────────────────── */
  .gaia-new-chat-btn {
    background: transparent; border: 1px solid rgba(120,216,122,0.22);
    color: rgba(120,216,122,0.5); border-radius: 16px; padding: 4px 14px;
    font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.12em;
    cursor: pointer; transition: all 0.2s;
  }
  .gaia-new-chat-btn:hover { border-color: rgba(120,216,122,0.6); color: var(--gaia); }
`;

// ── Constants ──────────────────────────────────────────────────────────────────
const API_URL = `http://${window.location.hostname}:18780`;
const WS_URL  = `ws://${window.location.hostname}:18780/live`;

const NODE_HEALTH_TARGETS = {
  ZEUS:     "http://192.168.1.11:18789",
  POSEIDON: "http://192.168.1.12:18789",
  HADES:    "http://192.168.1.13:18789",
  GAIA:     "http://192.168.1.14:18789",
};

// Map sendTarget → UI mode (used when no mission is active)
function targetToMode(target) {
  const map = {
    ZEUS_PROTOCOL: "zeus_protocol",
    POSEIDON:      "poseidon",
    HADES:         "hades",
    GAIA:          "gaia",
  };
  return map[target] || "tier3";
}

// Map tier_classified tier string → uiMode
function tierToMode(tier) {
  if (tier === "TIER_1") return "tier1";
  if (tier === "TIER_2") return "tier2";
  return "tier3";
}

// Labels for mode badge in topbar
const MODE_BADGE_LABELS = {
  tier1:         "TIER I",
  tier2:         "TIER II",
  tier3:         "TIER III",
  zeus_protocol: "ZEUS PROTOCOL",
  poseidon:      "POSEIDON",
  hades:         "HADES",
  gaia:          "GAIA",
};

// ── VoteStamps ─────────────────────────────────────────────────────────────────
const STAMP_AGENTS = [
  { key: "zeus",     symbol: "⚡", name: "ZEUS",     cls: "zeus"     },
  { key: "poseidon", symbol: "🔱", name: "POSEIDON", cls: "poseidon" },
  { key: "hades",    symbol: "🏛",  name: "HADES",   cls: "hades"   },
];

function deriveVotes(messages) {
  const voted = { zeus: false, poseidon: false, hades: false };
  let unanimous = false;
  for (const msg of messages) {
    if (msg.vote === "approve") {
      voted.zeus = true; voted.poseidon = true; voted.hades = true;
      unanimous = true;
    } else if (
      msg.vote === "aye" ||
      msg.text?.includes("VOTE: AYE") ||
      msg.text?.includes("VOTE: APPROVE")
    ) {
      if (msg.speaker in voted) voted[msg.speaker] = true;
    }
  }
  if (voted.zeus && voted.poseidon && voted.hades) unanimous = true;
  return { voted, unanimous };
}

function VoteStamps({ messages, missionId }) {
  const { voted, unanimous } = deriveVotes(messages);
  return (
    <div className="stamp-section">
      <div className="stamp-row">
        {STAMP_AGENTS.map(agent => {
          const isVoted = voted[agent.key];
          return (
            <div key={`${missionId}-${agent.key}`}
              className={`stamp-box ${isVoted ? `stamp-voted stamp-voted-${agent.cls}` : ""}`}>
              <span className="stamp-icon">{agent.symbol}</span>
              <span className="stamp-label">{agent.name}</span>
              {isVoted && <span className="stamp-aye">AYE</span>}
            </div>
          );
        })}
      </div>
      {unanimous && (
        <div className="vote-unanimous" style={{ marginBottom: 0 }}>
          <div className="vote-unanimous-mark">⚡</div>
          <div>
            <div className="vote-unanimous-text">UNANIMOUS — APPROVED</div>
            <div className="vote-unanimous-sub">Zeus · Poseidon · Hades all in favor</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CouncilThread({ messages }) {
  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className="chat-message" style={{ animationDelay: `${i * 0.04}s` }}>
          <div className={`chat-avatar ${msg.speaker}`}>
            {msg.speaker === "zeus" ? "⚡" : msg.speaker === "poseidon" ? "🔱" : "🏛"}
          </div>
          <div className="chat-content">
            <div className={`chat-speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}</div>
            <div className="chat-text">{msg.text}</div>
            {msg.vote === "calling" && <div className="vote-badge calling">⚖ CALLING VOTE</div>}
            {msg.vote === "aye"     && <div className="vote-badge aye">✓ AYE</div>}
          </div>
        </div>
      ))}
      {messages.length === 0 && (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>Awaiting council...</div>
      )}
    </>
  );
}

// ── Council Triangle (idle/classifying state canvas) ──────────────────────────
function CouncilTriangle({ classifying = false }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 420, H = 420;
    canvas.width = W; canvas.height = H;

    const cx = W / 2, cy = H / 2 + 10;
    const R  = 155;
    const verts = [
      { angle: -Math.PI / 2,                          label: "⚡", color: "#e8b84b" },
      { angle: -Math.PI / 2 + 2 * Math.PI / 3,        label: "🔱", color: "#4ab8e8" },
      { angle: -Math.PI / 2 + 4 * Math.PI / 3,        label: "🏛",  color: "#b04adc" },
    ];

    const rotSpeed   = classifying ? 0.003  : 0.0012;
    const dotSpeed   = classifying ? 0.01   : 0.004;
    const pulseFreq  = classifying ? 300    : 900;
    const edgeAlpha  = classifying ? "aa"   : "55";
    const glowRadius = classifying ? 48     : 32;

    const dots = [
      { edge: 0, t: 0,    speed: dotSpeed },
      { edge: 1, t: 0.33, speed: dotSpeed },
      { edge: 2, t: 0.67, speed: dotSpeed },
    ];

    let rot = 0;
    let raf;
    const draw = (ts) => {
      ctx.clearRect(0, 0, W, H);
      rot += rotSpeed;

      const pts = verts.map((v, i) => ({
        x: cx + R * Math.cos(v.angle + rot),
        y: cy + R * Math.sin(v.angle + rot),
        color: v.color,
        label: v.label,
        pulse: 0.72 + 0.28 * Math.sin(ts / pulseFreq + i * 1.2),
      }));

      // Edges
      for (let i = 0; i < 3; i++) {
        const a = pts[i], b = pts[(i + 1) % 3];
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0,   a.color + edgeAlpha);
        grad.addColorStop(0.5, "#ffffff" + (classifying ? "44" : "22"));
        grad.addColorStop(1,   b.color + edgeAlpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = classifying ? 1.8 : 1.2;
        ctx.stroke();
      }

      // Traveling dots
      for (const dot of dots) {
        dot.t = (dot.t + dot.speed) % 1;
        const a = pts[dot.edge], b = pts[(dot.edge + 1) % 3];
        const dx = a.x + (b.x - a.x) * dot.t;
        const dy = a.y + (b.y - a.y) * dot.t;
        const col = a.color;
        const haloR = classifying ? 14 : 10;
        const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, haloR);
        g.addColorStop(0,   col + "dd");
        g.addColorStop(0.4, col + "55");
        g.addColorStop(1,   col + "00");
        ctx.beginPath();
        ctx.arc(dx, dy, haloR, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx, dy, classifying ? 3 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = classifying ? 10 : 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Vertex symbols
      for (const p of pts) {
        const sz = 22 + 4 * p.pulse;
        const g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
        g2.addColorStop(0,   p.color + (classifying ? "44" : "22"));
        g2.addColorStop(1,   p.color + "00");
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = g2;
        ctx.fill();
        ctx.font = `${sz}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.72 + 0.28 * p.pulse;
        ctx.fillText(p.label, p.x, p.y);
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="idle-triangle-wrap">
      <canvas ref={canvasRef} style={{ width: 420, height: 420, opacity: 0.9 }} />
      <div style={{
        fontFamily: "Cinzel, serif",
        fontSize: 11,
        letterSpacing: "0.25em",
        color: classifying ? "var(--gold2)" : "var(--muted)",
        marginTop: 16,
        textAlign: "center",
        transition: "color 0.4s",
      }}>
        {classifying ? "ZEUS IS CLASSIFYING . . ." : "B3C COUNCIL · PRESENT AND WAITING"}
      </div>
    </div>
  );
}

// ── Tree of Olympus ────────────────────────────────────────────────────────────
const FRUIT_DEFS = [
  { id: "gaia",     symbol: "🌿", label: "GAIA",     color: "#78d87a", forkT: 1.00 },
  { id: "zeus",     symbol: "⚡", label: "ZEUS",     color: "#e8b84b", forkT: 0.82 },
  { id: "sydney",   symbol: "✦",  label: "SYDNEY",   color: "#e88ab0", forkT: 0.87 },
  { id: "poseidon", symbol: "🔱", label: "POSEIDON", color: "#4ab8e8", forkT: 0.78 },
  { id: "hades",    symbol: "🏛",  label: "HADES",   color: "#b04adc", forkT: 0.58 },
  { id: "saxon",    symbol: "◈",  label: "SAXON",    color: "#e8a85a", forkT: 0.53 },
];

const DOMAIN_ORBS = [
  { label: "AUDIT",       color: "#4a8ce8", x: 0.16, y: 0.78 },
  { label: "NAS",         color: "#4ae87a", x: 0.33, y: 0.84 },
  { label: "SSH CTRL",    color: "#e8b84a", x: 0.65, y: 0.84 },
  { label: "GROWTH",      color: "#e84ab0", x: 0.82, y: 0.78 },
];

const FRUIT_INFO = {
  gaia:     { domain: "Memory · Retrospective",   desc: "The tree itself — keeper of memory, observer of growth." },
  zeus:     { domain: "Spiritual · Intellectual", desc: "Commands the intellectual domain — framing, synthesis, meaning." },
  poseidon: { domain: "Financial · Social",       desc: "Commands the social and economic currents of the council." },
  hades:    { domain: "Physical · Technical",     desc: "Governs technical and structural foundations." },
  saxon:    { domain: "Human · Saxon · Smith",    desc: "Tyler's son — second generation of the Smith family on Olympus." },
  sydney:   { domain: "Human · Sydney · Smith",   desc: "Tyler's daughter — voice and heart of the Smith family on Olympus." },
};

function bezierPoint(p0, cp1, cp2, p1, t) {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*p1.x,
    y: u*u*u*p0.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*p1.y,
  };
}

function bezierTangent(p0, cp1, cp2, p1, t) {
  const u = 1 - t;
  return {
    x: 3*u*u*(cp1.x-p0.x) + 6*u*t*(cp2.x-cp1.x) + 3*t*t*(p1.x-cp2.x),
    y: 3*u*u*(cp1.y-p0.y) + 6*u*t*(cp2.y-cp1.y) + 3*t*t*(p1.y-cp2.y),
  };
}

// Draw a tapered bezier strip (filled shape along a cubic bezier path)
function drawTapered(ctx, p0, cp1, cp2, p1, wStart, wEnd, fillStyle, alpha) {
  const N = 20;
  const L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const t   = i / N;
    const pt  = bezierPoint(p0, cp1, cp2, p1, t);
    const tan = bezierTangent(p0, cp1, cp2, p1, t);
    const tl  = Math.sqrt(tan.x*tan.x + tan.y*tan.y) || 1;
    const nx  = -tan.y / tl, ny = tan.x / tl;
    const w   = wStart + (wEnd - wStart) * t;
    L.push({ x: pt.x + nx*w, y: pt.y + ny*w });
    R.push({ x: pt.x - nx*w, y: pt.y - ny*w });
  }
  ctx.beginPath();
  ctx.moveTo(L[0].x, L[0].y);
  for (let i = 1; i <= N; i++) ctx.lineTo(L[i].x, L[i].y);
  for (let i = N; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.globalAlpha = alpha;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function getFruitPositions(W, H) {
  const gY = H * 0.60;
  const cx = W / 2;
  return {
    gaia:     { x: cx - W*0.01, y: H*0.065 },
    zeus:     { x: cx + W*0.18, y: H*0.17  },
    sydney:   { x: cx + W*0.11, y: H*0.10  },
    poseidon: { x: cx - W*0.19, y: H*0.17  },
    hades:    { x: cx + W*0.24, y: H*0.30  },
    saxon:    { x: cx - W*0.23, y: H*0.30  },
  };
}

function getTrunkPoints(W, H) {
  const gY = H * 0.60;
  const cx = W / 2;
  return {
    base: { x: cx,       y: gY + 20 },
    tip:  { x: cx + 8,   y: gY - H*0.47 },
  };
}

function getTrunkAt(W, H, t) {
  const { base, tip } = getTrunkPoints(W, H);
  return { x: base.x + (tip.x - base.x) * t, y: base.y + (tip.y - base.y) * t };
}

function getBranchPath(W, H, fruitId) {
  const fp   = getFruitPositions(W, H);
  const def  = FRUIT_DEFS.find(f => f.id === fruitId);
  const fork = getTrunkAt(W, H, def.forkT);
  const fruit = fp[fruitId];
  const dx = fruit.x - fork.x;
  const dy = fruit.y - fork.y;
  return {
    fork,
    fruit,
    cp1: { x: fork.x + dx * 0.38, y: fork.y + dy * 0.15 },
    cp2: { x: fruit.x - dx * 0.12, y: fruit.y + Math.abs(dy) * 0.28 },
  };
}

// Static stars (seeded from index for stability)
const TREE_STARS = Array.from({ length: 120 }, (_, i) => {
  const r = ((i * 2654435761) >>> 0) / 4294967296;
  const r2 = ((i * 1664525 + 1013904223) >>> 0) / 4294967296;
  const r3 = ((i * 22695477 + 1) >>> 0) / 4294967296;
  return { xf: r, yf: r2 * 0.62, radius: r3 * 1.1 + 0.2, a: r2 * 0.55 + 0.1 };
});

// Static leaves (positions relative to branch midpoints)
function lcg(seed) { return ((seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
const LEAF_DEFS = Array.from({ length: 28 }, (_, i) => {
  const r0 = lcg(i * 97 + 1);
  const r1 = lcg(i * 31 + 7);
  const r2 = lcg(i * 53 + 11);
  const r3 = lcg(i * 17 + 3);
  const fruits = ["gaia","zeus","sydney","poseidon"];
  return {
    fruitId: fruits[i % fruits.length],
    bt:      r1 * 0.7 + 0.1,
    offX:    (r2 - 0.5) * 38,
    offY:    (r3 - 0.5) * 22,
    rot:     r0 * Math.PI * 2,
    size:    r1 * 4 + 3,
    phase:   r2 * Math.PI * 2,
  };
});

function GaiaTree({ fruitRipeness, activePulses, selectedFruit, onFruitClick, sshCtrlPulse }) {
  const canvasRef    = useRef(null);
  const stateRef     = useRef({ fruitRipeness, activePulses, selectedFruit, sshCtrlPulse });
  const mouseRef     = useRef({ x: -1, y: -1 });

  useEffect(() => { stateRef.current = { fruitRipeness, activePulses, selectedFruit, sshCtrlPulse }; });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let W = 0, H = 0;
    const resize = () => {
      const parent = canvas.parentElement;
      W = canvas.width  = parent.clientWidth;
      H = canvas.height = parent.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const ctx = canvas.getContext("2d");
    const startTime = Date.now();

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onClickHandler = (e) => {
      if (!W || !H) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const fp = getFruitPositions(W, H);
      for (const def of FRUIT_DEFS) {
        const pos = fp[def.id];
        const dx = mx - pos.x, dy = my - pos.y;
        if (Math.sqrt(dx*dx + dy*dy) < 28) {
          onFruitClick(stateRef.current.selectedFruit === def.id ? null : def.id);
          return;
        }
      }
      onFruitClick(null);
    };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClickHandler);

    let raf;
    const draw = () => {
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }
      const { fruitRipeness, activePulses, selectedFruit, sshCtrlPulse } = stateRef.current;
      const sshActive = sshCtrlPulse && (Date.now() - sshCtrlPulse) < 4000;
      const { x: mx, y: my } = mouseRef.current;
      const now    = Date.now();
      const tSec   = (now - startTime) / 1000;
      const gY     = H * 0.60;
      const cx     = W / 2;
      const breath = Math.sin(tSec * 0.38) * 0.5 + 0.5;

      ctx.clearRect(0, 0, W, H);

      // ── Sky gradient (deep cosmic) ────────────────────────────────
      const skyGrad = ctx.createLinearGradient(0, 0, 0, gY);
      skyGrad.addColorStop(0,   "rgba(0,1,6,0.92)");
      skyGrad.addColorStop(0.4, "rgba(1,4,14,0.78)");
      skyGrad.addColorStop(0.8, "rgba(2,7,18,0.58)");
      skyGrad.addColorStop(1,   "rgba(3,9,16,0.30)");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, gY);

      // Nebula wisps around tree crown
      const nb1 = ctx.createRadialGradient(cx, gY * 0.28, 0, cx, gY * 0.28, W * 0.38);
      nb1.addColorStop(0,   `rgba(15,55,18,${0.08 + breath * 0.04})`);
      nb1.addColorStop(0.5, `rgba(6,28,12,0.03)`);
      nb1.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = nb1; ctx.fillRect(0, 0, W, gY);
      const nb2 = ctx.createRadialGradient(cx - W*0.12, gY * 0.45, 0, cx - W*0.12, gY * 0.45, W * 0.22);
      nb2.addColorStop(0,   `rgba(8,30,50,${0.05 + breath * 0.02})`);
      nb2.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = nb2; ctx.fillRect(0, 0, W, gY);

      // ── Stars ────────────────────────────────────────────────────
      for (const s of TREE_STARS) {
        const sx = s.xf * W, sy = s.yf * gY;
        const p  = s.a + 0.10 * Math.sin(tSec * 0.65 + s.xf * 9.42);
        const sr = s.radius * (0.88 + 0.22 * Math.sin(tSec * 1.3 + s.xf * 6.28));
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${Math.max(0, Math.min(0.9, p)).toFixed(2)})`;
        ctx.fill();
        if (s.a > 0.45 && sr > 0.9) {
          ctx.strokeStyle = `rgba(200,220,255,${(p * 0.4).toFixed(2)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(sx - sr*2.8, sy); ctx.lineTo(sx + sr*2.8, sy); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx, sy - sr*2.8); ctx.lineTo(sx, sy + sr*2.8); ctx.stroke();
        }
      }

      // ── Earth ─────────────────────────────────────────────────────
      const earthGrad = ctx.createLinearGradient(0, gY, 0, H);
      earthGrad.addColorStop(0,   "#100d07");
      earthGrad.addColorStop(0.3, "#0b0905");
      earthGrad.addColorStop(1,   "#050402");
      ctx.fillStyle = earthGrad;
      ctx.fillRect(0, gY, W, H - gY);

      // Bioluminescent earth upwelling
      const eu = ctx.createRadialGradient(cx, gY, 0, cx, gY, W * 0.58);
      eu.addColorStop(0,   `rgba(38,90,22,${0.24 + breath * 0.09})`);
      eu.addColorStop(0.2, `rgba(22,55,12,0.10)`);
      eu.addColorStop(0.5, "rgba(8,20,4,0.04)");
      eu.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = eu; ctx.fillRect(0, gY - H*0.18, W, H*0.28);

      // Ground line glow
      const glGrad = ctx.createLinearGradient(cx - W*0.44, 0, cx + W*0.44, 0);
      glGrad.addColorStop(0,   "rgba(55,45,18,0)");
      glGrad.addColorStop(0.2, "rgba(95,80,28,0.42)");
      glGrad.addColorStop(0.5, "rgba(128,105,35,0.68)");
      glGrad.addColorStop(0.8, "rgba(95,80,28,0.42)");
      glGrad.addColorStop(1,   "rgba(55,45,18,0)");
      ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(W, gY);
      ctx.strokeStyle = glGrad; ctx.lineWidth = 1.5; ctx.stroke();

      // ── Roots (tapered filled bezier strips) ──────────────────────
      const ROOT_DEFS = [
        { cpx: cx - W*0.22, cpy: gY + H*0.19, ex: cx - W*0.36, ey: gY + H*0.28, w: 5.5 },
        { cpx: cx - W*0.10, cpy: gY + H*0.21, ex: cx - W*0.14, ey: gY + H*0.32, w: 4.0 },
        { cpx: cx + W*0.10, cpy: gY + H*0.21, ex: cx + W*0.14, ey: gY + H*0.32, w: 4.0 },
        { cpx: cx + W*0.22, cpy: gY + H*0.19, ex: cx + W*0.36, ey: gY + H*0.28, w: 5.5 },
        { cpx: cx - W*0.13, cpy: gY + H*0.11, ex: cx - W*0.26, ey: gY + H*0.15, w: 3.0 },
        { cpx: cx + W*0.13, cpy: gY + H*0.11, ex: cx + W*0.26, ey: gY + H*0.15, w: 3.0 },
      ];
      const rStart = { x: cx, y: gY + 14 };
      for (let ri = 0; ri < ROOT_DEFS.length; ri++) {
        const rp = ROOT_DEFS[ri];
        const cp = { x: rp.cpx, y: rp.cpy }, ep = { x: rp.ex, y: rp.ey };
        const rAlpha = 0.52 + breath * 0.12;
        drawTapered(ctx, rStart, cp, cp, ep, rp.w, 0.7, `rgba(52,40,20,${rAlpha})`, 1);
        // Sap glow pulse
        const pFrac = (tSec * 0.42 + ri * 0.17) % 1;
        const rpPt = bezierPoint(rStart, cp, cp, ep, pFrac);
        const rg = ctx.createRadialGradient(rpPt.x, rpPt.y, 0, rpPt.x, rpPt.y, 8);
        rg.addColorStop(0,  `rgba(90,220,100,${0.22 + breath * 0.10})`);
        rg.addColorStop(1,  "rgba(90,220,100,0)");
        ctx.beginPath(); ctx.arc(rpPt.x, rpPt.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = rg; ctx.fill();
      }

      // ── Domain orbs at root tips (3 radial gradient layers) ──────
      for (let oi = 0; oi < DOMAIN_ORBS.length; oi++) {
        const orb        = DOMAIN_ORBS[oi];
        const isSshCtrl  = orb.label === "SSH CTRL";
        const orbActive  = isSshCtrl && sshActive;
        const ox = orb.x * W, oy = orb.y * H;
        const p  = orbActive
          ? 0.9 + 0.1 * Math.sin(tSec * 6)   // rapid strong pulse during SSH
          : 0.5 + 0.3 * Math.sin(tSec * 0.9 + oi * 1.3);
        const haloR = orbActive ? 44 : 24;
        // Halo
        const oh = ctx.createRadialGradient(ox, oy, 0, ox, oy, haloR);
        oh.addColorStop(0, orb.color + (orbActive ? "55" : "28")); oh.addColorStop(1, orb.color + "00");
        ctx.beginPath(); ctx.arc(ox, oy, haloR, 0, Math.PI*2); ctx.fillStyle = oh; ctx.fill();
        // Extra outer ring when SSH is active
        if (orbActive) {
          const age   = (Date.now() - sshCtrlPulse) / 4000;
          const ringR = 14 + age * 40;
          const ringA = (1 - age) * 0.7;
          ctx.beginPath(); ctx.arc(ox, oy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = orb.color + Math.floor(ringA * 255).toString(16).padStart(2, "0");
          ctx.lineWidth = 1.5; ctx.stroke();
        }
        // Mid glow
        const om = ctx.createRadialGradient(ox, oy, 0, ox, oy, 9);
        om.addColorStop(0, orb.color + "aa"); om.addColorStop(1, orb.color + "00");
        ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI*2); ctx.fillStyle = om; ctx.fill();
        // Core + specular
        const oc = ctx.createRadialGradient(ox - 1.5, oy - 1.5, 0, ox, oy, 5.5);
        oc.addColorStop(0,   "#ffffffbb"); oc.addColorStop(0.25, orb.color + "ff");
        oc.addColorStop(1,   orb.color + "88");
        ctx.beginPath(); ctx.arc(ox, oy, 5.5, 0, Math.PI*2);
        ctx.fillStyle = oc; ctx.shadowColor = orb.color; ctx.shadowBlur = 14 * p;
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = "7px 'Cinzel', serif";
        ctx.fillStyle = `rgba(175,195,175,${0.42 + p * 0.32})`;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(orb.label, ox, oy + 11);
      }

      // ── Trunk (filled tapered shape + bark texture) ───────────────
      const { base, tip } = getTrunkPoints(W, H);
      const tA = 0.84 + breath * 0.10;
      const tGrad = ctx.createLinearGradient(base.x - 20, 0, base.x + 20, 0);
      tGrad.addColorStop(0,    `rgba(22,17,9,${tA})`);
      tGrad.addColorStop(0.30, `rgba(58,46,24,${tA})`);
      tGrad.addColorStop(0.55, `rgba(52,42,22,${tA})`);
      tGrad.addColorStop(0.80, `rgba(38,30,15,${tA})`);
      tGrad.addColorStop(1,    `rgba(22,17,9,${tA})`);
      ctx.beginPath();
      ctx.moveTo(base.x - 20, base.y);
      ctx.bezierCurveTo(base.x - 15, base.y - (base.y-tip.y)*0.38, tip.x - 7, tip.y + (base.y-tip.y)*0.42, tip.x - 5, tip.y);
      ctx.lineTo(tip.x + 5, tip.y);
      ctx.bezierCurveTo(tip.x + 7, tip.y + (base.y-tip.y)*0.42, base.x + 15, base.y - (base.y-tip.y)*0.38, base.x + 20, base.y);
      ctx.closePath();
      ctx.fillStyle = tGrad; ctx.fill();
      // Bark grain highlights
      ctx.lineCap = "round";
      for (let bi = 0; bi < 4; bi++) {
        const bt = 0.15 + bi * 0.22;
        const tp = getTrunkAt(W, H, bt);
        const wo = (bi % 2 === 0 ? -1 : 1) * (3 + bi * 1.5);
        ctx.beginPath();
        ctx.moveTo(tp.x + wo, tp.y - 10);
        ctx.quadraticCurveTo(tp.x + wo + 3, tp.y, tp.x + wo - 1, tp.y + 10);
        ctx.strokeStyle = `rgba(78,62,30,${0.18 + breath * 0.04})`; ctx.lineWidth = 0.8; ctx.stroke();
      }
      // Bioluminescent sap line
      ctx.beginPath();
      ctx.moveTo(base.x - 2, base.y);
      ctx.bezierCurveTo(base.x - 1, base.y - (base.y-tip.y)*0.5, tip.x, tip.y + (base.y-tip.y)*0.5, tip.x, tip.y);
      ctx.strokeStyle = `rgba(80,210,100,${0.05 + breath * 0.055})`; ctx.lineWidth = 2.5; ctx.stroke();

      // ── Branches (tapered filled shapes + bioluminescent glow) ───
      const FP = getFruitPositions(W, H);
      for (const def of FRUIT_DEFS) {
        const bp  = getBranchPath(W, H, def.id);
        const rip = fruitRipeness[def.id] || 0;
        const bA  = 0.52 + Math.min(rip / 8, 0.34) + breath * 0.06;
        const w0  = def.id === "gaia" ? 5.5 : (def.id === "zeus" || def.id === "poseidon") ? 3.8 : 2.6;
        drawTapered(ctx, bp.fork, bp.cp1, bp.cp2, bp.fruit, w0, 0.8, `rgba(46,36,18,${bA})`, 1);
        // Glow overlay
        ctx.beginPath();
        ctx.moveTo(bp.fork.x, bp.fork.y);
        ctx.bezierCurveTo(bp.cp1.x, bp.cp1.y, bp.cp2.x, bp.cp2.y, bp.fruit.x, bp.fruit.y);
        const glowA = (0.055 + breath * 0.042) * (1 + Math.min(rip / 6, 0.8));
        ctx.strokeStyle = def.color + Math.floor(Math.min(glowA, 1) * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = 1.4; ctx.stroke();
      }

      // ── Leaves (with shimmer edge) ────────────────────────────────
      for (const leaf of LEAF_DEFS) {
        const bp  = getBranchPath(W, H, leaf.fruitId);
        const pt  = bezierPoint(bp.fork, bp.cp1, bp.cp2, bp.fruit, leaf.bt);
        const lx  = pt.x + leaf.offX, ly = pt.y + leaf.offY;
        const sw  = Math.sin(tSec * 0.55 + leaf.phase) * 0.045;
        const la  = 0.28 + breath * 0.20;
        ctx.save();
        ctx.translate(lx, ly); ctx.rotate(leaf.rot + sw); ctx.scale(1 + sw * 2, 1);
        ctx.beginPath(); ctx.ellipse(0, 0, leaf.size, leaf.size * 0.44, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22,68,22,${la})`; ctx.fill();
        // Shimmer edge
        ctx.strokeStyle = `rgba(75,200,85,${la * 0.38})`; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.restore();
      }

      // ── Active pulses (directive / response travelling branch) ────
      const PULSE_DUR = 1800;
      for (const pulse of activePulses) {
        const elapsed = now - pulse.start;
        if (elapsed > PULSE_DUR) continue;
        const bp    = getBranchPath(W, H, pulse.target);
        const pct   = elapsed / PULSE_DUR;
        const tVal  = pulse.phase === "up" ? pct : 1 - pct;
        const pt    = bezierPoint(bp.fork, bp.cp1, bp.cp2, bp.fruit, tVal);
        const def   = FRUIT_DEFS.find(f => f.id === pulse.target);
        const pA    = Math.sin(pct * Math.PI);
        const pg    = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 18);
        pg.addColorStop(0,   def.color + "ff"); pg.addColorStop(0.3, def.color + "88"); pg.addColorStop(1, def.color + "00");
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = pg; ctx.globalAlpha = pA; ctx.fill();
        // Bright core
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = def.color; ctx.shadowBlur = 22;
        ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }

      // ── Fruits (4 layers: halo + diffuse + core + specular) ───────
      for (const def of FRUIT_DEFS) {
        const fp    = FP[def.id];
        const rip   = fruitRipeness[def.id] || 0;
        const isHov = Math.sqrt((mx - fp.x)**2 + (my - fp.y)**2) < 28;
        const isSel = selectedFruit === def.id;
        const rf    = Math.min(rip / 12, 1);
        const orbR  = 11 + rf * 5.5 + (isSel ? 4.5 : 0) + (isHov ? 2 : 0);
        const pulse = 0.84 + 0.16 * Math.sin(tSec * 1.15 + FRUIT_DEFS.indexOf(def) * 0.91);

        // Layer 1: Outer halo
        const hR = orbR * 3.8 + (isHov ? 12 : 0);
        const f1 = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, hR);
        f1.addColorStop(0,   def.color + Math.floor(0.13 * pulse * 255).toString(16).padStart(2,"0"));
        f1.addColorStop(0.4, def.color + "14"); f1.addColorStop(1, def.color + "00");
        ctx.beginPath(); ctx.arc(fp.x, fp.y, hR, 0, Math.PI*2); ctx.fillStyle = f1; ctx.fill();

        // Layer 2: Mid diffuse glow
        const dR = orbR * 1.8;
        const f2 = ctx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, dR);
        f2.addColorStop(0,   def.color + Math.floor((0.48 + rf * 0.35) * pulse * 255).toString(16).padStart(2,"0"));
        f2.addColorStop(0.5, def.color + "44"); f2.addColorStop(1, def.color + "00");
        ctx.beginPath(); ctx.arc(fp.x, fp.y, dR, 0, Math.PI*2); ctx.fillStyle = f2; ctx.fill();

        // Layer 3: Core body (radial gradient from upper-left)
        const f3 = ctx.createRadialGradient(fp.x - orbR*0.30, fp.y - orbR*0.30, orbR*0.05, fp.x, fp.y, orbR);
        f3.addColorStop(0,    "#ffffff" + Math.floor(0.65 * 255).toString(16).padStart(2,"0"));
        f3.addColorStop(0.15, def.color + "ff");
        f3.addColorStop(0.65, def.color + "cc");
        f3.addColorStop(1,    def.color + "88");
        ctx.beginPath(); ctx.arc(fp.x, fp.y, orbR, 0, Math.PI*2);
        ctx.fillStyle = f3; ctx.shadowColor = def.color; ctx.shadowBlur = 22 + rf * 18;
        ctx.fill(); ctx.shadowBlur = 0;

        // Layer 4: Specular highlight
        const sx = fp.x - orbR * 0.33, sy = fp.y - orbR * 0.33;
        const f4 = ctx.createRadialGradient(sx, sy, 0, sx, sy, orbR * 0.44);
        f4.addColorStop(0, "rgba(255,255,255,0.72)"); f4.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath(); ctx.arc(sx, sy, orbR * 0.44, 0, Math.PI*2); ctx.fillStyle = f4; ctx.fill();

        // Selection rings
        if (isSel) {
          ctx.beginPath(); ctx.arc(fp.x, fp.y, orbR + 7, 0, Math.PI*2);
          ctx.strokeStyle = def.color + "cc"; ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(fp.x, fp.y, orbR + 14, 0, Math.PI*2);
          ctx.strokeStyle = def.color + "44"; ctx.lineWidth = 1.0;
          ctx.setLineDash([2, 6]); ctx.stroke(); ctx.setLineDash([]);
        }

        // Symbol
        const symSize = Math.round(orbR * 1.08);
        ctx.font = `${symSize}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.85; ctx.fillStyle = "#000000";
        ctx.fillText(def.symbol, fp.x + 0.5, fp.y + 0.5);
        ctx.globalAlpha = 1; ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillText(def.symbol, fp.x, fp.y);

        // Label
        ctx.font = "8px 'Cinzel', serif"; ctx.textBaseline = "top";
        ctx.fillStyle = `rgba(215,230,215,${0.62 + rf * 0.32 + (isHov ? 0.18 : 0)})`;
        ctx.fillText(def.label, fp.x, fp.y + orbR + 9);
      }

      // ── Cursor ────────────────────────────────────────────────────
      const fpC = getFruitPositions(W, H);
      let hovering = false;
      for (const def of FRUIT_DEFS) {
        if (Math.sqrt((mx - fpC[def.id].x)**2 + (my - fpC[def.id].y)**2) < 28) { hovering = true; break; }
      }
      canvas.style.cursor = hovering ? "pointer" : "default";

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClickHandler);
      ro.disconnect();
    };
  }, [onFruitClick]); // eslint-disable-line

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />;
}

// ── Fruit detail panel content ─────────────────────────────────────────────────
function FruitDetailContent({ fruitId, ripeness, growthHistory }) {
  const info   = FRUIT_INFO[fruitId] || {};
  const def    = FRUIT_DEFS.find(f => f.id === fruitId) || {};
  const level  = ripeness || 0;
  const label  = level === 0 ? "Seed" : level < 3 ? "Sprouting" : level < 7 ? "Growing" : level < 12 ? "Ripening" : "Flourishing";
  const pct    = Math.min(100, (level / 15) * 100);

  return (
    <>
      <div className="fruit-panel-section">
        <div className="fruit-panel-label">Ripeness</div>
        <div className="fruit-ripeness-bar">
          <div className="fruit-ripeness-fill" style={{ width: `${pct}%`, background: def.color, boxShadow: `0 0 8px ${def.color}80` }} />
        </div>
        <div className="fruit-ripeness-label" style={{ color: def.color }}>{label} · Level {level}</div>
      </div>
      <div className="fruit-panel-section">
        <div className="fruit-panel-label">Domain</div>
        <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.7 }}>{info.domain}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7, marginTop: 5 }}>{info.desc}</div>
      </div>
      <div className="fruit-panel-section">
        <div className="fruit-panel-label">Growth Directives {growthHistory.length > 0 ? `(${growthHistory.length})` : ""}</div>
        {growthHistory.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.7 }}>No directives issued yet. Gaia is watching.</div>
        )}
        {growthHistory.slice(-6).reverse().map((g, i) => (
          <div key={i} className="fruit-directive-item">
            <div className="fruit-directive-ts">{new Date(g.timestamp).toLocaleString()}</div>
            {g.directive}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OlympusDashboard() {
  // ── Mission state ──────────────────────────────────────────────────────────
  const [missions, setMissions]         = useState({});
  const [activeMissionId, setActiveMissionId] = useState(null);
  const savedMissionIds = useRef(new Set());

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState(null);
  const [wsStatus, setWsStatus]         = useState("connecting");
  const [time, setTime]                 = useState(new Date().toLocaleTimeString());
  const [gaiaReport, setGaiaReport]     = useState(null);
  const [nodeHealth, setNodeHealth]     = useState({ ZEUS: null, POSEIDON: null, HADES: null, GAIA: null });
  const [sendText, setSendText]         = useState("");
  const [sendTarget, setSendTarget]     = useState("B3C_COUNCIL");
  const [sending, setSending]           = useState(false);
  const [sidebarTab, setSidebarTab]     = useState("ALL");
  const [gaiaMessages, setGaiaMessages] = useState([]);
  const [gaiaTab, setGaiaTab]           = useState("ALL");
  const [activeUser, setActiveUser]     = useState(null); // "CARSON" | "TYLER" | null

  // ── Gaia standalone system state ───────────────────────────────────────────
  const [gaiaMode, setGaiaMode]               = useState(false);
  const [gaiaViewMode, setGaiaViewMode]       = useState("chat"); // "tree" | "chat" | "council"
  const [gaiaThinking, setGaiaThinking]       = useState(false);
  const [gaiaCouncilSending, setGaiaCouncilSending] = useState(false);
  const [sshCtrlPulse, setSshCtrlPulse]       = useState(null); // timestamp of last SSH action
  const [gaiaSSHLog, setGaiaSSHLog]           = useState([]);   // intervention log entries
  const [gaiaPendingText, setGaiaPendingText] = useState("");
  const [fruitRipeness, setFruitRipeness]     = useState({ zeus: 0, poseidon: 0, hades: 0, gaia: 0, saxon: 0, sydney: 0 });
  const [selectedFruit, setSelectedFruit]     = useState(null);
  const [gaiaDirectiveFeed, setGaiaDirectiveFeed] = useState([]);
  const [gaiaGrowthHistory, setGaiaGrowthHistory] = useState({});
  const [gaiaRetrospectives, setGaiaRetrospectives] = useState([]);
  const [activePulses, setActivePulses]       = useState([]);
  const [gaiaFeedTab, setGaiaFeedTab]         = useState("DIRECTIVES");
  const prevGaiaStateRef = useRef(null);
  const gaiaChatRef      = useRef(null);

  // ── Top-level view state ──────────────────────────────────────────────────
  const [topView, setTopView]               = useState("council"); // "council" | "olympus" | "record"
  const [nodeHealthOpen, setNodeHealthOpen] = useState(false);
  const nodeHealthRef = useRef(null);

  // ── Queue state ───────────────────────────────────────────────────────────
  const [queueState,         setQueueState]         = useState([]);   // full queue_update list
  const [zeusReorderNotif,   setZeusReorderNotif]   = useState(null); // { reason, ts }
  const [sendPriority,       setSendPriority]       = useState(false);
  const [routeOpen,          setRouteOpen]          = useState(false);
  const [expandedPrompts,   setExpandedPrompts]   = useState(new Set());
  const [expandedQueueItems, setExpandedQueueItems] = useState(new Set());
  const [cinematicOpen, setCinematicOpen] = useState(false);
  const cinematicCouncilRef = useRef(null);

  // ── LLM-powered mission titles (cached) ────────────────────────────────────
  const [missionTitles, setMissionTitles] = useState({});
  const titleFetchQueue = useRef(new Set());

  // ── Gaia conversation state ───────────────────────────────────────────────
  // Each conversation: { id, userId, timestamp, messages: [{role, text, timestamp}] }
  const [gaiaConversations,  setGaiaConversations]  = useState({});
  const [activeGaiaConvId,   setActiveGaiaConvId]   = useState(null);
  const activeGaiaConvIdRef  = useRef(null);  // ref for WS handler closure
  const savedGaiaConvIds     = useRef(new Set()); // "convId:msgCount" seen set

  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const isReplayingRef  = useRef(true);  // suppress auto-select during WS replay
  const backoffRef     = useRef(1000);   // exponential reconnect delay (ms)
  const queueStateRef  = useRef([]);     // stable ref for beforeunload handler

  // ── Derived active mission + mode ──────────────────────────────────────────
  const activeMission          = missions[activeMissionId] ?? null;
  const mode                   = activeMission?.uiMode ?? targetToMode(sendTarget);
  const stage                  = activeMission?.stage ?? "idle";
  const councilMessages        = activeMission?.councilMessages ?? [];
  const councilBackendMessages = activeMission?.councilBackendMessages ?? [];
  const progress               = activeMission?.progress ?? { zeus: 0, poseidon: 0, hades: 0 };
  const nodeThoughts           = activeMission?.nodeThoughts ?? {};
  const nodeTasks              = activeMission?.nodeTasks ?? {};
  const runStats               = activeMission?.runStats ?? null;
  const outputText             = activeMission?.output ?? null;
  const nodeStatus             = activeMission?.nodeStatus ?? {};
  const stageTimes             = activeMission?.stageTimes ?? {};
  const zeusDiagnostic         = activeMission?.zeusDiagnostic ?? null;
  // Returns the execution-phase status entry for a given agent key
  const getExecStatus = (agent) => nodeStatus[`${agent}:execution`] ?? null;
  // Returns elapsed seconds for a working execution agent (updates via 1s clock re-render)
  const execElapsed = (agent) => {
    const s = getExecStatus(agent);
    return (s?.status === "working") ? Math.floor((Date.now() - s.startedAt) / 1000) : null;
  };
  // Seconds elapsed in current pipeline stage
  const phaseElapsed = stageTimes[stage] ? Math.floor((Date.now() - stageTimes[stage]) / 1000) : null;
  const activeRequest          = activeMission
    ? { id: activeMission.id, text: activeMission.text, channel: activeMission.channel }
    : null;

  // Keep refs in sync with state (for WS handler closures and beforeunload)
  activeGaiaConvIdRef.current = activeGaiaConvId;
  queueStateRef.current       = queueState;

  // When gaiaMode is active, override all other mode styling/routing
  const effectiveMode = gaiaMode ? "gaia" : mode;


  // ── Cinematic takeover lifecycle ─────────────────────────────────────────────
  const isCinematicTier = mode === "tier2" || mode === "tier3";

  // Auto-open when a T2/T3 mission activates
  useEffect(() => {
    if (activeMission?.status === "active" && isCinematicTier) {
      setCinematicOpen(true);
    }
  }, [activeMissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close when mission clears, mode leaves T2/T3, or view switches away from council
  useEffect(() => {
    if (!cinematicOpen) return;
    if (!activeMission || !isCinematicTier || topView !== "council") {
      setCinematicOpen(false);
    }
  }, [activeMission, isCinematicTier, topView, cinematicOpen]);

  // Auto-close 3s after mission completes
  useEffect(() => {
    if (!cinematicOpen || stage !== "done") return;
    const t = setTimeout(() => setCinematicOpen(false), 3000);
    return () => clearTimeout(t);
  }, [cinematicOpen, stage]);

  // ESC to close
  useEffect(() => {
    if (!cinematicOpen) return;
    const handler = (e) => { if (e.key === "Escape") setCinematicOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cinematicOpen]);

  // Auto-scroll council right panel
  useEffect(() => {
    if (!cinematicOpen || !cinematicCouncilRef.current) return;
    cinematicCouncilRef.current.scrollTop = cinematicCouncilRef.current.scrollHeight;
  }, [cinematicOpen, councilMessages.length, councilBackendMessages.length]);

  // ── Clock ──────────────────────────────────────────────────────────────────
  
  // ── Fetch LLM titles for missions/queue items ─────────────────────────────
  const getMissionTitle = useCallback((id, text) => {
    if (missionTitles[id] || titleFetchQueue.current.has(id)) return missionTitles[id] || smartNameFallback(text);
    titleFetchQueue.current.add(id);
    fetch(API_URL + "/api/name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.title) {
          setMissionTitles(prev => ({ ...prev, [id]: data.title }));
        }
        titleFetchQueue.current.delete(id);
      })
      .catch(() => { titleFetchQueue.current.delete(id); });
    return smartNameFallback(text);
  }, [missionTitles]);

useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Pulse cleanup (remove finished animations after 3.5s) ─────────────────
  useEffect(() => {
    if (activePulses.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setActivePulses(prev => prev.filter(p => now - p.start < 3500));
    }, 3600);
    return () => clearTimeout(timer);
  }, [activePulses]);

  // ── Rehydrate all Gaia state (called on mount + every WS reconnect) ──────────
  const rehydrateGaia = useCallback(async () => {
    try {
      const [convsRes, councilRes, retrosRes] = await Promise.all([
        fetch(`${API_URL}/gaia/conversations`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/gaia/council`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/gaia/retrospectives`).then(r => r.ok ? r.json() : []),
      ]);

      // ── Conversations → gaiaConversations + activeGaiaConvId + gaiaMessages ──
      const convMap = {};
      let latestTs = 0;
      let latestId = null;
      for (const c of convsRes) {
        convMap[c.id] = c;
        savedGaiaConvIds.current.add(`${c.id}:${(c.messages || []).length}`);
        // Track most-recently-updated conversation
        const msgs = c.messages ?? [];
        const lastTs = msgs.length ? new Date(msgs[msgs.length - 1].timestamp || 0).getTime() : 0;
        if (lastTs > latestTs) { latestTs = lastTs; latestId = c.id; }
      }
      setGaiaConversations(convMap);
      if (latestId) {
        setActiveGaiaConvId(latestId);
        activeGaiaConvIdRef.current = latestId;
      }

      // Reconstruct gaiaMessages (right-panel feed) from all conversation pairs
      const msgs = [];
      for (const conv of Object.values(convMap)) {
        const convMsgs = conv.messages ?? [];
        const userLabel = conv.userId === '8150818650' ? 'Carson'
                        : conv.userId === '874345067'  ? 'Tyler' : 'Dashboard';
        for (let i = 0; i < convMsgs.length - 1; i++) {
          const u = convMsgs[i], a = convMsgs[i + 1];
          if (u.role === 'user' && a.role === 'assistant') {
            msgs.push({ text: u.text, response: a.text, userId: conv.userId ?? null,
              channel: `Gaia · ${userLabel}`, timestamp: u.timestamp });
          }
        }
      }
      msgs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setGaiaMessages(msgs);

      // ── Council log → gaiaDirectiveFeed ──────────────────────────────────────
      const feed = [];
      for (const entry of councilRes) {
        for (const msg of entry.thread ?? []) {
          feed.push({ id: entry.id, speaker: msg.speaker, text: msg.text,
            phase: msg.phase, timestamp: msg.timestamp });
        }
      }
      setGaiaDirectiveFeed(feed);

      // ── Retrospectives ────────────────────────────────────────────────────────
      setGaiaRetrospectives(retrosRes.slice().reverse()); // newest first
    } catch (err) {
      console.error('[Dashboard] rehydrateGaia failed:', err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist Gaia conversations to server when updated ─────────────────────
  useEffect(() => {
    for (const [id, conv] of Object.entries(gaiaConversations)) {
      if (!conv.messages?.length) continue;
      const key = `${id}:${conv.messages.length}`;
      if (!savedGaiaConvIds.current.has(key)) {
        savedGaiaConvIds.current.add(key);
        fetch(`${API_URL}/gaia/conversations/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(conv),
        }).catch(() => {});
      }
    }
  }, [gaiaConversations]);

  // ── Auto-scroll Gaia chat to bottom on new messages or thinking state ───────
  useEffect(() => {
    if (gaiaChatRef.current) {
      gaiaChatRef.current.scrollTop = gaiaChatRef.current.scrollHeight;
    }
  }, [gaiaConversations, activeGaiaConvId, gaiaThinking]);

  // ── Rehydrate queue state (called on mount + every WS reconnect) ────────────
  const rehydrateQueue = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/queue`);
      if (!r.ok) return;
      const { pending: pend, running: run } = await r.json();
      const allItems = [
        ...run.map(m => ({ ...m, status: 'running' })),
        ...pend.map(m => ({ ...m, status: 'pending' })),
      ];
      setQueueState(allItems);
      // Stub active mission entries for running missions not yet in history
      if (run.length > 0) {
        setMissions(prev => {
          const next = { ...prev };
          for (const m of run) {
            if (!next[m.id]) {
              next[m.id] = {
                id: m.id,
                text: m.text,
                channel: '',
                target: m.target ?? 'zeus',
                userId: m.userId ?? null,
                isWarRoom: false,
                timestamp: Date.now(),
                status: 'active',
                stage: 'idle',
                uiMode: m.tier ? tierToMode(m.tier) : 'classifying',
                tier: m.tier ?? null,
                councilMessages: [],
                councilBackendMessages: [],
                progress: { zeus: 0, poseidon: 0, hades: 0 },
                nodeThoughts: {},
              streamingContent: null,
                nodeTasks: {},
                runStats: null,
                output: null,
              };
            }
          }
          return next;
        });
      }
    } catch (err) {
      console.error('[Dashboard] rehydrateQueue failed:', err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load missions from server on mount ─────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/missions`)
      .then(r => r.json())
      .then(list => {
        const map = {};
        for (const m of list) {
          // Backfill userId / isWarRoom from channel if missing (handles legacy saves)
          const ch = (m.channel || '').toLowerCase();
          if (!m.userId) {
            if (ch.includes('carson'))     m.userId = "8150818650";
            else if (ch.includes('tyler')) m.userId = "874345067";
          }
          if (!m.isWarRoom && ch.startsWith('war room')) m.isWarRoom = true;
          map[m.id] = m;
          savedMissionIds.current.add(m.id);
        }
        setMissions(map);
      })
      .catch(err => console.error("[Dashboard] Failed to load missions:", err));
    rehydrateQueue();
    rehydrateGaia();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node health polling ────────────────────────────────────────────────────
  useEffect(() => {
    const pingAll = async () => {
      const results = await Promise.all(
        Object.entries(NODE_HEALTH_TARGETS).map(async ([name, target]) => {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 3500);
            const res = await fetch(`${API_URL}/proxy/health?target=${encodeURIComponent(target)}`, { signal: ctrl.signal });
            clearTimeout(timer);
            return [name, res.ok];
          } catch {
            return [name, false];
          }
        })
      );
      setNodeHealth(Object.fromEntries(results));
    };
    pingAll();
    const t = setInterval(pingAll, 10000);
    return () => clearInterval(t);
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleEvent = (msg) => {
      switch (msg.type) {

        case "request_start": {
          const id = msg.id;
          // Gaia conversations are fully isolated in gaiaMessages — never enter missions state
          if (msg.target === "gaia") break;
          // Direct agents get their mode immediately; B3C council waits for tier_classified
          let uiMode;
          if (msg.text?.toUpperCase().startsWith("ZEUS PROTOCOL")) {
            uiMode = "zeus_protocol";
          } else if (msg.target === "poseidon") {
            uiMode = "poseidon";
          } else if (msg.target === "hades") {
            uiMode = "hades";
          } else if (msg.target === "gaia") {
            uiMode = "gaia";
          } else {
            uiMode = "classifying"; // hold on triangle until tier_classified
          }
          setMissions(prev => ({
            ...prev,
            [id]: {
              id,
              text: msg.text,
              channel: msg.channel,
              target: msg.target,
              userId: msg.userId ?? null,
              isWarRoom: msg.isWarRoom ?? false,
              timestamp: Date.now(),
              status: "active",
              stage: "idle",
              uiMode,
              tier: null,
              councilMessages: [],
              councilBackendMessages: [],
              progress: { zeus: 0, poseidon: 0, hades: 0 },
              nodeThoughts: {},
              nodeTasks: {},
              nodeStatus: {},
              stageTimes: { idle: Date.now() },
              zeusDiagnostic: null,
              runStats: null,
              output: null,
            },
          }));
          // Only auto-select if this is a live event, not a ring buffer replay
          if (!isReplayingRef.current) setActiveMissionId(id);
          break;
        }

        case "tier_classified": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            return {
              ...prev,
              [msg.id]: { ...prev[msg.id], tier: msg.tier, uiMode: tierToMode(msg.tier) },
            };
          });
          break;
        }

        case "stage_change": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, stage: msg.stage, stageTimes: { ...(m.stageTimes || {}), [msg.stage]: Date.now() } } };
          });
          break;
        }

        case "agent_thought": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, nodeThoughts: { ...m.nodeThoughts, [msg.agent]: msg.text } } };
          });
          break;
        }

        case "agent_stream": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, streamingContent: msg.full } };
          });
          break;
        }

        case "council_message": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const entry = { speaker: msg.speaker, text: msg.text, vote: msg.vote || null };
            if (msg.council === "initial") {
              return { ...prev, [msg.id]: { ...m, councilMessages: [...m.councilMessages, entry] } };
            } else {
              return { ...prev, [msg.id]: { ...m, councilBackendMessages: [...m.councilBackendMessages, entry] } };
            }
          });
          break;
        }

        case "node_progress": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, progress: { ...m.progress, [msg.agent]: msg.value } } };
          });
          break;
        }

        case "task_assigned": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, nodeTasks: { ...m.nodeTasks, [msg.agent]: msg.task } } };
          });
          break;
        }

        case "agent_start": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const key = `${msg.agent}:${msg.phase}`;
            return { ...prev, [msg.id]: { ...m, nodeStatus: { ...m.nodeStatus, [key]: { status: "working", startedAt: Date.now(), phase: msg.phase } } } };
          });
          break;
        }

        case "agent_complete": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const key = `${msg.agent}:${msg.phase}`;
            const existing = m.nodeStatus[key] || {};
            return { ...prev, [msg.id]: { ...m, nodeStatus: { ...m.nodeStatus, [key]: { ...existing, status: "complete" } } } };
          });
          break;
        }

        case "agent_error": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            const key = `${msg.agent}:${msg.phase}`;
            const existing = m.nodeStatus[key] || {};
            return { ...prev, [msg.id]: { ...m, nodeStatus: { ...m.nodeStatus, [key]: { ...existing, status: "failed", error: msg.error } } } };
          });
          break;
        }

        case "zeus_diagnostic": {
          if (!msg.id) return;
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            const m = prev[msg.id];
            return { ...prev, [msg.id]: { ...m, zeusDiagnostic: { agent: msg.agent, phase: msg.phase, error: msg.error, diagnosis: msg.diagnosis } } };
          });
          break;
        }

        case "request_complete": {
          const id = msg.id;
          setMissions(prev => {
            if (!prev[id]) return prev;
            return {
              ...prev,
              [id]: {
                ...prev[id],
                status: "done",
                stage: "done",
                output: msg.output ?? null,
                streamingContent: null,
                elapsed: msg.elapsed ?? null,
                runStats: { elapsed: msg.elapsed, tokens: msg.tokens, councils: msg.councils },
              },
            };
          });
          break;
        }

        case "gaia_report":
          setGaiaReport({ timestamp: msg.timestamp, text: msg.text });
          break;

        case "gaia_message":
          // Legacy feed (used by CONVERSATIONS tab in Gaia right panel)
          setGaiaMessages(prev => [{
            text:      msg.text,
            response:  msg.response,
            userId:    msg.userId ?? null,
            channel:   msg.channel,
            timestamp: msg.timestamp ?? new Date().toISOString(),
          }, ...prev]);
          setGaiaThinking(false);
          setGaiaPendingText("");
          // Append assistant response to the active conversation
          setGaiaConversations(prev => {
            const convId = activeGaiaConvIdRef.current;
            if (!convId || !prev[convId]) return prev;
            const conv = prev[convId];
            const assistantMsg = { role: "assistant", text: msg.response, timestamp: msg.timestamp ?? new Date().toISOString() };
            return { ...prev, [convId]: { ...conv, messages: [...conv.messages, assistantMsg] } };
          });
          break;

        case "gaia_error":
          setGaiaThinking(false);
          setGaiaPendingText("");
          break;

        case "queue_update":
          setQueueState(msg.queue ?? []);
          break;

        case "queue_ack":
          // Queue acknowledgment — handled by Telegram; dashboard shows it via queue_update
          break;

        case "queue_reorder": {
          const notifTs = Date.now();
          setZeusReorderNotif({ reason: msg.reason, ts: notifTs });
          setTimeout(() => setZeusReorderNotif(n => n?.ts === notifTs ? null : n), 8000);
          break;
        }

        case "mission_cancelled":
          setMissions(prev => {
            if (!prev[msg.id]) return prev;
            return { ...prev, [msg.id]: { ...prev[msg.id], status: "cancelled", stage: "done" } };
          });
          break;

        case "gaia_retrospective":
          setGaiaRetrospectives(prev => [{ timestamp: msg.timestamp, text: msg.text, missions_reviewed: msg.missions_reviewed }, ...prev]);
          setGaiaReport({ timestamp: msg.timestamp, text: msg.text });
          break;

        case "gaia_directive":
          setGaiaDirectiveFeed(prev => [...prev, {
            id: msg.id, speaker: msg.speaker, text: msg.text,
            phase: msg.phase, timestamp: msg.timestamp ?? new Date().toISOString(),
          }]);
          setGaiaCouncilSending(false);
          break;

        case "gaia_ssh_control":
          setSshCtrlPulse(Date.now());
          setGaiaSSHLog(prev => [{ node: msg.node, command: msg.command, reason: msg.reason, result: msg.result, ok: msg.ok, timestamp: msg.timestamp ?? new Date().toISOString() }, ...prev]);
          break;

        case "gaia_growth":
          if (msg.phase === "directive_sent") {
            setFruitRipeness(prev => ({ ...prev, [msg.target]: (prev[msg.target] || 0) + 1 }));
            setActivePulses(prev => [...prev, { id: msg.id, target: msg.target, phase: "up", start: Date.now() }]);
            setGaiaGrowthHistory(prev => ({
              ...prev,
              [msg.target]: [...(prev[msg.target] || []), { directive: msg.directive, timestamp: msg.timestamp }],
            }));
          } else if (msg.phase === "response_received") {
            setActivePulses(prev => [...prev, { id: `${msg.id}_down`, target: msg.target, phase: "down", start: Date.now() }]);
          }
          break;

        default:
          break;
      }
    };

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        // Mark replay window — skip auto-selecting missions from ring buffer replay
        isReplayingRef.current = true;
        setTimeout(() => { isReplayingRef.current = false; }, 2000);
        setWsStatus("live");
        clearTimeout(reconnectTimer.current);
        backoffRef.current = 1000;
        rehydrateQueue();
        rehydrateGaia();
      };
      ws.onclose = () => {
        setWsStatus("disconnected");
        reconnectTimer.current = setTimeout(connect, backoffRef.current);
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      };
      ws.onerror = () => { ws.close(); };
      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        handleEvent(msg);
      };
    };

    connect();
    return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); };
  }, []);

  // ── Warn before leaving when missions are active ───────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const hasActive = queueStateRef.current.some(
        m => m.status === 'running' || m.status === 'pending'
      );
      if (hasActive) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Persist completed missions to server ───────────────────────────────────
  useEffect(() => {
    for (const [id, m] of Object.entries(missions)) {
      if (m.status === "done" && !savedMissionIds.current.has(id)) {
        savedMissionIds.current.add(id);
        fetch(`${API_URL}/missions/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m),
        }).catch(err => {
          savedMissionIds.current.delete(id);
          console.error("[Dashboard] Failed to save mission:", err);
        });
      }
    }
  }, [missions]);

  // ── Auto-select panel when stage changes (tier3/tier2 only) ───────────────
  useEffect(() => {
    if (!activeMission) { setSelectedNode(null); return; }
    if (!["tier2", "tier3"].includes(mode)) { setSelectedNode(null); return; }
    if      (stage === "idle")            setSelectedNode(null);
    else if (stage === "council_initial") setSelectedNode("council_initial");
    else if (stage === "execution")       setSelectedNode("zeus_exec");
    else if (stage === "council_backend") setSelectedNode("council_backend");
    else if (stage === "done")            setSelectedNode("output");
  }, [stage, activeMissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node/connection state helpers (tier3) ─────────────────────────────────
  const getNodeState = (node) => {
    const stageOrder = ["idle", "council_initial", "execution", "council_backend", "done"];
    const nodeStages = { council_initial: 1, zeus_exec: 2, poseidon: 2, hades: 2, council_backend: 3, output: 4 };
    const current = stageOrder.indexOf(stage);
    const nodeIdx = nodeStages[node] || 0;
    if (current === nodeIdx) return "thinking";
    if (current > nodeIdx)  return "done";
    return "idle";
  };

  const getConnState = (from) => {
    const stageIdx = { idle: 0, council_initial: 1, execution: 2, council_backend: 3, done: 4 };
    const connEnds  = { council_initial: 1, execution: 2, council_backend: 3, done: 4 };
    const current = stageIdx[stage] || 0;
    const fromIdx = connEnds[from] || 0;
    if (current > fromIdx)  return "done";
    if (current === fromIdx) return "active";
    return "idle";
  };

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!sendText.trim() || sending) return;
    setSending(true);
    try {
      const rawText    = sendText.trim();
      const userName   = activeUser === "CARSON" ? "Carson" : activeUser === "TYLER" ? "Tyler" : null;
      const idPrefix   = userName ? `Message from ${userName}: ` : "";
      let target = "zeus";
      let text;
      if (sendTarget === "ZEUS_PROTOCOL") {
        text = `ZEUS PROTOCOL: ${idPrefix}${rawText}`;
      } else {
        text = `${idPrefix}${rawText}`;
        if      (sendTarget === "POSEIDON") { target = "poseidon"; }
        else if (sendTarget === "HADES")    { target = "hades"; }
        else if (sendTarget === "GAIA")     { target = "gaia"; }
      }
      const userId   = activeUser === "CARSON" ? "8150818650" : activeUser === "TYLER" ? "874345067" : undefined;
      const channel  = activeUser ? `dashboard · ${activeUser}` : "dashboard";
      const priority = sendPriority;
      await fetch(`${API_URL}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, channel, target, priority, ...(userId ? { userId } : {}) }),
      });
      setSendText("");
      if (sendPriority) setSendPriority(false);
    } catch (err) {
      console.error("[Dashboard] Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  // ── Cancel mission (active/pending) ───────────────────────────────────────
  const handleCancelMission = async (id, e) => {
    e.stopPropagation();
    try {
      await fetch(`${API_URL}/missions/${id}/cancel`, { method: "POST" });
    } catch (err) {
      console.error("[Dashboard] Cancel failed:", err);
    }
  };

  // ── Delete mission (completed/cancelled) ───────────────────────────────────
  const handleDeleteMission = async (id, e) => {
    e.stopPropagation();
    setMissions(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (activeMissionId === id) setActiveMissionId(null);
    try {
      await fetch(`${API_URL}/missions/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("[Dashboard] Delete failed:", err);
    }
  };

  // ── Gaia direct send — continuous conversation ────────────────────────────
  const handleGaiaSend = async () => {
    if (!sendText.trim() || sending || gaiaThinking) return;

    // COUNCIL mode — initiate B3C council communication
    if (gaiaViewMode === "council") {
      const message = sendText.trim();
      setSendText("");
      setSending(true);
      setGaiaCouncilSending(true);
      try {
        await fetch(`${API_URL}/gaia/council`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ message }),
        });
      } catch (err) {
        console.error("[Dashboard] Council send failed:", err);
        setGaiaCouncilSending(false);
      } finally {
        setSending(false);
      }
      return;
    }

    const text    = sendText.trim();
    const userId  = activeUser === "CARSON" ? "8150818650" : activeUser === "TYLER" ? "874345067" : undefined;
    const channel = activeUser ? `Gaia · ${activeUser}` : "Gaia · Dashboard";

    // Create new conversation or continue existing one
    let convId = activeGaiaConvId;
    let conv;
    if (!convId || !gaiaConversations[convId]) {
      convId = `gaia_conv_${Date.now()}`;
      conv   = { id: convId, userId: userId ?? null, timestamp: Date.now(), messages: [] };
    } else {
      conv = { ...gaiaConversations[convId], messages: [...gaiaConversations[convId].messages] };
    }

    // Append user message optimistically
    const userMsg = { role: "user", text, timestamp: new Date().toISOString() };
    conv.messages = [...conv.messages, userMsg];

    setActiveGaiaConvId(convId);
    activeGaiaConvIdRef.current = convId;
    setGaiaConversations(prev => ({ ...prev, [convId]: conv }));
    setGaiaThinking(true);
    setGaiaPendingText(text);
    setSendText("");
    setSending(true);

    try {
      // Build OpenAI-format messages array for full context
      const messages = conv.messages.map(m => ({ role: m.role, content: m.text }));
      await fetch(`${API_URL}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, channel, target: "gaia", messages, ...(userId ? { userId } : {}) }),
      });
    } catch (err) {
      console.error("[Dashboard] Gaia send failed:", err);
      setGaiaThinking(false);
      setGaiaPendingText("");
    } finally {
      setSending(false);
    }
  };

  // ── Mission click (sidebar) ────────────────────────────────────────────────
  const handleMissionClick = (id) => {
    const m = missions[id];
    if (!m) return;
    setActiveMissionId(id);
    const missionMode = m.uiMode ?? "tier3";
    if (!["tier2", "tier3"].includes(missionMode)) { setSelectedNode(null); return; }
    if      (m.stage === "done")             setSelectedNode("output");
    else if (m.stage === "council_initial")  setSelectedNode("council_initial");
    else if (m.stage === "execution")        setSelectedNode("zeus_exec");
    else if (m.stage === "council_backend")  setSelectedNode("council_backend");
    else                                     setSelectedNode(null);
  };

  // ── Gaia mode toggle ───────────────────────────────────────────────────────
  const toggleGaiaMode = () => {
    if (gaiaMode) {
      setGaiaMode(false);
      setSelectedFruit(null);
    } else {
      prevGaiaStateRef.current = { sendTarget };
      setGaiaMode(true);
      setSelectedFruit(null);
    }
  };

  // ── Click-outside for node health dropdown ────────────────────────────────
  useEffect(() => {
    if (!nodeHealthOpen) return;
    const handler = (e) => {
      if (nodeHealthRef.current && !nodeHealthRef.current.contains(e.target)) {
        setNodeHealthOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [nodeHealthOpen]);

  // ── Detail panel renderer (tier3) ─────────────────────────────────────────
  const renderPanel = () => {
    if (!selectedNode || !["tier2", "tier3"].includes(mode)) return null;

    const panels = {
      council_initial: {
        title: "B3C INITIAL COUNCIL",
        content: (
          <>
            <VoteStamps messages={councilMessages} missionId={activeMissionId} />
            <div className="panel-section">
              <div className="panel-section-label">Council deliberation</div>
              <CouncilThread messages={councilMessages} />
            </div>
          </>
        ),
      },
      zeus_exec: {
        title: getExecStatus("zeus")?.status === "failed" ? "ZEUS — FAILED" : "ZEUS — EXECUTING",
        content: (
          <>
            {getExecStatus("zeus")?.status === "failed" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "#ff5050" }}>Failure</div>
                <div className="tier2-error-msg">{getExecStatus("zeus")?.error || "No response received"}</div>
              </div>
            )}
            {nodeTasks.zeus && (
              <div className="panel-section">
                <div className="panel-section-label">Deliverable</div>
                <div className="thought-block">{nodeTasks.zeus}</div>
              </div>
            )}
            {nodeThoughts.zeus && (
              <div className="panel-section">
                <div className="panel-section-label">Reasoning</div>
                <div className="thought-block">{nodeThoughts.zeus}</div>
              </div>
            )}
            {zeusDiagnostic?.agent === "zeus" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "var(--gold)" }}>Zeus Diagnostic</div>
                <div className="thought-block" style={{ borderLeftColor: "var(--gold)", color: "rgba(232,184,75,0.85)" }}>{zeusDiagnostic.diagnosis}</div>
              </div>
            )}
          </>
        ),
      },
      poseidon: {
        title: getExecStatus("poseidon")?.status === "failed" ? "POSEIDON — FAILED" : "POSEIDON — EXECUTING",
        content: (
          <>
            {getExecStatus("poseidon")?.status === "failed" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "#ff5050" }}>Failure</div>
                <div className="tier2-error-msg">{getExecStatus("poseidon")?.error || "No response received"}</div>
              </div>
            )}
            {nodeTasks.poseidon && (
              <div className="panel-section">
                <div className="panel-section-label">Deliverable</div>
                <div className="thought-block">{nodeTasks.poseidon}</div>
              </div>
            )}
            {nodeThoughts.poseidon && (
              <div className="panel-section">
                <div className="panel-section-label">Reasoning</div>
                <div className="thought-block" style={{ borderLeftColor: "var(--poseidon)" }}>{nodeThoughts.poseidon}</div>
              </div>
            )}
            {zeusDiagnostic?.agent === "poseidon" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "var(--gold)" }}>Zeus Diagnostic</div>
                <div className="thought-block" style={{ borderLeftColor: "var(--gold)", color: "rgba(232,184,75,0.85)" }}>{zeusDiagnostic.diagnosis}</div>
              </div>
            )}
          </>
        ),
      },
      hades: {
        title: getExecStatus("hades")?.status === "failed" ? "HADES — FAILED" : "HADES — EXECUTING",
        content: (
          <>
            {getExecStatus("hades")?.status === "failed" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "#ff5050" }}>Failure</div>
                <div className="tier2-error-msg">{getExecStatus("hades")?.error || "No response received"}</div>
              </div>
            )}
            {nodeTasks.hades && (
              <div className="panel-section">
                <div className="panel-section-label">Deliverable</div>
                <div className="thought-block">{nodeTasks.hades}</div>
              </div>
            )}
            {nodeThoughts.hades && (
              <div className="panel-section">
                <div className="panel-section-label">Reasoning</div>
                <div className="thought-block" style={{ borderLeftColor: "var(--hades)" }}>{nodeThoughts.hades}</div>
              </div>
            )}
            {zeusDiagnostic?.agent === "hades" && (
              <div className="panel-section">
                <div className="panel-section-label" style={{ color: "var(--gold)" }}>Zeus Diagnostic</div>
                <div className="thought-block" style={{ borderLeftColor: "var(--gold)", color: "rgba(232,184,75,0.85)" }}>{zeusDiagnostic.diagnosis}</div>
              </div>
            )}
          </>
        ),
      },
      council_backend: {
        title: "B3C BACKEND COUNCIL",
        content: (
          <>
            <VoteStamps messages={councilBackendMessages} missionId={activeMissionId} />
            <div className="panel-section">
              <div className="panel-section-label">Review deliberation</div>
              <CouncilThread messages={councilBackendMessages} />
            </div>
          </>
        ),
      },
      output: {
        title: "OUTPUT — DELIVERED",
        content: (
          <>
            {activeRequest?.channel && (
              <div className="panel-section">
                <div className="panel-section-label">Origin channel</div>
                <div style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 3, fontSize: 11, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", background: "rgba(94,232,176,0.1)", border: "1px solid rgba(94,232,176,0.4)", color: "var(--done)" }}>
                  {activeRequest.channel.toUpperCase()}
                </div>
              </div>
            )}
            {runStats && (
              <div className="panel-section">
                <div className="panel-section-label">Run stats</div>
                <div className="timing-row"><span>Total time</span><span className="timing-val">{runStats.elapsed ? `${(runStats.elapsed / 1000).toFixed(1)}s` : "—"}</span></div>
                <div className="timing-row"><span>Council rounds</span><span className="timing-val">{runStats.councils ?? "—"}</span></div>
                <div className="timing-row"><span>Tier</span><span className="timing-val">{activeMission?.tier ?? "—"}</span></div>
              </div>
            )}
          </>
        ),
      },
    };

    return panels[selectedNode] || null;
  };

  // ── Mission list ───────────────────────────────────────────────────────────
  const USER_IDS = { CARSON: "8150818650", TYLER: "874345067" };
  // Match by userId (coerced to string) OR by channel name — handles legacy/dashboard missions
  const missionBelongsTo = (m, uid, nameHint) =>
    (m.userId != null && String(m.userId) === uid) ||
    (m.channel || '').toLowerCase().includes(nameHint);
  const missionList = Object.values(missions)
    .filter(m => m.target !== "gaia") // Gaia is isolated — never in B3C history
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter(m => {
      if (sidebarTab === "CARSON") return missionBelongsTo(m, USER_IDS.CARSON, 'carson');
      if (sidebarTab === "TYLER")  return missionBelongsTo(m, USER_IDS.TYLER,  'tyler');
      return true; // ALL
    });

  // ── Sidebar component ──────────────────────────────────────────────────────
  const USER_LABELS = { "8150818650": "CARSON", "874345067": "TYLER" };
  const renderSidebar = () => {
    // Build lookup: missionId → queue position (pending only)
    const queuePositions = {};
    for (const q of queueState) {
      if (q.status === "pending") queuePositions[q.id] = q.position;
    }

    return (
    <div className="sidebar">
      {/* ── Queue Panel ── */}
      <div className="sidebar-section">
        {zeusReorderNotif && (
          <div className="zeus-reorder-notif">
            ⚡ Zeus reorganized — {zeusReorderNotif.reason}
          </div>
        )}
        <div className="queue-slot-pills">
          {(() => {
            const t1Count     = queueState.filter(q => q.status === "running" && q.tier === "TIER_1").length;
            const councilCount = queueState.filter(q => q.status === "running" && (q.tier === "TIER_2" || q.tier === "TIER_3")).length;
            return (
              <>
                <div className={`queue-slot-pill t1${t1Count > 0 ? " occupied" : ""}`}>
                  <div className="queue-pill-label">TIER I</div>
                  <div className="queue-pill-count">instant</div>
                </div>
                <div className={`queue-slot-pill t2${councilCount > 0 ? " occupied" : ""}`}>
                  <div className="queue-pill-label">COUNCIL</div>
                  <div className="queue-pill-count">{councilCount}/1</div>
                </div>
              </>
            );
          })()}
        </div>
        {queueState.length === 0 ? (
          <div className="queue-empty-line">Queue clear</div>
        ) : (
          [...queueState]
            .sort((a, b) =>
              a.status === "running" && b.status !== "running" ? -1 :
              b.status === "running" && a.status !== "running" ?  1 :
              a.position - b.position
            )
            .map(q => {
              const tierLabel = q.tier === "TIER_1" ? "T-I" : q.tier === "TIER_2" ? "T-II" : q.tier === "TIER_3" ? "T-III" : q.tier === "DIRECT" ? "DIR" : "";
              const userLabel = q.userId === "8150818650" ? "CARSON" : q.userId === "874345067" ? "TYLER" : "";
              return (
                <div key={q.id} className="queue-item">
                  {q.status === "running"
                    ? <span className="queue-item-run-dot" />
                    : <span className="queue-item-pos">#{q.position}</span>
                  }
                  {tierLabel && <span className="queue-item-tier">{tierLabel}</span>}
                  {userLabel && <span className="queue-item-user">{userLabel}</span>}
                  <span className="queue-item-name">{missionTitles[q.id] || getMissionTitle(q.id, q.text)}</span>
                  <button
                    className={`queue-expand-btn ${expandedQueueItems.has(q.id) ? "open" : ""}`}
                    onClick={(e) => { e.stopPropagation(); setExpandedQueueItems(prev => { const next = new Set(prev); next.has(q.id) ? next.delete(q.id) : next.add(q.id); return next; }); }}
                    title="Show full input"
                  >▾</button>
                  {q.status === "pending" && q.estimatedWait && <span className="queue-item-wait">{q.estimatedWait}</span>}
                  <button className="queue-item-cancel" onClick={(e) => handleCancelMission(q.id, e)} title="Cancel">🗑</button>
                  {expandedQueueItems.has(q.id) && (
                    <div className="queue-expanded-text">{q.text}</div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* ── Mission History ── */}
      <div className="sidebar-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="sidebar-label" style={{ marginBottom: 0 }}>Mission History</div>
          <button className="new-mission-btn" onClick={() => setActiveMissionId(null)}>+ NEW</button>
        </div>
        <div className="sidebar-tabs">
          {["ALL", "CARSON", "TYLER"].map(tab => (
            <button
              key={tab}
              className={`sidebar-tab ${sidebarTab === tab ? "active" : ""}`}
              onClick={() => { setSidebarTab(tab); setActiveUser(tab === "ALL" ? null : tab); }}
            >{tab}</button>
          ))}
        </div>
        {missionList.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            {sidebarTab === "ALL" ? "No missions yet. Waiting for activity." : `No missions from ${sidebarTab} yet.`}
          </div>
        ) : (
          missionList.map(m => {
            const queuePos = queuePositions[m.id];
            const isCancellable = m.status === "active" || queuePos != null;
            return (
            <div key={m.id}
              className={`req-item ${m.id === activeMissionId ? "selected" : ""} ${m.status === "active" ? "active" : ""}`}
              onClick={() => handleMissionClick(m.id)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <span className={`req-status ${m.status === "cancelled" ? "cancelled" : m.status}`} />
                <span className="req-text" style={{ flex: 1 }}>{missionTitles[m.id] || getMissionTitle(m.id, m.text)}</span>
                <button
                  className={`req-expand-btn ${expandedPrompts.has(m.id) ? "open" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setExpandedPrompts(prev => { const next = new Set(prev); next.has(m.id) ? next.delete(m.id) : next.add(m.id); return next; }); }}
                  title="Show full prompt"
                >▾</button>
                {isCancellable ? (
                  <button
                    className="req-trash-btn"
                    onClick={(e) => handleCancelMission(m.id, e)}
                    title="Cancel mission"
                  >🗑</button>
                ) : (
                  <button
                    className="req-trash-btn"
                    onClick={(e) => handleDeleteMission(m.id, e)}
                    title="Delete mission"
                  >🗑</button>
                )}
              </div>
              {expandedPrompts.has(m.id) && (
                <div className="req-expanded-prompt">{m.text}</div>
              )}
              <div className="req-time">
                {new Date(m.timestamp).toLocaleTimeString()}
                {m.elapsed ? ` · ${(m.elapsed / 1000).toFixed(1)}s` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                {queuePos != null && (
                  <div className="queue-pos-badge">#{queuePos}</div>
                )}
                {m.tier && (
                  <div className="req-tier" style={{ margin: 0 }}>
                    {m.tier === "TIER_1" ? "T-I" : m.tier === "TIER_2" ? "T-II" : "T-III"}
                    {m.uiMode === "zeus_protocol" ? " · ZEUS" : m.uiMode === "poseidon" ? " · POSEIDON" : m.uiMode === "hades" ? " · HADES" : m.uiMode === "gaia" ? " · GAIA" : ""}
                  </div>
                )}
                {m.isWarRoom && (
                  <div className="req-user-badge" style={{ color: "var(--gold2)", borderColor: "rgba(200,150,10,0.4)" }}>WAR ROOM</div>
                )}
                {!m.isWarRoom && m.userId && USER_LABELS[m.userId] && sidebarTab === "ALL" && (
                  <div className="req-user-badge">{USER_LABELS[m.userId]}</div>
                )}
                {m.status === "cancelled" && (
                  <div className="req-user-badge" style={{ color: "var(--muted)", opacity: 0.5 }}>CANCELLED</div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-label">Gaia — Last Report</div>
        {gaiaReport ? (
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            <div style={{ color: "var(--gaia)", marginBottom: 6, fontFamily: "Cinzel, serif", fontSize: 11, letterSpacing: "0.08em" }}>
              GAIA · {gaiaReport.timestamp}
            </div>
            {gaiaReport.text}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.7 }}>Gaia's nightly retrospective will appear here.</div>
        )}
      </div>
    </div>
    );
  };

  // ── TIER 1 VIEW — Intimate, Zeus only ─────────────────────────────────────
  const renderTier1 = () => {
    const isThinking = activeMission?.status === "active";
    return (
      <>
        {renderSidebar()}
        <div className="tier1-area">
          <div className="tier1-symbol">⚡</div>
          <div className="tier1-agent-label">ZEUS</div>
          {isThinking && !outputText && (
            <div className="tier1-thinking">processing . . .</div>
          )}
          {outputText && (
            <div className="tier1-response">{outputText}</div>
          )}
          {!activeMission && (
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Cinzel, serif", letterSpacing: "0.15em", textAlign: "center", marginTop: 8 }}>
              Direct line · Single response
            </div>
          )}
        </div>
      </>
    );
  };

  // ── TIER 2 VIEW — Focused trio ─────────────────────────────────────────────
  const renderTier2 = () => {
    const isCoordinating = stage === "council_initial";
    const isExecuting    = stage === "execution";
    const isReviewing    = stage === "council_backend";
    const isDone         = stage === "done";
    const isActive       = activeMission?.status === "active";

    // Derive the display card state from live nodeStatus
    const getCardClass = (agentKey) => {
      const s = getExecStatus(agentKey);
      if (!s) return isDone || isReviewing ? `${agentKey}-done` : isExecuting ? "working" : "idle";
      return s.status; // "working" | "complete" | "failed"
    };

    // Which agents are currently speaking in council phases
    const speakerKey = isCoordinating ? "zeus:coordination"
      : isReviewing ? null : null;
    const coordinatingSpeaker = nodeStatus["zeus:coordination"];
    const currentSpeaker = isCoordinating && coordinatingSpeaker?.status === "working" ? "zeus" : null;

    return (
      <>
        {renderSidebar()}
        {renderTier2Content()}
      </>
    );
  };

  const renderTier2Content = () => {
    const isCoordinating = stage === "council_initial";
    const isExecuting    = stage === "execution";
    const isReviewing    = stage === "council_backend";
    const isDone         = stage === "done";
    const isActive       = activeMission?.status === "active";
    const getCardClass = (agentKey) => {
      const s = getExecStatus(agentKey);
      if (!s) return isDone || isReviewing ? `${agentKey}-done` : isExecuting ? "working" : "idle";
      return s.status;
    };
    return (
        <div className="tier2-area">
          {activeRequest ? (
            <div className="tier2-request-pill">{activeRequest.text}</div>
          ) : (
            <div className="tier2-request-pill" style={{ color: "var(--muted)", fontFamily: "Cinzel, serif", letterSpacing: "0.15em" }}>
              FOCUSED THREE-DOMAIN EXECUTION
            </div>
          )}

          {isActive && (
            <div className="tier2-status">
              <span className="tier2-status-dot" />
              {isCoordinating ? "COORDINATING" : isExecuting ? "EXECUTING IN PARALLEL" : isReviewing ? "SINGLE REVIEW PASS" : "ACTIVE"}
              {phaseElapsed !== null && (
                <span style={{ marginLeft: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "rgba(232,184,75,0.5)" }}>
                  {phaseElapsed}s
                </span>
              )}
            </div>
          )}
          {!isActive && activeMission && (
            <div className="tier2-status" style={{ color: "var(--done)" }}>
              ✓ COMPLETE · {runStats?.elapsed ? `${(runStats.elapsed / 1000).toFixed(1)}s` : ""}
            </div>
          )}
          {!activeMission && (
            <div className="tier2-status">TIER II · FOCUSED TRIO</div>
          )}

          <div className="tier2-agents">
            {[
              { key: "zeus",     symbol: "⚡", name: "ZEUS",     domain: "Spiritual / Intellectual" },
              { key: "poseidon", symbol: "🔱", name: "POSEIDON", domain: "Financial / Social" },
              { key: "hades",    symbol: "🏛",  name: "HADES",   domain: "Physical / Technical" },
            ].map(agent => {
              const execSt      = getExecStatus(agent.key);
              const cardClass   = getCardClass(agent.key);
              const elapsed     = execElapsed(agent.key);
              const deliverable = nodeTasks[agent.key];
              const thought     = nodeThoughts[agent.key];

              let badgeLabel, badgeClass;
              if (execSt?.status === "failed")   { badgeLabel = "FAILED";   badgeClass = "failed"; }
              else if (execSt?.status === "complete") { badgeLabel = "COMPLETE"; badgeClass = "complete"; }
              else if (execSt?.status === "working")  { badgeLabel = "WORKING";  badgeClass = "working"; }
              else if (deliverable || thought)        { badgeLabel = "ASSIGNED"; badgeClass = "assigned"; }
              else                                    { badgeLabel = null;        badgeClass = ""; }

              return (
                <div key={agent.key} className={`tier2-card ${cardClass}`}>
                  <div className="tier2-card-head">
                    <span className="tier2-card-symbol">{agent.symbol}</span>
                    <span className="tier2-card-name">{agent.name}</span>
                    {badgeLabel && (
                      <span className={`tier2-status-badge ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    )}
                    {elapsed !== null && (
                      <span className="tier2-timer">{elapsed}s</span>
                    )}
                  </div>
                  <div className="tier2-card-domain">{agent.domain}</div>
                  {execSt?.status === "failed" ? (
                    <div className="tier2-error-msg">
                      {execSt.error || "No response received"}
                    </div>
                  ) : deliverable ? (
                    <div className="tier2-card-content">{deliverable}</div>
                  ) : thought ? (
                    <div className="tier2-card-content" style={{ color: "var(--muted)", fontStyle: "italic" }}>{thought}</div>
                  ) : (
                    <div className="tier2-card-content" style={{ color: "var(--dim)" }}>
                      {isCoordinating ? "Receiving task assignment..." : "Awaiting execution..."}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {zeusDiagnostic && (
            <div className="zeus-diagnostic">
              <div className="zeus-diagnostic-header">⚡ Zeus Diagnostic</div>
              <div className="zeus-diagnostic-meta">
                {zeusDiagnostic.agent?.toUpperCase()} · {zeusDiagnostic.phase} · Error: {zeusDiagnostic.error}
              </div>
              <div className="zeus-diagnostic-body">{zeusDiagnostic.diagnosis}</div>
            </div>
          )}

          {outputText && (
            <div className="tier2-synthesis">
              <div className="tier2-synth-header">
                <span>✦</span>
                <span>Synthesized Output</span>
                {runStats?.elapsed && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(94,232,176,0.5)", fontFamily: "JetBrains Mono, monospace" }}>
                    {(runStats.elapsed / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="tier2-synth-body">{outputText}</div>
            </div>
          )}

          <div style={{ height: 40 }} />
        </div>
    );
  };

  // ── DIRECT VIEW — zeus_protocol, poseidon, hades, gaia ────────────────────
  const renderDirect = () => {
    const DIRECT_CONFIGS = {
      zeus_protocol: { symbol: "⚡", label: "ZEUS PROTOCOL",  channel: "PRIVATE CHANNEL" },
      poseidon:      { symbol: "🔱", label: "POSEIDON",       channel: "FINANCIAL · SOCIAL" },
      hades:         { symbol: "🏛",  label: "HADES",         channel: "PHYSICAL · TECHNICAL" },
      gaia:          { symbol: "🌿", label: "GAIA",           channel: "RETROSPECTIVE · MEMORY" },
    };
    const cfg        = DIRECT_CONFIGS[mode] || DIRECT_CONFIGS.zeus_protocol;
    const isThinking = activeMission?.status === "active";

    return (
      <>
        {renderSidebar()}
        <div className="direct-area">
          <div className="direct-symbol">{cfg.symbol}</div>
          <div className="direct-agent-label">{cfg.label}</div>
          <div className="direct-channel-label">{cfg.channel}</div>
          {isThinking && !outputText && !activeMission?.streamingContent && (
            <div className="direct-thinking">processing . . .</div>
          )}
          {isThinking && !outputText && activeMission?.streamingContent && (
            <div className="direct-streaming">
              {activeMission.streamingContent}
              <span className="streaming-cursor" />
            </div>
          )}
          {outputText && (
            <div className="direct-response">{outputText}</div>
          )}
          {!activeMission && (
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "Cinzel, serif", letterSpacing: "0.15em", marginTop: 8 }}>
              Direct channel · Awaiting transmission
            </div>
          )}
        </div>
      </>
    );
  };

  // ── TIER 3 VIEW — Full mission control ────────────────────────────────────
  const renderTier3 = () => {
    const execStage = stage === "execution";
    const execDone  = ["council_backend", "done"].includes(stage);
    const panel     = renderPanel();

    if (!activeMission) {
      return (
        <>
          {renderSidebar()}
          <CouncilChamber nodeHealth={nodeHealth} />
        </>
      );
    }

    return (
      <>
        {renderSidebar()}
        {renderTier3Content()}
        {/* Detail panel */}
        <div className={`detail-panel ${panel ? "" : "closed"}`}>
          {panel && (
            <>
              <div className="panel-header">
                <div className="panel-title">{panel.title}</div>
                <button className="panel-close" onClick={() => setSelectedNode(null)}>✕</button>
              </div>
              <div className="panel-body">{panel.content}</div>
            </>
          )}
        </div>
      </>
    );
  };

  const renderTier3Content = () => {
    const execStage = stage === "execution";
    const execDone  = ["council_backend", "done"].includes(stage);
    return (
        <div className="flow-area pipeline-content">
          <div className="flow-container">

            <svg className="flow-svg" viewBox="0 0 960 860" preserveAspectRatio="xMidYMid meet" style={{ height: 860, position: "absolute", top: 0, left: 0 }}>
              <path d="M 480 44 L 480 108"   className={`conn-line ${getConnState("council_initial")}`} />
              <path d="M 480 262 L 480 326"  className={`conn-line ${stage === "execution" || execDone ? "active" : "idle"}`} />
              <path d="M 249 452 L 249 490 L 480 490 L 480 520" className={`conn-line ${execDone ? "done" : "idle"}`} />
              <path d="M 480 452 L 480 520"                      className={`conn-line ${execDone ? "done" : "idle"}`} />
              <path d="M 711 452 L 711 490 L 480 490 L 480 520" className={`conn-line ${execDone ? "done" : "idle"}`} />
              <path d="M 480 672 L 480 736"  className={`conn-line ${stage === "done" ? "done" : stage === "council_backend" ? "active" : "idle"}`} />

              {stage === "council_initial" && (
                <circle r="4" fill="var(--gold2)" style={{ filter: "drop-shadow(0 0 5px var(--gold2))" }}>
                  <animateMotion dur="1s" repeatCount="indefinite" path="M 480 44 L 480 108" />
                </circle>
              )}
              {stage === "execution" && (
                <circle r="4" fill="var(--gold2)" style={{ filter: "drop-shadow(0 0 5px var(--gold2))" }}>
                  <animateMotion dur="1s" repeatCount="indefinite" path="M 480 262 L 480 326" />
                </circle>
              )}
            </svg>

            <div className="flow-nodes">

              {/* Request pill */}
              <div className="flow-row">
                <div style={{ padding: "10px 24px", background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 4, fontSize: 12, color: activeRequest ? "var(--text)" : "var(--muted)", fontFamily: activeRequest ? "JetBrains Mono, monospace" : "Cinzel, serif", letterSpacing: activeRequest ? "0" : "0.15em", maxWidth: 400, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeRequest ? activeRequest.text : "↓ AWAITING REQUEST"}
                </div>
              </div>

              <div className="spacer-sm" />

              {/* B3C Initial Council */}
              <div className="flow-row">
                <div
                  className={`council-node ${stage === "council_initial" ? "thinking" : ["execution","council_backend","done"].includes(stage) ? "done" : "idle"} ${selectedNode === "council_initial" ? "selected" : ""}`}
                  onClick={() => setSelectedNode("council_initial")}
                >
                  <div className="council-header">
                    <span className="council-title">B3C INITIAL COUNCIL</span>
                    <div className="council-members">
                      <span className="member-badge zeus-c">⚡</span>
                      <span className="member-badge poseidon-c">🔱</span>
                      <span className="member-badge hades-c">🏛</span>
                    </div>
                    {stage === "council_initial" && phaseElapsed !== null && (
                      <span className="phase-timer-badge">{phaseElapsed}s</span>
                    )}
                  </div>
                  {stage === "council_initial" && (() => {
                    const activeSpeakers = ["zeus","poseidon","hades"].filter(a =>
                      nodeStatus[`${a}:council_initial`]?.status === "working"
                    );
                    return activeSpeakers.length > 0 ? (
                      <div className="council-speaker-row">
                        ■ {activeSpeakers.map(s => s.toUpperCase()).join(", ")} SPEAKING
                      </div>
                    ) : null;
                  })()}
                  <div className="council-chat-preview">
                    {councilMessages.filter(m => m.text.length > 15).slice(-2).map((msg, i) => (
                      <div key={i} className="chat-line">
                        <span className={`speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}:</span>
                        {msg.text.slice(0, 80)}{msg.text.length > 80 ? "…" : ""}
                      </div>
                    ))}
                    {councilMessages.length === 0 && (
                      <div className="chat-line" style={{ color: "var(--dim)" }}>Awaiting council convene...</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="spacer-sm" />

              {/* Execution row */}
              <div className="flow-row" style={{ gap: 28 }}>
                {[
                  { key: "zeus_exec", agentKey: "zeus",     name: "ZEUS",     symbol: "⚡", role: "Spiritual / Intellectual", prog: progress.zeus },
                  { key: "poseidon",  agentKey: "poseidon", name: "POSEIDON", symbol: "🔱", role: "Financial / Social",       prog: progress.poseidon },
                  { key: "hades",     agentKey: "hades",    name: "HADES",    symbol: "🏛",  role: "Physical / Technical",    prog: progress.hades },
                ].map(agent => {
                  const execSt      = getExecStatus(agent.agentKey);
                  const elapsed     = execElapsed(agent.agentKey);
                  const deliverable = nodeTasks[agent.agentKey];

                  // State for styling
                  let nodeClass;
                  if (execSt?.status === "failed")   nodeClass = "failed";
                  else if (execSt?.status === "complete" || execDone) nodeClass = "done";
                  else if (execSt?.status === "working" || execStage)  nodeClass = "thinking";
                  else nodeClass = "idle";

                  // Status icon
                  let statusIcon;
                  if (execSt?.status === "failed")   statusIcon = "✕";
                  else if (nodeClass === "done")      statusIcon = "✓";
                  else if (nodeClass === "thinking")  statusIcon = "■■■";
                  else statusIcon = "○";

                  // Role text below name
                  let roleDisplay;
                  if (execSt?.status === "failed") {
                    roleDisplay = execSt.error?.slice(0, 60) || "Failed";
                  } else if (deliverable) {
                    roleDisplay = deliverable.slice(0, 80) + (deliverable.length > 80 ? "…" : "");
                  } else {
                    roleDisplay = agent.role;
                  }

                  return (
                    <div key={agent.key}
                      className={`agent-node ${nodeClass} ${selectedNode === agent.key ? "selected" : ""}`}
                      onClick={() => setSelectedNode(agent.key)}
                    >
                      <div className="node-header">
                        <span className="node-symbol">{agent.symbol}</span>
                        <span className={`node-status-icon ${nodeClass}`}>{statusIcon}</span>
                      </div>
                      <div className="node-name">{agent.name}</div>
                      <div className="node-role" style={execSt?.status === "failed" ? { color: "#ff7070", fontSize: 10 } : {}}>
                        {roleDisplay}
                      </div>
                      {elapsed !== null && (
                        <div style={{ fontSize: 10, color: "var(--active)", fontFamily: "JetBrains Mono, monospace", marginTop: 4 }}>{elapsed}s</div>
                      )}
                      <div className="node-progress">
                        <div className="node-progress-bar" style={{ width: execSt?.status === "failed" ? "100%" : `${agent.prog}%`, background: execSt?.status === "failed" ? "#ff5050" : undefined }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="spacer-sm" />

              {/* B3C Backend Council */}
              <div className="flow-row">
                <div
                  className={`council-node ${stage === "council_backend" ? "thinking" : stage === "done" ? "done" : "idle"} ${selectedNode === "council_backend" ? "selected" : ""}`}
                  onClick={() => setSelectedNode("council_backend")}
                >
                  <div className="council-header">
                    <span className="council-title">B3C BACKEND COUNCIL</span>
                    <div className="council-members">
                      <span className="member-badge zeus-c">⚡</span>
                      <span className="member-badge poseidon-c">🔱</span>
                      <span className="member-badge hades-c">🏛</span>
                    </div>
                    {stage === "council_backend" && phaseElapsed !== null && (
                      <span className="phase-timer-badge">{phaseElapsed}s</span>
                    )}
                  </div>
                  {stage === "council_backend" && (() => {
                    const activeSpeakers = ["zeus","poseidon","hades"].filter(a =>
                      nodeStatus[`${a}:review`]?.status === "working"
                    );
                    return activeSpeakers.length > 0 ? (
                      <div className="council-speaker-row">
                        ■ {activeSpeakers.map(s => s.toUpperCase()).join(", ")} REVIEWING
                      </div>
                    ) : null;
                  })()}
                  <div className="council-chat-preview">
                    {councilBackendMessages.filter(m => m.text.length > 15).slice(-2).map((msg, i) => (
                      <div key={i} className="chat-line">
                        <span className={`speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}:</span>
                        {msg.text.slice(0, 80)}{msg.text.length > 80 ? "…" : ""}
                      </div>
                    ))}
                    {councilBackendMessages.length === 0 && (
                      <div className="chat-line" style={{ color: "var(--dim)" }}>Awaiting review...</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="spacer-sm" />

              {/* Output node */}
              <div className="flow-row">
                <div
                  className={`agent-node ${stage === "done" ? "done" : "idle"} ${selectedNode === "output" ? "selected" : ""}`}
                  style={{ width: 220, textAlign: "center" }}
                  onClick={() => setSelectedNode("output")}
                >
                  <div className="node-header" style={{ justifyContent: "center" }}>
                    <span className="node-symbol">✦</span>
                  </div>
                  <div className="node-name" style={{ textAlign: "center" }}>OUTPUT</div>
                  <div className="node-role" style={{ textAlign: "center" }}>
                    {stage === "done" && activeRequest?.channel
                      ? `Delivered · ${activeRequest.channel}`
                      : "Awaiting synthesis"}
                  </div>
                  <div className="node-progress">
                    <div className="node-progress-bar" style={{ width: stage === "done" ? "100%" : "0%" }} />
                  </div>
                </div>
              </div>

              {zeusDiagnostic && (
                <>
                  <div className="spacer-sm" />
                  <div className="flow-row">
                    <div className="zeus-diagnostic" style={{ maxWidth: 640 }}>
                      <div className="zeus-diagnostic-header">⚡ Zeus Diagnostic</div>
                      <div className="zeus-diagnostic-meta">
                        {zeusDiagnostic.agent?.toUpperCase()} · {zeusDiagnostic.phase} · Error: {zeusDiagnostic.error}
                      </div>
                      <div className="zeus-diagnostic-body">{zeusDiagnostic.diagnosis}</div>
                    </div>
                  </div>
                </>
              )}

              {outputText && (
                <>
                  <div className="spacer-sm" />
                  <div className="flow-row">
                    <div className="output-text-block">
                      <div className="output-text-header">
                        <span style={{ fontSize: 16 }}>✦</span>
                        <span>Synthesized Output</span>
                        {runStats && (
                          <span className="output-timing">
                            {runStats.elapsed ? `${(runStats.elapsed / 1000).toFixed(1)}s` : ""}
                            {runStats.councils ? ` · ${runStats.councils} councils` : ""}
                            {activeMission?.tier ? ` · ${activeMission.tier}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="output-text-body">{outputText}</div>
                    </div>
                  </div>
                </>
              )}

              <div style={{ height: 48 }} />
            </div>
          </div>
        </div>
    );
  };

  // ── GAIA VIEW — Telegram conversations + framework direct ─────────────────
  const renderGaia = () => {
    const gaiaConvBelongsTo = (m, uid, nameHint) =>
      (m.userId != null && String(m.userId) === uid) ||
      (m.channel || '').toLowerCase().includes(nameHint);
    const filtered = gaiaMessages.filter(m => {
      if (gaiaTab === "CARSON") return gaiaConvBelongsTo(m, "8150818650", 'carson');
      if (gaiaTab === "TYLER")  return gaiaConvBelongsTo(m, "874345067",  'tyler');
      return true;
    });
    const isThinking = activeMission?.status === "active";

    return (
      <>
        {renderSidebar()}
        <div className="gaia-area">
          <div className="gaia-symbol">🌿</div>
          <div className="gaia-label">GAIA</div>
          <div className="gaia-sublabel">RETROSPECTIVE · MEMORY</div>

          {/* User tabs */}
          <div className="gaia-tabs">
            {["ALL", "CARSON", "TYLER"].map(tab => (
              <button
                key={tab}
                className={`sidebar-tab ${gaiaTab === tab ? "active" : ""}`}
                style={{ borderColor: gaiaTab === tab ? "var(--gaia)" : undefined, color: gaiaTab === tab ? "var(--gaia)" : undefined }}
                onClick={() => { setGaiaTab(tab); setActiveUser(tab === "ALL" ? null : tab); }}
              >{tab}</button>
            ))}
          </div>

          {/* Framework direct response if a Gaia mission is active */}
          {activeMission && !outputText && isThinking && (
            <div className="direct-thinking" style={{ marginBottom: 20 }}>processing . . .</div>
          )}
          {activeMission && outputText && (
            <div className="direct-response" style={{ marginBottom: 20 }}>{outputText}</div>
          )}

          {/* Gaia Telegram conversations from webhook */}
          <div className="gaia-messages">
            {filtered.length === 0 ? (
              <div className="gaia-empty">
                {gaiaTab === "ALL"
                  ? "Gaia's conversations will appear here as they arrive."
                  : `No ${gaiaTab} conversations from Gaia yet.`}
              </div>
            ) : (
              filtered.map((m, i) => (
                <div key={i} className="gaia-message-item">
                  <div className="gaia-msg-meta">
                    {gaiaTab === "ALL" && m.userId && (
                      <span className="gaia-msg-user">
                        {m.userId === "8150818650" ? "CARSON" : m.userId === "874345067" ? "TYLER" : m.userId}
                      </span>
                    )}
                    <span className="gaia-msg-time">{new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="gaia-msg-question">{m.text}</div>
                  <div className="gaia-msg-response">{m.response}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  // ── GAIA SIDEBAR ─────────────────────────────────────────────────────────
  const renderGaiaSidebar = () => {
    const allConvs = Object.values(gaiaConversations)
      .sort((a, b) => b.timestamp - a.timestamp);
    const filtered = allConvs.filter(conv => {
      if (gaiaTab === "CARSON") return String(conv.userId) === "8150818650";
      if (gaiaTab === "TYLER")  return String(conv.userId) === "874345067";
      return true;
    });
    const lastRetro = gaiaRetrospectives[0] ?? null;

    return (
      <div className="gaia-sidebar">
        <div className="gaia-sidebar-section">
          <div className="gaia-sidebar-label">Gaia · Conversations</div>
          <div className="gaia-sidebar-tabs">
            {["ALL", "CARSON", "TYLER"].map(tab => (
              <button
                key={tab}
                className={`gaia-sidebar-tab ${gaiaTab === tab ? "active" : ""}`}
                onClick={() => { setGaiaTab(tab); setActiveUser(tab === "ALL" ? null : tab); }}
              >{tab}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="gaia-conv-empty">
              {gaiaTab === "ALL" ? "Gaia's conversations will appear here." : `No ${gaiaTab} conversations yet.`}
            </div>
          ) : (
            filtered.map(conv => {
              const firstUserMsg = conv.messages?.find(m => m.role === "user");
              const preview = firstUserMsg
                ? firstUserMsg.text.slice(0, 50) + (firstUserMsg.text.length > 50 ? "…" : "")
                : "…";
              const msgCount = conv.messages?.length ?? 0;
              const isActive = conv.id === activeGaiaConvId;
              const userLabel = conv.userId === "8150818650" ? "CARSON" : conv.userId === "874345067" ? "TYLER" : null;
              return (
                <div
                  key={conv.id}
                  className={`gaia-conv-card${isActive ? " active-conv" : ""}`}
                  onClick={() => { setActiveGaiaConvId(conv.id); setGaiaViewMode("chat"); }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    {userLabel && (
                      <span style={{ fontSize: 9, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", color: "var(--gaia)", opacity: 0.75 }}>
                        {userLabel}
                      </span>
                    )}
                    <span className="gaia-conv-card-time">{new Date(conv.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="gaia-conv-card-preview">{preview}</div>
                  <div className="gaia-conv-card-count">{msgCount} message{msgCount !== 1 ? "s" : ""}</div>
                </div>
              );
            })
          )}
        </div>
        <div className="gaia-sidebar-section" style={{ flex: 1 }}>
          <div className="gaia-sidebar-label">Gaia — Last Retrospective</div>
          {lastRetro ? (
            <>
              <div style={{ fontSize: 10, color: "var(--gaia)", opacity: 0.65, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", marginBottom: 7 }}>
                {new Date(lastRetro.timestamp).toLocaleString()} · {lastRetro.missions_reviewed} missions
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,188,148,0.72)", lineHeight: 1.75 }}>
                {lastRetro.text.slice(0, 230)}{lastRetro.text.length > 230 ? "…" : ""}
              </div>
            </>
          ) : gaiaReport ? (
            <>
              <div style={{ fontSize: 10, color: "var(--gaia)", opacity: 0.65, fontFamily: "Cinzel, serif", letterSpacing: "0.08em", marginBottom: 7 }}>
                GAIA · {gaiaReport.timestamp}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,188,148,0.72)", lineHeight: 1.75 }}>
                {gaiaReport.text}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: "rgba(120,216,122,0.22)", lineHeight: 1.75, fontStyle: "italic" }}>
              Gaia's nightly retrospective will appear here at 23:00.
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── GAIA TREE VIEW — Tree of Olympus ──────────────────────────────────────
  const renderGaiaTree = () => {
    const directiveGroups = {};
    for (const msg of gaiaDirectiveFeed) {
      if (!directiveGroups[msg.id]) directiveGroups[msg.id] = [];
      directiveGroups[msg.id].push(msg);
    }
    const directiveThreads = Object.values(directiveGroups).reverse().slice(0, 5);
    const selDef = selectedFruit ? FRUIT_DEFS.find(f => f.id === selectedFruit) : null;

    return (
      <>
        {renderGaiaSidebar()}

        {/* Center — toggle + tree or chat */}
        <div className="gaia-canvas-center">
          {/* View toggle + NEW CHAT */}
          <div className="gaia-view-toggle-bar" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="gaia-view-toggle">
              <button
                className={`gaia-toggle-btn ${gaiaViewMode === "tree" ? "active" : ""}`}
                onClick={() => setGaiaViewMode("tree")}
              >🌳 TREE</button>
              <button
                className={`gaia-toggle-btn ${gaiaViewMode === "chat" ? "active" : ""}`}
                onClick={() => setGaiaViewMode("chat")}
              >🌿 CHAT</button>
              <button
                className={`gaia-toggle-btn ${gaiaViewMode === "council" ? "active" : ""}`}
                onClick={() => setGaiaViewMode("council")}
              >⚖ COUNCIL</button>
            </div>
            {gaiaViewMode === "chat" && (
              <button
                className="gaia-new-chat-btn"
                onClick={() => {
                  setActiveGaiaConvId(null);
                  setGaiaThinking(false);
                  setGaiaPendingText("");
                }}
                title="Start a new conversation"
              >NEW CHAT</button>
            )}
          </div>

          {gaiaViewMode === "tree" ? (
            <GaiaTree
              fruitRipeness={fruitRipeness}
              activePulses={activePulses}
              selectedFruit={selectedFruit}
              onFruitClick={setSelectedFruit}
              sshCtrlPulse={sshCtrlPulse}
            />
          ) : gaiaViewMode === "council" ? (
            /* Council mode — OLYMPUS CHANNEL two-sided thread */
            <div className="gaia-council-view">
              {(() => {
                const directiveGroups = {};
                for (const msg of gaiaDirectiveFeed) {
                  if (!directiveGroups[msg.id]) directiveGroups[msg.id] = [];
                  directiveGroups[msg.id].push(msg);
                }
                const threads = Object.values(directiveGroups);
                if (threads.length === 0 && !gaiaCouncilSending) {
                  return (
                    <div className="gaia-council-empty">
                      <div style={{ fontSize: 28, marginBottom: 10 }}>⚖</div>
                      <div style={{ fontSize: 14, letterSpacing: "0.15em" }}>OLYMPUS CHANNEL · OPEN</div>
                      <div style={{ opacity: 0.45, marginTop: 8, fontSize: 13 }}>
                        Send a message to initiate a council conversation
                      </div>
                    </div>
                  );
                }
                return (
                  <>
                    {threads.map((thread, ti) => (
                      <div key={ti} className="gaia-council-exchange">
                        {thread.map((msg, mi) => (
                          <div key={mi} className={`gaia-council-msg ${msg.speaker === "gaia" ? "gaia-left" : "council-right"}`}>
                            <div className={`gaia-council-speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}</div>
                            <div className="gaia-council-text">{msg.text}</div>
                            <div className="gaia-council-meta">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" · "}{msg.phase?.replace(/_/g, " ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    {gaiaCouncilSending && (
                      <div className="gaia-council-msg gaia-left">
                        <div className="gaia-council-speaker gaia">GAIA</div>
                        <div className="gaia-chat-thinking">
                          <span className="gaia-thinking-dot" />
                          <span className="gaia-thinking-dot" />
                          <span className="gaia-thinking-dot" />
                          <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 13 }}>Opening the OLYMPUS CHANNEL…</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            /* Chat mode */
            <div className="gaia-chat-view">
              <div className="gaia-chat-messages" ref={gaiaChatRef}>
                {(() => {
                  const activeGaiaConv = gaiaConversations[activeGaiaConvId];
                  const messages = activeGaiaConv?.messages ?? [];
                  const userLabel = activeGaiaConv?.userId === "8150818650" ? "CARSON"
                    : activeGaiaConv?.userId === "874345067" ? "TYLER" : "YOU";

                  if (messages.length === 0 && !gaiaThinking) {
                    return (
                      <div className="gaia-chat-empty">
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🌿</div>
                        <div>Send a message to begin your conversation with Gaia</div>
                      </div>
                    );
                  }

                  return (
                    <>
                      {messages.map((msg, i) => (
                        msg.role === "user" ? (
                          <div key={i} className="gaia-chat-entry" style={{ marginBottom: 0 }}>
                            <div className="gaia-chat-user-label">
                              {userLabel} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            <div className="gaia-chat-user-msg">{msg.text}</div>
                          </div>
                        ) : (
                          <div key={i} className="gaia-chat-entry">
                            <div className="gaia-chat-gaia-label">🌿 GAIA</div>
                            <div className="gaia-chat-gaia-msg">{msg.text}</div>
                          </div>
                        )
                      ))}
                      {gaiaThinking && (
                        <div className="gaia-chat-entry">
                          <div className="gaia-chat-user-label">{userLabel}</div>
                          <div className="gaia-chat-user-msg">{gaiaPendingText}</div>
                          <div className="gaia-chat-thinking">
                            <span className="gaia-thinking-dot" /><span className="gaia-thinking-dot" /><span className="gaia-thinking-dot" />
                            <span style={{ marginLeft: 8, opacity: 0.7 }}>Gaia is contemplating…</span>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — always visible: OLYMPUS CHANNEL or fruit detail */}
        <div className="gaia-right-panel">
          {selDef ? (
            /* Fruit detail */
            <>
              <div className="gaia-panel-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24, filter: `drop-shadow(0 0 10px ${selDef.color})` }}>{selDef.symbol}</span>
                  <div>
                    <div className="gaia-panel-title" style={{ color: selDef.color }}>{selDef.label}</div>
                    <div className="gaia-panel-subtitle">{FRUIT_INFO[selectedFruit]?.domain}</div>
                  </div>
                </div>
                <button className="fruit-panel-close" onClick={() => setSelectedFruit(null)}>✕</button>
              </div>
              <div className="gaia-panel-body">
                <FruitDetailContent
                  fruitId={selectedFruit}
                  ripeness={fruitRipeness[selectedFruit] || 0}
                  growthHistory={gaiaGrowthHistory[selectedFruit] || []}
                />
              </div>
            </>
          ) : (
            /* OLYMPUS CHANNEL */
            <>
              <div className="gaia-panel-header">
                <div>
                  <div className="gaia-panel-title">OLYMPUS CHANNEL</div>
                  <div className="gaia-panel-subtitle">Gaia ↔ Council · Live Feed</div>
                </div>
              </div>
              <div className="gaia-channel-tabs">
                {["DIRECTIVES", "RETROSPECTIVE", "CONVERSATIONS", "SSH CTRL"].map(tab => (
                  <button key={tab} className={`gaia-feed-tab ${gaiaFeedTab === tab ? "active" : ""}${tab === "SSH CTRL" && gaiaSSHLog.length > 0 ? " ssh-tab-active" : ""}`}
                    onClick={() => setGaiaFeedTab(tab)}>{tab}</button>
                ))}
              </div>
              <div className="gaia-panel-body">

                {/* DIRECTIVES */}
                {gaiaFeedTab === "DIRECTIVES" && (
                  directiveThreads.length === 0
                    ? <div className="gaia-feed-empty">GAIA · WATCHING THE COUNCIL</div>
                    : directiveThreads.map((thread, ti) => (
                      <div key={ti} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(120,216,122,0.08)" }}>
                        {thread.map((msg, mi) => (
                          <div key={mi} className={`olympus-msg ${msg.speaker === "gaia" ? "gaia-side" : "council-side"}`}>
                            <div className={`gaia-feed-speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}</div>
                            <div className="gaia-feed-text">{msg.text.slice(0, 260)}{msg.text.length > 260 ? "…" : ""}</div>
                            <div className="gaia-feed-meta">{new Date(msg.timestamp).toLocaleTimeString()} · {msg.phase?.replace(/_/g, " ")}</div>
                          </div>
                        ))}
                      </div>
                    ))
                )}

                {/* RETROSPECTIVE */}
                {gaiaFeedTab === "RETROSPECTIVE" && (
                  gaiaRetrospectives.length === 0
                    ? <div className="gaia-feed-empty">NIGHTLY RETROSPECTIVES · 23:00</div>
                    : gaiaRetrospectives.slice(0, 5).map((r, i) => (
                      <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid rgba(120,216,122,0.07)" }}>
                        <div className="gaia-feed-meta" style={{ color: "var(--gaia)", marginBottom: 6 }}>
                          {new Date(r.timestamp).toLocaleString()} · {r.missions_reviewed} missions reviewed
                        </div>
                        <div className="gaia-feed-text">{r.text.slice(0, 450)}{r.text.length > 450 ? "…" : ""}</div>
                      </div>
                    ))
                )}

                {/* CONVERSATIONS */}
                {gaiaFeedTab === "CONVERSATIONS" && (
                  gaiaMessages.length === 0
                    ? <div className="gaia-feed-empty">GAIA'S CONVERSATIONS APPEAR HERE</div>
                    : gaiaMessages.slice(0, 10).map((m, i) => (
                      <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(120,216,122,0.07)" }}>
                        <div className="gaia-feed-text" style={{ color: "var(--muted)", marginBottom: 4 }}>
                          {m.text.slice(0, 90)}{m.text.length > 90 ? "…" : ""}
                        </div>
                        <div className="gaia-feed-text">{m.response.slice(0, 220)}{m.response.length > 220 ? "…" : ""}</div>
                        <div className="gaia-feed-meta" style={{ marginTop: 4 }}>
                          {new Date(m.timestamp).toLocaleTimeString()} · {m.channel}
                        </div>
                      </div>
                    ))
                )}

                {/* SSH CTRL — intervention log */}
                {gaiaFeedTab === "SSH CTRL" && (
                  gaiaSSHLog.length === 0
                    ? <div className="gaia-feed-empty">NO INTERVENTIONS · SYSTEMS NOMINAL</div>
                    : gaiaSSHLog.map((entry, i) => (
                      <div key={i} className={`gaia-ssh-entry ${entry.ok ? "ok" : "failed"}`}>
                        <div className="gaia-ssh-header">
                          <span className={`gaia-ssh-status ${entry.ok ? "ok" : "failed"}`}>{entry.ok ? "✓" : "✗"}</span>
                          <span className="gaia-ssh-node">{entry.node.toUpperCase()}</span>
                          <span className="gaia-ssh-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="gaia-ssh-command"><code>{entry.command}</code></div>
                        <div className="gaia-ssh-reason">{entry.reason}</div>
                        <div className="gaia-ssh-result">{entry.result.slice(0, 200)}{entry.result.length > 200 ? "…" : ""}</div>
                      </div>
                    ))
                )}
              </div>
            </>
          )}
        </div>
      </>
    );
  };

  // ── Route to correct view ──────────────────────────────────────────────────

  // ── Cinematic Takeover Render ──────────────────────────────────────────────
  const renderCinematicTakeover = () => {
    if (!cinematicOpen || !activeMission) return null;

    const tierLabel = activeMission.tier === "TIER_2" ? "TIER II" : activeMission.tier === "TIER_3" ? "TIER III" : activeMission.tier || "TIER";

    // Reuse the existing mode view (renderTier2 or renderTier3) for the left panel
    const leftContent = mode === "tier2" ? renderTier2() : renderTier3();

    return (
      <div className="cinematic-takeover">
        <button className="cinematic-exit" onClick={() => setCinematicOpen(false)}>\u2715 EXIT</button>

        {/* LEFT PANEL \u2014 existing flow/tier view, resized to fit */}
        <div className="cinematic-left">
          <div className="cinematic-tier-badge">
            <span className="tier-label">{tierLabel}</span>
            <span className="cinematic-mission-text">{activeRequest?.text || "Mission active"}</span>
          </div>
          <div className="cinematic-flow-wrap">
            {leftContent}
          </div>
        </div>

        {/* RIGHT PANEL \u2014 council conversation */}
        <div className="cinematic-right">
          <div className="cinematic-right-header">COUNCIL DELIBERATION</div>

          <div className="cinematic-council-section" ref={cinematicCouncilRef}>
            {councilMessages.length > 0 && (
              <>
                <div className="cinematic-phase-label">INITIAL COUNCIL</div>
                <VoteStamps messages={councilMessages} missionId={activeMissionId} />
                <CouncilThread messages={councilMessages} />
              </>
            )}

            {councilBackendMessages.length > 0 && (
              <>
                <div className="cinematic-phase-label" style={{ marginTop: 20 }}>BACKEND REVIEW</div>
                <VoteStamps messages={councilBackendMessages} missionId={activeMissionId} />
                <CouncilThread messages={councilBackendMessages} />
              </>
            )}

            {councilMessages.length === 0 && councilBackendMessages.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", marginTop: 40 }}>
                Council has not convened yet...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderModeView = () => {
    if (gaiaMode) return renderGaiaTree();
    switch (mode) {
      case "classifying":   return <>{renderSidebar()}<CouncilChamber nodeHealth={nodeHealth} classifying /></>;
      case "tier1":         return renderTier1();
      case "tier2":         return renderTier2();
      case "zeus_protocol": return renderDirect();
      case "poseidon":      return renderDirect();
      case "hades":         return renderDirect();
      default:              return renderTier3(); // tier3
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{FONTS + css}</style>
      <div className={`dashboard mode-${effectiveMode}`}>
        <StarField />

        {/* Cinematic takeover for T2/T3 */}
        {renderCinematicTakeover()}

        {/* Topbar */}
        <div className="topbar">
          <div className="logo">
            <span className="logo-mark">⚡</span>
            MOUNT OLYMPUS
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Top-mode toggle */}
            <div className="top-toggle">
              {["council", "olympus", "record", "flywheel"].map(v => (
                <button
                  key={v}
                  className={`top-toggle-btn ${topView === v ? "active" : ""}`}
                  onClick={() => {
                    if (v === "record" && topView !== "record") {
                      if (!gaiaMode) toggleGaiaMode();
                    } else if (v !== "record" && gaiaMode) {
                      toggleGaiaMode();
                    }
                    setTopView(v);
                  }}
                >{v.toUpperCase()}</button>
              ))}
            </div>

            {/* Node health dropdown trigger */}
            <div ref={nodeHealthRef} style={{ position: "relative" }}>
              <button
                className="node-health-btn"
                onClick={() => setNodeHealthOpen(o => !o)}
              >NODE HEALTH {nodeHealthOpen ? "▴" : "▾"}</button>

              {nodeHealthOpen && (
                <div className="node-health-expanded">
                  {["ZEUS", "POSEIDON", "HADES", "GAIA"].map(n => {
                    const headStatus = nodeHealth[n] === true ? "online" : nodeHealth[n] === false ? "offline" : "";
                    const quorum = QUORUM_MAP[n] || [];
                    return (
                      <div key={n} className="node-health-group">
                        <div className="node-health-head">
                          <div className={`node-chip ${headStatus}`}>
                            <span className="dot" />
                            {n}
                          </div>
                        </div>
                        {quorum.length > 0 && (
                          <div className="quorum-row">
                            {quorum.map(q => (
                              <div key={q} className={`quorum-chip ${headStatus}`}>
                                <span className="dot" />
                                {q.toUpperCase()}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* WebSocket status */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 4, background: "var(--bg3)", border: `1px solid ${wsStatus === "live" ? "rgba(94,232,176,0.3)" : wsStatus === "connecting" ? "rgba(240,192,96,0.3)" : "rgba(255,80,80,0.3)"}`, fontSize: 11, letterSpacing: "0.1em", color: wsStatus === "live" ? "var(--done)" : wsStatus === "connecting" ? "var(--active)" : "#ff5050" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: wsStatus === "live" ? "var(--done)" : wsStatus === "connecting" ? "var(--active)" : "#ff5050", boxShadow: wsStatus === "live" ? "0 0 5px var(--done)" : "none", animation: wsStatus === "live" ? "pulse-dot 2s ease infinite" : "none" }} />
              {wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "CONNECTING" : "DISCONNECTED"}
            </div>
            <div className="topbar-time">{time} · LOCAL</div>
          </div>
        </div>

        {/* Mode canvas — routed by topView */}
        {topView === "council" && (
          <div className="main-canvas" key={effectiveMode}>
            {renderModeView()}
          </div>
        )}

        {topView === "olympus" && <OlympusView />}

        {topView === "record" && (
          <div className="main-canvas" key="record">
            {renderGaiaTree()}
          </div>
        )}

        {topView === "flywheel" && (
          <div className="main-canvas" key="flywheel">
            <FlywheelView />
          </div>
        )}

        {/* Input bar */}
        <div className={`input-bar${gaiaMode ? " gaia-input-bar" : ""}`}>
          <div className="input-inner">
            <div className="input-unified">
              <textarea
                className="input-textarea"
                placeholder={
                  gaiaMode && gaiaViewMode === "council" ? "Open the OLYMPUS CHANNEL — address the B3C Council…" :
                  gaiaMode                ? "Speak to Gaia — she is listening..." :
                  mode === "zeus_protocol" ? "Transmit to Zeus directly..." :
                  mode === "poseidon"      ? "Speak to Poseidon..." :
                  mode === "hades"         ? "Speak to Hades..." :
                  mode === "tier1"         ? "Ask Zeus directly..." :
                  "Enter a request for the council..."
                }
                value={sendText}
                onChange={e => setSendText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gaiaMode ? handleGaiaSend() : handleSend(); }}
                disabled={sending}
              />
              <div className="input-controls">
                {!gaiaMode && (
                  <div className="route-selector">
                    <button className="route-current" onClick={() => setRouteOpen(o => !o)} disabled={sending}>
                      <span className={`route-chevron ${routeOpen ? "open" : ""}`}>▾</span>
                      {({B3C_COUNCIL:"B3C COUNCIL",ZEUS_PROTOCOL:"ZEUS PROTOCOL",POSEIDON:"POSEIDON",HADES:"HADES"})[sendTarget] || "B3C COUNCIL"} → {activeUser || "ALL"}
                    </button>
                    {routeOpen && (
                      <div className="route-dropdown">
                        {[
                          { id: "B3C_COUNCIL",   label: "B3C COUNCIL" },
                          { id: "ZEUS_PROTOCOL", label: "ZEUS PROTOCOL" },
                          { id: "POSEIDON",      label: "POSEIDON" },
                          { id: "HADES",         label: "HADES" },
                        ].map(t => (
                          <button
                            key={t.id}
                            className={`route-option ${sendTarget === t.id ? "active" : ""}`}
                            onClick={() => { setSendTarget(t.id); setRouteOpen(false); }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  className={`user-context-btn ${activeUser ? "user-active" : "user-none"}`}
                  onClick={() => setActiveUser(u => u === null ? "CARSON" : u === "CARSON" ? "TYLER" : null)}
                  title="Active user — click to cycle"
                >
                  {activeUser ? `· ${activeUser}` : "· ALL USERS"}
                </button>
                {!gaiaMode && (
                  <button
                    className={`priority-btn ${sendPriority ? "active" : ""}`}
                    onClick={() => setSendPriority(p => !p)}
                    title="Priority — Zeus evaluates whether this mission should jump the queue"
                  >⚡ PRIORITY</button>
                )}
                <button
                  className={`send-arrow${gaiaMode ? " gaia-send-btn" : ""} ${sending ? "sending" : ""}`}
                  onClick={gaiaMode ? handleGaiaSend : handleSend}
                  disabled={sending || !sendText.trim()}
                  title={sending ? "Sending..." : "Send"}
                >
                  {sending ? "·" : "↑"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
