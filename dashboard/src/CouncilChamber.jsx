/**
 * CouncilChamber.jsx — B3C Council idle state
 * Constellation background + Greek throne chamber with agent logos
 */
import { useEffect, useRef } from "react";

// ── Sacred Geometry Background Canvas ────────────────────────────────────────
// 5 layers: particles, Metatron's Cube, orbital rings, edge geometry, radial lines
function SacredGeometryCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H, cx, cy;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      cx = W / 2; cy = H / 2;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── LAYER 1: Particle drift ──────────────────────────────────────────
    const particles = Array.from({ length: 150 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.2 + Math.random() * 0.6,
      baseA: 0.04 + Math.random() * 0.11,
      ph: Math.random() * Math.PI * 2,
      sp: 0.0003 + Math.random() * 0.0008,
      vy: -(0.003 + Math.random() * 0.008), // upward drift
      vx: (Math.random() - 0.5) * 0.002,     // lateral wobble
    }));

    // ── LAYER 2: Metatron's Cube geometry ────────────────────────────────
    // 13 circles: 1 center + 6 inner ring + 6 outer ring
    const R_INNER = 0.12; // as fraction of min(W,H)
    const R_OUTER = 0.24;
    const CIRCLE_R = 0.035;

    function getMetatronCircles(outerRot, innerRot) {
      const circles = [{ x: 0, y: 0, ring: "center" }]; // center
      for (let i = 0; i < 6; i++) {
        const a = innerRot + (i * Math.PI * 2) / 6;
        circles.push({ x: Math.cos(a) * R_INNER, y: Math.sin(a) * R_INNER, ring: "inner" });
      }
      for (let i = 0; i < 6; i++) {
        const a = outerRot + (i * Math.PI * 2) / 6;
        circles.push({ x: Math.cos(a) * R_OUTER, y: Math.sin(a) * R_OUTER, ring: "outer" });
      }
      return circles;
    }

    // Pre-compute all 78 connection lines (every pair of 13 circles)
    const metLines = [];
    for (let i = 0; i < 13; i++) {
      for (let j = i + 1; j < 13; j++) {
        metLines.push([i, j]);
      }
    }

    // ── LAYER 3: Orbital rings ───────────────────────────────────────────
    const orbits = [
      { r: 0.16, color: "232,184,75",  dots: 3, speed: 1 / 15000, phase: 0 },       // gold - Zeus
      { r: 0.28, color: "74,184,232",  dots: 2, speed: 1 / 18000, phase: 0.3 },     // blue - Poseidon
      { r: 0.38, color: "176,74,220",  dots: 2, speed: 1 / 22000, phase: 0.6 },     // purple - Hades
    ];

    // ── LAYER 4: Edge geometry shapes ────────────────────────────────────
    // Each shape: position (normalized), type, rotation speed, size
    const edgeShapes = [
      // Corners
      { x: 0.08, y: 0.08, type: "hexagon",  sz: 0.06, rotSpeed: 1/45000, innerScale: 0.6 },
      { x: 0.92, y: 0.08, type: "triangle", sz: 0.05, rotSpeed: 1/55000, innerScale: 0.6 },
      { x: 0.08, y: 0.92, type: "diamond",  sz: 0.05, rotSpeed: 1/65000, innerScale: 0.6 },
      { x: 0.92, y: 0.92, type: "pentagon", sz: 0.05, rotSpeed: 1/75000, innerScale: 0.6 },
      // Top edge
      { x: 0.33, y: 0.06, type: "star6",    sz: 0.035, rotSpeed: 1/60000, innerScale: 0.65 },
      { x: 0.67, y: 0.06, type: "star6",    sz: 0.035, rotSpeed: 1/70000, innerScale: 0.65 },
      // Bottom edge
      { x: 0.33, y: 0.94, type: "octagon",  sz: 0.035, rotSpeed: 1/80000, innerScale: 0.65 },
      { x: 0.67, y: 0.94, type: "octagon",  sz: 0.035, rotSpeed: 1/90000, innerScale: 0.65 },
      // Left edge
      { x: 0.05, y: 0.50, type: "vesica",   sz: 0.045, rotSpeed: 1/50000, innerScale: 0.7 },
      // Right edge
      { x: 0.95, y: 0.50, type: "triCircle", sz: 0.04, rotSpeed: 1/55000, innerScale: 0.7 },
    ];

    function drawPolygon(px, py, r, sides, rot) {
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = rot + (i * Math.PI * 2) / sides - Math.PI / 2;
        const x = px + Math.cos(a) * r;
        const y = py + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    function drawShape(shape, px, py, r, rot, alpha) {
      ctx.strokeStyle = `rgba(200, 175, 110, ${alpha})`;
      ctx.lineWidth = 0.5;

      switch (shape.type) {
        case "hexagon": drawPolygon(px, py, r, 6, rot); ctx.stroke(); break;
        case "triangle": drawPolygon(px, py, r, 3, rot); ctx.stroke(); break;
        case "diamond": drawPolygon(px, py, r, 4, rot); ctx.stroke(); break;
        case "pentagon": drawPolygon(px, py, r, 5, rot); ctx.stroke(); break;
        case "octagon": drawPolygon(px, py, r, 8, rot); ctx.stroke(); break;
        case "star6": {
          // Star of David: two overlapping triangles
          drawPolygon(px, py, r, 3, rot); ctx.stroke();
          drawPolygon(px, py, r, 3, rot + Math.PI); ctx.stroke();
          break;
        }
        case "vesica": {
          // Two overlapping circles
          const offset = r * 0.5;
          ctx.beginPath(); ctx.arc(px - offset, py, r * 0.7, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(px + offset, py, r * 0.7, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "triCircle": {
          // Triangle with inscribed circle
          drawPolygon(px, py, r, 3, rot); ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, r * 0.45, 0, Math.PI * 2); ctx.stroke();
          break;
        }
      }
    }

    // ── LAYER 5: Radial ambient lines ────────────────────────────────────
    const radialCount = 8;

    // ── Animation loop ───────────────────────────────────────────────────
    let lt = 0, raf;
    const TWO_PI = Math.PI * 2;

    const draw = (ts) => {
      if (!lt) lt = ts;
      const dt = ts - lt;
      lt = ts;
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      cx = W / 2; cy = H / 2;
      const S = Math.min(W, H);
      ctx.clearRect(0, 0, W, H);

      // Center fade mask: geometry dims in center third
      const centerFade = (px, py) => {
        const dx = (px - cx) / (W * 0.33);
        const dy = (py - cy) / (H * 0.33);
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < 1 ? 0.25 + 0.75 * dist : 1;
      };

      // ── L1: Particles ─────────────────────────────────────────────────
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(ts * 0.0002 + p.ph) * 0.0002;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        p.ph += p.sp * dt;
        const a = p.baseA * (0.5 + 0.5 * Math.sin(p.ph));
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, TWO_PI);
        ctx.fillStyle = `rgba(180, 200, 240, ${a})`;
        ctx.fill();
      }

      // ── L5: Radial lines (drawn early so they're behind everything) ───
      for (let i = 0; i < radialCount; i++) {
        const a = (i * TWO_PI) / radialCount;
        const ex = cx + Math.cos(a) * S * 0.6;
        const ey = cy + Math.sin(a) * S * 0.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = "rgba(200, 175, 110, 0.035)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── L2: Metatron's Cube ────────────────────────────────────────────
      const outerRot = (ts / 120000) * TWO_PI;         // 120s revolution
      const innerRot = -(ts / 90000) * TWO_PI;         // 90s counter
      const breathe = 0.5 + 0.5 * Math.sin(ts / 12500); // 25s full cycle (sin period = 2*12500)
      const baseLineAlpha = 0.05 + breathe * 0.07;     // 3-9%

      const circles = getMetatronCircles(outerRot, innerRot);

      // Draw connecting lines
      ctx.lineWidth = 0.5;
      for (const [i, j] of metLines) {
        const c1 = circles[i], c2 = circles[j];
        const px1 = cx + c1.x * S, py1 = cy + c1.y * S;
        const px2 = cx + c2.x * S, py2 = cy + c2.y * S;
        const midX = (px1 + px2) / 2, midY = (py1 + py2) / 2;
        const fade = centerFade(midX, midY);
        const a = baseLineAlpha * fade;
        ctx.beginPath();
        ctx.moveTo(px1, py1);
        ctx.lineTo(px2, py2);
        ctx.strokeStyle = `rgba(232, 184, 75, ${a})`;
        ctx.stroke();
      }

      // Draw circles
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        const px = cx + c.x * S, py = cy + c.y * S;
        const fade = centerFade(px, py);
        const pulse = 1 + 0.15 * Math.sin(ts / 4000 + i * 0.5);
        const r = CIRCLE_R * S * pulse;
        const a = (0.06 + breathe * 0.05) * fade;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TWO_PI);
        ctx.strokeStyle = `rgba(232, 184, 75, ${a})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // ── L3: Orbital rings + traveling dots ─────────────────────────────
      for (const orb of orbits) {
        const r = orb.r * S;
        const fade = orb.r < 0.2 ? 0.3 : 1; // inner ring dimmer (center region)

        // Ring ellipse
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.35, 0.15, 0, TWO_PI);
        ctx.strokeStyle = `rgba(${orb.color}, ${0.07 * fade})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();

        // Traveling dots
        for (let d = 0; d < orb.dots; d++) {
          const angle = (ts * orb.speed + orb.phase + (d * TWO_PI) / orb.dots) * TWO_PI;
          const dx = cx + Math.cos(angle) * r;
          const dy = cy + Math.sin(angle) * r * 0.35 + Math.cos(0.15) * 0; // ellipse tilt approx
          const dotR = 2 + Math.sin(ts * 0.002 + d) * 1;

          // Glow halo
          const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, dotR * 3);
          grad.addColorStop(0, `rgba(${orb.color}, ${0.35 * fade})`);
          grad.addColorStop(1, `rgba(${orb.color}, 0)`);
          ctx.beginPath();
          ctx.arc(dx, dy, dotR * 3, 0, TWO_PI);
          ctx.fillStyle = grad;
          ctx.fill();

          // Core
          ctx.beginPath();
          ctx.arc(dx, dy, dotR * 0.6, 0, TWO_PI);
          ctx.fillStyle = `rgba(${orb.color}, ${0.6 * fade})`;
          ctx.fill();
        }
      }

      // ── L4: Edge geometry ──────────────────────────────────────────────
      for (const shape of edgeShapes) {
        const px = shape.x * W;
        const py = shape.y * H;
        const r = shape.sz * S;
        const rot = ts * shape.rotSpeed * TWO_PI;
        const innerRot2 = -rot * 0.65; // counter-rotate at 65% speed
        const alpha = 0.05 + 0.04 * Math.sin(ts * 0.0003 + shape.x * 10);

        // Outer shape
        ctx.save();
        drawShape(shape, px, py, r, rot, alpha);
        // Inner counter-rotating shape
        drawShape(shape, px, py, r * shape.innerScale, innerRot2, alpha * 0.7);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
      zIndex: 0, pointerEvents: "none",
    }} />
  );
}


// ── Greek Throne SVG ─────────────────────────────────────────────────────────
function GreekThrone({ color, size, glow }) {
  const o = glow ? 1 : 0.25;
  const h = size * 1.15;
  return (
    <svg width={size} height={h} viewBox="0 0 140 161" fill="none" style={{ filter: glow ? `drop-shadow(0 0 16px ${color}33)` : "none" }}>
      <path d="M38,20 C42,8 70,2 70,2 C70,2 98,8 102,20 L100,70 C95,66 80,64 70,64 C60,64 45,66 40,70 Z"
        fill="rgba(14,16,32,0.85)" stroke={color} strokeWidth="1.2" strokeOpacity={0.35*o} />
      <path d="M44,24 C48,14 70,9 70,9 C70,9 92,14 96,24"
        fill="none" stroke={color} strokeWidth="0.7" strokeOpacity={0.3*o} />
      <circle cx="70" cy="38" r="10" fill="none" stroke={color} strokeWidth="0.7" strokeOpacity={0.25*o} />
      <circle cx="70" cy="38" r="5" fill={color} fillOpacity={0.06*o} stroke={color} strokeWidth="0.5" strokeOpacity={0.2*o} />
      <path d="M24,76 L116,76 L112,86 C110,88 104,90 98,90 L42,90 C36,90 30,88 28,86 Z"
        fill="rgba(14,16,32,0.75)" stroke={color} strokeWidth="1" strokeOpacity={0.4*o} />
      <path d="M32,78 L108,78 L106,84 L34,84 Z" fill={color} fillOpacity={0.04*o} />
      <path d="M38,68 C28,66 20,68 18,72 L16,76 L24,76" fill="none" stroke={color} strokeWidth="1" strokeOpacity={0.35*o} />
      <circle cx="16" cy="74" r="3.5" fill="rgba(14,16,32,0.6)" stroke={color} strokeWidth="0.7" strokeOpacity={0.3*o} />
      <circle cx="16" cy="74" r="1.5" fill={color} fillOpacity={0.08*o} />
      <path d="M102,68 C112,66 120,68 122,72 L124,76 L116,76" fill="none" stroke={color} strokeWidth="1" strokeOpacity={0.35*o} />
      <circle cx="124" cy="74" r="3.5" fill="rgba(14,16,32,0.6)" stroke={color} strokeWidth="0.7" strokeOpacity={0.3*o} />
      <circle cx="124" cy="74" r="1.5" fill={color} fillOpacity={0.08*o} />
      <path d="M36,90 C32,105 26,125 20,140" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity={0.4*o} strokeLinecap="round" />
      <path d="M104,90 C108,105 114,125 120,140" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity={0.4*o} strokeLinecap="round" />
      <path d="M44,90 C40,108 34,128 28,142" fill="none" stroke={color} strokeWidth="1.2" strokeOpacity={0.3*o} strokeLinecap="round" />
      <path d="M96,90 C100,108 106,128 112,142" fill="none" stroke={color} strokeWidth="1.2" strokeOpacity={0.3*o} strokeLinecap="round" />
      <path d="M24,130 C50,124 90,124 116,130" fill="none" stroke={color} strokeWidth="0.6" strokeOpacity={0.2*o} />
      <ellipse cx="20" cy="142" rx="4" ry="2" fill="rgba(14,16,32,0.5)" stroke={color} strokeWidth="0.5" strokeOpacity={0.2*o} />
      <ellipse cx="120" cy="142" rx="4" ry="2" fill="rgba(14,16,32,0.5)" stroke={color} strokeWidth="0.5" strokeOpacity={0.2*o} />
      <ellipse cx="28" cy="144" rx="3.5" ry="1.5" fill="rgba(14,16,32,0.4)" stroke={color} strokeWidth="0.4" strokeOpacity={0.15*o} />
      <ellipse cx="112" cy="144" rx="3.5" ry="1.5" fill="rgba(14,16,32,0.4)" stroke={color} strokeWidth="0.4" strokeOpacity={0.15*o} />
      <ellipse cx="70" cy="150" rx="52" ry="4" fill={color} fillOpacity={0.03*o} />
      <circle cx="70" cy="38" r="16" fill={color} fillOpacity={glow ? 0.1 : 0.02} />
    </svg>
  );
}

// ── Greek Quorum Chair ───────────────────────────────────────────────────────
function QuorumChair({ color, glow }) {
  const o = glow ? 1 : 0.25;
  return (
    <svg width="46" height="58" viewBox="0 0 46 58" fill="none" style={{ filter: glow ? `drop-shadow(0 0 6px ${color}18)` : "none" }}>
      <path d="M12,8 C14,3 23,1 23,1 C23,1 32,3 34,8 L33,26 C30,24 26,23 23,23 C20,23 16,24 13,26 Z"
        fill="rgba(14,16,32,0.7)" stroke={color} strokeWidth="0.6" strokeOpacity={0.3*o} />
      <circle cx="23" cy="14" r="4" fill="none" stroke={color} strokeWidth="0.4" strokeOpacity={0.2*o} />
      <path d="M8,28 L38,28 L36,33 C35,34 32,35 28,35 L18,35 C14,35 11,34 10,33 Z"
        fill="rgba(14,16,32,0.6)" stroke={color} strokeWidth="0.6" strokeOpacity={0.35*o} />
      <path d="M13,35 C11,42 8,50 6,54" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity={0.3*o} strokeLinecap="round" />
      <path d="M33,35 C35,42 38,50 40,54" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity={0.3*o} strokeLinecap="round" />
      <path d="M15,35 C13,43 10,51 9,55" fill="none" stroke={color} strokeWidth="0.6" strokeOpacity={0.2*o} strokeLinecap="round" />
      <path d="M31,35 C33,43 36,51 37,55" fill="none" stroke={color} strokeWidth="0.6" strokeOpacity={0.2*o} strokeLinecap="round" />
    </svg>
  );
}

// ── Floating glow animation CSS (injected once) ─────────────────────────────
const CHAMBER_STYLES = `
@keyframes floatGlow {
  0%, 100% { transform: translateX(-50%) translateY(0px); filter: drop-shadow(0 0 6px var(--glow-color)) brightness(1.1); }
  50% { transform: translateX(-50%) translateY(-3px); filter: drop-shadow(0 0 12px var(--glow-color)) brightness(1.3); }
}
@keyframes floatGlowBig {
  0%, 100% { transform: translateY(0px); filter: drop-shadow(0 0 8px var(--glow-color)) brightness(1.1); }
  50% { transform: translateY(-4px); filter: drop-shadow(0 0 18px var(--glow-color)) brightness(1.4); }
}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = CHAMBER_STYLES;
  document.head.appendChild(el);
}

// ── Council data ─────────────────────────────────────────────────────────────
const COUNCIL = [
  { key:"poseidon", name:"POSEIDON", symbol:"\uD83D\uDD31", color:"#4ab8e8",
    quorum:["aphrodite","iris","demeter","prometheus"] },
  { key:"zeus", name:"ZEUS", symbol:"\u26A1", color:"#e8b84b",
    quorum:["hermes","athena","apollo","hestia"] },
  { key:"hades", name:"HADES", symbol:"\uD83C\uDFDB\uFE0F", color:"#b04adc",
    quorum:["hephaestus","nike","artemis","ares"] },
];
const QUORUM_NAMES = {
  hermes:"Hermes",athena:"Athena",apollo:"Apollo",hestia:"Hestia",
  aphrodite:"Aphrodite",iris:"Iris",demeter:"Demeter",prometheus:"Prometheus",
  hephaestus:"Hephaestus",nike:"Nike",artemis:"Artemis",ares:"Ares",
};

export default function CouncilChamber({ nodeHealth = {}, classifying = false }) {
  useEffect(() => { injectStyles(); }, []);

  return (
    <div style={{
      flex:1, position:"relative", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", overflow:"hidden",
      animation:"mode-enter 0.8s cubic-bezier(0.16,1,0.3,1) both",
    }}>

      <SacredGeometryCanvas />

      {/* Council thrones */}
      <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"flex-end", gap:36, marginBottom:12 }}>
        {COUNCIL.map((c, i) => {
          const isCenter = i === 1;
          const online = nodeHealth[c.key.toUpperCase()] === true;
          const sz = isCenter ? 140 : 112;
          return (
            <div key={c.key} style={{
              position:"relative", display:"flex", flexDirection:"column", alignItems:"center",
              transform: isCenter ? "translateY(-28px)" : "none",
            }}>
              <GreekThrone color={c.color} size={sz} glow={online} />
              {/* Agent symbol — floating and glowing */}
              <div style={{
                position:"absolute", top: isCenter ? sz*0.12 : sz*0.10,
                fontSize: isCenter ? 34 : 28, lineHeight:1,
                opacity: online ? 1 : 0.25,
                "--glow-color": c.color,
                animation: online ? `floatGlowBig 4s ease-in-out infinite ${i * 0.5}s` : "none",
                transition:"opacity 0.5s",
              }}>
                {c.symbol}
              </div>
              <div style={{
                fontFamily:"Cinzel,serif", fontSize: isCenter ? 14 : 12,
                letterSpacing:"0.3em", marginTop:2,
                color: online ? c.color : "var(--dim)",
                textShadow: online ? `0 0 14px ${c.color}44` : "none",
                transition:"color 0.5s",
              }}>
                {c.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quorum chairs arc */}
      <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"flex-start", gap:2, marginTop:4 }}>
        {COUNCIL.map((c, gi) => (
          <div key={c.key} style={{
            display:"flex", gap:4, marginLeft: gi > 0 ? 32 : 0,
            transform: `translateY(${gi === 1 ? -8 : 0}px)`,
          }}>
            {c.quorum.map((agent, ai) => (
              <div key={agent} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
                <div style={{ position:"relative" }}>
                  <QuorumChair color={c.color} glow={true} />
                  {/* Agent logo — floating, glowing, high-class */}
                  <img src={`/agents/${agent}.svg`} alt={agent}
                    style={{
                      position:"absolute", top:3, left:"50%",
                      width:24, height:24,
                      "--glow-color": c.color,
                      animation: `floatGlow 3.5s ease-in-out infinite ${(gi * 4 + ai) * 0.3}s`,
                    }}
                  />
                </div>
                <span style={{
                  fontFamily:"JetBrains Mono,monospace", fontSize:7, letterSpacing:"0.04em",
                  color:c.color, opacity:0.6, textTransform:"uppercase",
                }}>
                  {QUORUM_NAMES[agent]}
                </span>
                <div style={{
                  width:3, height:3, borderRadius:"50%",
                  background:"#5ee8b0", boxShadow:"0 0 4px rgba(94,232,176,0.5)",
                }} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Status */}
      <div style={{
        position:"relative", zIndex:1, fontFamily:"Cinzel,serif",
        fontSize:12, letterSpacing:"0.28em", marginTop:28,
        color: classifying ? "var(--gold2)" : "rgba(200,180,140,0.4)",
        transition:"color 0.5s", textAlign:"center",
      }}>
        {classifying ? "ZEUS IS CLASSIFYING \u00B7 \u00B7 \u00B7" : "B3C COUNCIL \u00B7 PRESENT AND WAITING"}
      </div>
    </div>
  );
}
