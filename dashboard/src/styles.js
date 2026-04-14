export const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@700&family=JetBrains+Mono:wght@300;400;500&display=swap')`;

export const css = `
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
  .spacer    { height: 50px; }
  .spacer-sm { height: 40px; }

  .agent-node {
    width: 195px; border: 1px solid var(--border); border-radius: 6px;
    background: linear-gradient(160deg, rgba(14,18,38,0.97) 0%, rgba(7,9,20,0.98) 100%);
    padding: 10px 12px 8px; cursor: pointer; transition: all 0.35s;
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

  .node-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .node-symbol { font-size: 20px; line-height: 1; filter: drop-shadow(0 0 6px currentColor); }
  .node-status-icon { font-size: 13px; color: var(--muted); }
  .node-status-icon.thinking { color: var(--active); animation: blink 1s step-end infinite; }
  .node-status-icon.done     { color: var(--done); }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  .node-name { font-family: 'Cinzel', serif; font-size: 13px; font-weight: 600; letter-spacing: 0.10em; color: var(--text); margin-bottom: 2px; }
  .node-role { font-size: 10px; color: var(--muted); letter-spacing: 0.05em; line-height: 1.25; }
  .node-progress { margin-top: 6px; height: 2px; background: var(--bg2); border-radius: 2px; overflow: hidden; }
  .node-progress-bar { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
  .thinking .node-progress-bar { background: linear-gradient(90deg, var(--gold), var(--gold2)); box-shadow: 0 0 8px var(--gold2); animation: progress-pulse 1.5s ease infinite; }
  .done     .node-progress-bar { background: linear-gradient(90deg, var(--done), rgba(94,232,176,0.7)); box-shadow: 0 0 6px var(--done); width: 100% !important; }
  @keyframes progress-pulse { 0%, 100% { opacity: 0.65; } 50% { opacity: 1; box-shadow: 0 0 12px var(--gold2), 0 0 20px rgba(232,184,75,0.3); } }

  .council-node {
    width: 520px; border: 1px solid var(--border); border-radius: 8px;
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
  .detail-panel { width: 500px; border-left: 1px solid var(--border); background: rgba(9,12,24,0.88); display: flex; flex-direction: column; flex-shrink: 0; transition: width 0.3s ease; overflow: hidden; backdrop-filter: blur(8px); box-shadow: inset 1px 0 0 rgba(42,53,96,0.3); }
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
  /* Panel tab toggle */
  .panel-tabs { display: flex; gap: 0; margin: 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .panel-tab { flex: 1; padding: 10px 0; font-size: 11px; font-family: 'Cinzel', serif; letter-spacing: 0.18em; text-transform: uppercase; border: none; background: transparent; color: var(--muted); cursor: pointer; text-align: center; transition: color 0.25s, background 0.25s; border-bottom: 2px solid transparent; }
  .panel-tab:hover:not(.active) { color: var(--text); background: rgba(200,150,10,0.03); }
  .panel-tab.active { color: var(--gold2); border-bottom-color: var(--gold); background: rgba(200,150,10,0.05); }


  .thought-block { background: linear-gradient(160deg, rgba(13,18,37,0.9) 0%, rgba(7,9,20,0.95) 100%); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; font-size: 12px; line-height: 1.8; color: var(--text); margin-bottom: 8px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03); }
  .thought-block::before { content: ''; position: absolute; top: 6px; left: 0; width: 2px; height: calc(100% - 12px); border-radius: 0 2px 2px 0; background: var(--gold); box-shadow: 0 0 6px var(--gold); opacity: 0.7; }

  @keyframes chat-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .chat-message   { display: flex; flex-direction: column; margin-bottom: 20px; animation: chat-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; background: linear-gradient(160deg, rgba(12,16,35,0.98) 0%, rgba(8,10,22,0.99) 100%); border: 1px solid rgba(42,53,96,0.5); border-left: none; border-radius: 0 8px 8px 0; overflow: visible; box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03); position: relative; }
  .chat-message::before { content: ''; position: absolute; top: -1px; left: 0; width: 6px; height: calc(100% + 2px); border-radius: 6px 0 0 6px; }
  .chat-message.zeus-msg::before    { background: var(--zeus);     box-shadow: 0 0 16px rgba(232,184,75,0.5), 0 0 4px rgba(232,184,75,0.8); }
  .chat-message.poseidon-msg::before { background: var(--poseidon); box-shadow: 0 0 16px rgba(74,184,232,0.5), 0 0 4px rgba(74,184,232,0.8); }
  .chat-message.hades-msg::before    { background: var(--hades);    box-shadow: 0 0 16px rgba(176,74,220,0.5), 0 0 4px rgba(176,74,220,0.8); }
  .chat-msg-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px 8px 22px; }
  .chat-avatar    { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .chat-avatar.zeus     { background: rgba(232,184,75,0.15); border: 1px solid rgba(232,184,75,0.3); }
  .chat-avatar.poseidon { background: rgba(74,184,232,0.15); border: 1px solid rgba(74,184,232,0.3); }
  .chat-avatar.hades    { background: rgba(176,74,220,0.15); border: 1px solid rgba(176,74,220,0.3); }
  .chat-content { flex: 1; }
  .chat-speaker { font-size: 15px; letter-spacing: 0.14em; font-family: 'Cinzel', serif; font-weight: 600; }
  .chat-speaker.zeus     { color: var(--zeus); }
  .chat-speaker.poseidon { color: var(--poseidon); }
  .chat-speaker.hades    { color: var(--hades); }
  .chat-text { font-size: 15px; line-height: 1.85; color: var(--text); padding: 4px 18px 16px 22px; }

  .vote-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 3px; font-size: 11px; letter-spacing: 0.1em; margin-top: 4px; font-family: 'Cinzel', serif; }
  .vote-badge.approve { background: rgba(94,232,176,0.12); border: 1px solid rgba(94,232,176,0.4); color: var(--done); box-shadow: 0 0 10px rgba(94,232,176,0.15); }
  .vote-badge.calling { background: rgba(240,192,96,0.08); border: 1px solid rgba(240,192,96,0.3); color: var(--active); }
  .vote-badge.aye     { background: rgba(94,232,176,0.06); border: 1px solid rgba(94,232,176,0.2); color: rgba(94,232,176,0.7); }

  /* Gaia summary card styles */
  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: 200px 0; }
  }
  .gaia-shimmer {
    height: 14px; border-radius: 3px; margin: 6px 0;
    background: linear-gradient(90deg, rgba(120,216,122,0.04) 0%, rgba(120,216,122,0.12) 50%, rgba(120,216,122,0.04) 100%);
    background-size: 200px 100%; animation: shimmer 1.8s ease-in-out infinite;
  }
  .gaia-shimmer-short { width: 65%; }
  .gaia-shimmer-long  { width: 90%; }
  .gaia-summary-text {
    font-size: 14px; line-height: 1.75; color: rgba(120,216,122,0.85);
    font-style: italic; padding: 0 18px 4px 22px;
  }
  .gaia-summary-label {
    font-size: 9px; letter-spacing: 0.18em; color: rgba(120,216,122,0.4);
    text-transform: uppercase; padding: 0 18px 0 22px; font-family: 'Cinzel', serif;
  }
  .card-expand-btn {
    display: flex; align-items: center; gap: 4px; padding: 6px 18px 10px 22px;
    font-size: 10px; color: var(--muted); letter-spacing: 0.1em; cursor: pointer;
    border: none; background: none; font-family: 'JetBrains Mono', monospace;
    transition: color 0.2s;
  }
  .card-expand-btn:hover { color: var(--text); }
  .card-expand-btn .chevron { transition: transform 0.25s; display: inline-block; }
  .card-expand-btn .chevron.open { transform: rotate(180deg); }
  .card-full-text {
    font-size: 13px; line-height: 1.7; color: var(--text); padding: 0 18px 14px 22px;
    border-top: 1px solid var(--border); margin-top: 6px; padding-top: 10px;
    opacity: 0.8;
  }

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

  /* ── B3C Quorum Panel (Phase 6) ─────────────────────────────── */
  .quorum-panel {
    margin-top: 12px; padding: 10px 12px;
    border: 1px solid var(--border); border-radius: 6px;
    background: rgba(5,7,15,0.55);
    font-size: 11px;
  }
  .quorum-panel.compact { padding: 6px 10px; }
  .quorum-section { margin-bottom: 10px; }
  .quorum-section:last-child { margin-bottom: 0; }
  .quorum-section-label {
    font-family: 'Cinzel', serif; font-size: 8px; letter-spacing: 0.2em;
    color: var(--muted); text-transform: uppercase; margin-bottom: 6px;
  }
  .quorum-section-count { margin-left: 6px; color: var(--gold2); font-family: 'JetBrains Mono', monospace; letter-spacing: 0; }

  .quorum-assignments { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .quorum-assignment-item { display: flex; gap: 8px; font-size: 10px; color: var(--text); line-height: 1.5; }
  .quorum-assignment-spark { color: var(--gold2); font-family: 'Cinzel', serif; letter-spacing: 0.08em; min-width: 80px; flex-shrink: 0; }
  .quorum-assignment-task { color: var(--text); opacity: 0.85; flex: 1; }

  .quorum-spark-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; }
  .spark-card {
    border: 1px solid var(--border); border-radius: 4px;
    background: rgba(13,18,37,0.7);
    padding: 6px 8px; transition: border-color 0.3s, opacity 0.3s;
  }
  .spark-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .spark-card-name { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 0.08em; color: var(--text); }
  .spark-card-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); }
  .spark-dot-complete { background: var(--done); box-shadow: 0 0 4px var(--done); }
  .spark-dot-working  { background: var(--active); box-shadow: 0 0 4px var(--active); animation: pulse-dot 1s ease infinite; }
  .spark-dot-failed   { background: #ff5050; box-shadow: 0 0 4px #ff5050; }
  .spark-card-output { font-size: 9px; line-height: 1.5; color: var(--muted); }
  .spark-card-error  { font-size: 9px; line-height: 1.5; color: #ff8080; }
  .spark-card-pending { font-size: 9px; color: var(--dim); font-style: italic; }
  .spark-complete { border-color: rgba(94,232,176,0.25); }
  .spark-failed   { border-color: rgba(255,80,80,0.3); }

  /* B3C-style badge + confidence on spark cards */
  .spark-card-head { gap: 6px; }
  .spark-card-badge {
    font-family: 'Cinzel', serif; font-size: 7px; letter-spacing: 0.1em;
    padding: 1px 5px; border: 1px solid var(--border); border-radius: 2px;
    color: var(--muted); background: transparent;
    text-transform: uppercase;
  }
  .spark-badge-working  { color: var(--active); border-color: rgba(240,192,96,0.4); background: rgba(240,192,96,0.06); }
  .spark-badge-complete { color: var(--done); border-color: rgba(94,232,176,0.35); background: rgba(94,232,176,0.05); }
  .spark-badge-failed   { color: #ff8080; border-color: rgba(255,80,80,0.35); background: rgba(255,80,80,0.05); }
  .spark-card-confidence {
    margin-left: auto;
    font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--gold2);
    letter-spacing: 0;
  }
  .spark-card-deliverable {
    font-size: 9px; line-height: 1.55; color: var(--text);
    opacity: 0.85; margin: 3px 0 4px;
    padding-bottom: 3px; border-bottom: 1px dashed var(--border);
  }
  .spark-card-finding {
    font-size: 9.5px; line-height: 1.6; color: var(--text);
    margin-top: 2px;
  }

  .quorum-backend { display: flex; flex-direction: column; gap: 6px; }
  .quorum-backend-msg { display: flex; gap: 8px; font-size: 10px; line-height: 1.5; }
  .quorum-backend-speaker { font-family: 'Cinzel', serif; letter-spacing: 0.08em; color: var(--gold2); min-width: 80px; flex-shrink: 0; font-size: 9px; }
  .quorum-backend-text { color: var(--text); opacity: 0.88; flex: 1; }

  .smoke-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .smoke-strip-label { font-family: 'Cinzel', serif; font-size: 8px; letter-spacing: 0.18em; color: var(--muted); margin-right: 4px; }
  .smoke-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 7px; border: 1px solid var(--border); border-radius: 3px;
    font-size: 9px; letter-spacing: 0.06em; font-family: 'Cinzel', serif;
    color: var(--muted);
  }
  .smoke-chip-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); }
  .smoke-ok { border-color: rgba(94,232,176,0.3); color: var(--done); }
  .smoke-ok .smoke-chip-dot { background: var(--done); box-shadow: 0 0 4px var(--done); }
  .smoke-failed { border-color: rgba(255,80,80,0.3); color: #ff8080; }
  .smoke-failed .smoke-chip-dot { background: #ff5050; box-shadow: 0 0 4px #ff5050; }
  .smoke-unknown .smoke-chip-dot { background: var(--dim); }

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
