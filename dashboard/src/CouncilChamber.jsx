/**
 * CouncilChamber.jsx — B3C Council idle state
 * Constellation background + Greek throne chamber with agent logos
 */
import { useEffect, useRef } from "react";

// ── Sacred Geometry Background — Wandering Metatron's Cube ───────────────────
function SacredGeometryCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Particle drift (subtle cosmic dust) ──────────────────────────────
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.2 + Math.random() * 0.5,
      baseA: 0.03 + Math.random() * 0.08,
      ph: Math.random() * Math.PI * 2,
      sp: 0.0003 + Math.random() * 0.0006,
      vy: -(0.002 + Math.random() * 0.006),
      vx: (Math.random() - 0.5) * 0.001,
    }));

    // ── Metatron's Cube geometry ─────────────────────────────────────────
    // ── Complex Metatron's Cube — 4 rings + Flower of Life + full connections ──
    const RINGS = [
      { r: 0,    count: 1, label: "center" },
      { r: 0.11, count: 6, label: "inner" },
      { r: 0.22, count: 6, label: "mid" },
      { r: 0.33, count: 6, label: "outer" },
      { r: 0.42, count: 12, label: "crown" },
    ];

    function getCircles(ts) {
      const circles = [];
      // Ring rotations — each ring rotates at its own speed and direction
      const rots = [
        0,                             // center: static
        -(ts / 90000) * Math.PI * 2,   // inner: counter-clockwise 90s
        (ts / 120000) * Math.PI * 2,   // mid: clockwise 120s
        -(ts / 150000) * Math.PI * 2,  // outer: counter 150s
        (ts / 200000) * Math.PI * 2,   // crown: very slow clockwise 200s
      ];
      for (let ri = 0; ri < RINGS.length; ri++) {
        const ring = RINGS[ri];
        for (let i = 0; i < ring.count; i++) {
          const a = rots[ri] + (i * Math.PI * 2) / ring.count;
          circles.push({
            x: ring.r === 0 ? 0 : Math.cos(a) * ring.r,
            y: ring.r === 0 ? 0 : Math.sin(a) * ring.r,
            ring: ri,
          });
        }
      }
      return circles;
    }

    // Flower of Life circle radii per ring
    const FOL_RADII = [0.11, 0.08, 0.065, 0.05, 0.03];

    // Pre-compute connection patterns
    function getMetLines(circles) {
      const lines = [];
      const n = circles.length;
      // Connect within each ring (adjacent)
      let idx = 0;
      for (const ring of RINGS) {
        if (ring.count > 1) {
          for (let i = 0; i < ring.count; i++) {
            lines.push([idx + i, idx + ((i + 1) % ring.count)]);
          }
        }
        idx += ring.count;
      }
      // Connect center to inner ring
      for (let i = 1; i <= 6; i++) lines.push([0, i]);
      // Connect inner to mid (corresponding + skip-one for star pattern)
      for (let i = 0; i < 6; i++) {
        lines.push([1 + i, 7 + i]);
        lines.push([1 + i, 7 + ((i + 1) % 6)]);
      }
      // Connect mid to outer
      for (let i = 0; i < 6; i++) {
        lines.push([7 + i, 13 + i]);
        lines.push([7 + i, 13 + ((i + 1) % 6)]);
      }
      // Connect outer to crown (each outer vertex connects to 2 nearest crown)
      for (let i = 0; i < 6; i++) {
        lines.push([13 + i, 19 + (i * 2)]);
        lines.push([13 + i, 19 + (i * 2 + 1)]);
      }
      // Star of David: connect alternating inner vertices through center
      for (let i = 0; i < 3; i++) {
        lines.push([1 + i, 1 + i + 3]);
      }
      return lines;
    }

    // ── Wandering position state ─────────────────────────────────────────
    // Cube spawns at a corner, holds while rotating, fades out, moves to next
    const CORNERS = [
      { x: 0.18, y: 0.78 },  // bottom-left
      { x: 0.82, y: 0.78 },  // bottom-right
      { x: 0.82, y: 0.18 },  // top-right
      { x: 0.18, y: 0.18 },  // top-left
    ];
    let cornerIdx = 0;
    let cubeX = CORNERS[0].x, cubeY = CORNERS[0].y;
    let targetX = cubeX, targetY = cubeY;
    let cubePhase = 0; // 0=fade-in, 1=hold, 2=fade-out, 3=travel
    let phaseElapsed = 0;
    const PHASE_DUR = [3000, 18000, 3000, 4000]; // fade-in, hold, fade-out, travel

    // ── Draw loop ────────────────────────────────────────────────────────
    let lt = 0, raf;
    const TWO_PI = Math.PI * 2;

    const draw = (ts) => {
      if (!lt) lt = ts;
      const dt = ts - lt;
      lt = ts;
      phaseElapsed += dt;
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      const S = Math.min(W, H);

      // ── Phase machine ──────────────────────────────────────────────────
      if (phaseElapsed >= PHASE_DUR[cubePhase]) {
        phaseElapsed = 0;
        cubePhase = (cubePhase + 1) % 4;
        if (cubePhase === 3) {
          // Pick next corner
          cornerIdx = (cornerIdx + 1) % CORNERS.length;
          targetX = CORNERS[cornerIdx].x;
          targetY = CORNERS[cornerIdx].y;
        }
      }

      // Cube opacity based on phase
      let cubeAlpha;
      const t = Math.min(1, phaseElapsed / PHASE_DUR[cubePhase]);
      if (cubePhase === 0) cubeAlpha = t;                    // fade in
      else if (cubePhase === 1) cubeAlpha = 1;               // full
      else if (cubePhase === 2) cubeAlpha = 1 - t;           // fade out
      else cubeAlpha = 0;                                     // traveling (invisible)

      // Smooth travel during phase 3
      if (cubePhase === 3) {
        const ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2) / 2;
        cubeX = cubeX + (targetX - cubeX) * ease * 0.08;
        cubeY = cubeY + (targetY - cubeY) * ease * 0.08;
      }
      if (cubePhase === 0 && phaseElapsed < 100) {
        cubeX = targetX; cubeY = targetY; // snap to target on arrival
      }

      // ── L1: Particles ──────────────────────────────────────────────────
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(ts * 0.00015 + p.ph) * 0.00015;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        p.ph += p.sp * dt;
        const a = p.baseA * (0.5 + 0.5 * Math.sin(p.ph));
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, TWO_PI);
        ctx.fillStyle = `rgba(180, 200, 240, ${a})`;
        ctx.fill();
      }

      // ── Metatron's Cube (only when visible) ────────────────────────────
      if (cubeAlpha > 0.01) {
        const pcx = cubeX * W;
        const pcy = cubeY * H;
        const cubeSize = S * 0.32; // compact size

        const breathe = 0.5 + 0.5 * Math.sin(ts / 12500);
        const breathe2 = 0.5 + 0.5 * Math.sin(ts / 8000 + 1.5);

        const circles = getCircles(ts);
        const lines = getMetLines(circles);

        // ── Outer aura glow ──────────────────────────────────────────────
        const auraR = cubeSize * 0.5;
        const aura = ctx.createRadialGradient(pcx, pcy, cubeSize * 0.1, pcx, pcy, auraR);
        aura.addColorStop(0, `rgba(232, 184, 75, ${0.025 * cubeAlpha})`);
        aura.addColorStop(0.6, `rgba(180, 140, 60, ${0.012 * cubeAlpha})`);
        aura.addColorStop(1, "rgba(232, 184, 75, 0)");
        ctx.beginPath();
        ctx.arc(pcx, pcy, auraR, 0, TWO_PI);
        ctx.fillStyle = aura;
        ctx.fill();

        // ── Flower of Life circles (the overlapping circle pattern) ──────
        for (let i = 0; i < circles.length; i++) {
          const c = circles[i];
          const px = pcx + c.x * cubeSize;
          const py = pcy + c.y * cubeSize;
          const ringIdx = c.ring;
          const baseR = FOL_RADII[ringIdx] || 0.03;
          const pulse = 1 + 0.08 * Math.sin(ts / 5000 + i * 0.4);
          const r = baseR * cubeSize * pulse;
          const ringAlpha = [0.07, 0.06, 0.05, 0.04, 0.025][ringIdx] || 0.03;
          const a = (ringAlpha + breathe * 0.03) * cubeAlpha;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, TWO_PI);
          ctx.strokeStyle = `rgba(232, 184, 75, ${a})`;
          ctx.lineWidth = 0.35;
          ctx.stroke();
        }

        // ── Connecting lines — layered by ring distance ──────────────────
        const baseLineAlpha = (0.04 + breathe * 0.05) * cubeAlpha;
        for (const [i, j] of lines) {
          if (i >= circles.length || j >= circles.length) continue;
          const c1 = circles[i], c2 = circles[j];
          const px1 = pcx + c1.x * cubeSize, py1 = pcy + c1.y * cubeSize;
          const px2 = pcx + c2.x * cubeSize, py2 = pcy + c2.y * cubeSize;
          // Inner connections brighter, outer dimmer
          const avgRing = (c1.ring + c2.ring) / 2;
          const ringFade = 1 - avgRing * 0.15;
          ctx.beginPath();
          ctx.moveTo(px1, py1);
          ctx.lineTo(px2, py2);
          ctx.strokeStyle = `rgba(232, 184, 75, ${baseLineAlpha * ringFade})`;
          ctx.lineWidth = avgRing < 1 ? 0.6 : 0.35;
          ctx.stroke();
        }

        // ── Vertex dots — small bright points at each circle center ──────
        for (let i = 0; i < circles.length; i++) {
          const c = circles[i];
          const px = pcx + c.x * cubeSize;
          const py = pcy + c.y * cubeSize;
          const ringIdx = c.ring;
          const dotR = [2.5, 2, 1.5, 1.2, 0.8][ringIdx] || 1;
          const dotA = [0.5, 0.4, 0.3, 0.2, 0.12][ringIdx] || 0.15;

          // Halo
          const haloR = dotR * 4;
          const halo = ctx.createRadialGradient(px, py, 0, px, py, haloR);
          halo.addColorStop(0, `rgba(232, 184, 75, ${dotA * cubeAlpha * breathe2})`);
          halo.addColorStop(1, "rgba(232, 184, 75, 0)");
          ctx.beginPath();
          ctx.arc(px, py, haloR, 0, TWO_PI);
          ctx.fillStyle = halo;
          ctx.fill();

          // Core dot
          ctx.beginPath();
          ctx.arc(px, py, dotR, 0, TWO_PI);
          ctx.fillStyle = `rgba(255, 230, 160, ${dotA * cubeAlpha})`;
          ctx.fill();
        }

        // ── Spinning inner triangles (Star of David) ─────────────────────
        const triRot1 = (ts / 25000) * TWO_PI;
        const triRot2 = -(ts / 25000) * TWO_PI;
        const triR = cubeSize * 0.18;
        const triAlpha = (0.04 + breathe * 0.03) * cubeAlpha;
        for (let t = 0; t < 2; t++) {
          const rot = t === 0 ? triRot1 : triRot2;
          ctx.beginPath();
          for (let i = 0; i <= 3; i++) {
            const a = rot + (i * TWO_PI) / 3 - Math.PI / 2;
            const tx = pcx + Math.cos(a) * triR;
            const ty = pcy + Math.sin(a) * triR;
            i === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
          }
          ctx.closePath();
          ctx.strokeStyle = `rgba(232, 184, 75, ${triAlpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // ── Outermost containment circle ─────────────────────────────────
        const outerCircleR = cubeSize * 0.44;
        const outerRot = (ts / 60000) * TWO_PI;
        ctx.beginPath();
        ctx.arc(pcx, pcy, outerCircleR, 0, TWO_PI);
        ctx.strokeStyle = `rgba(232, 184, 75, ${0.025 * cubeAlpha})`;
        ctx.lineWidth = 0.3;
        ctx.stroke();

        // Tick marks on outer circle (12 hour positions)
        for (let i = 0; i < 12; i++) {
          const a = outerRot + (i * TWO_PI) / 12;
          const ix = pcx + Math.cos(a) * (outerCircleR - 3);
          const iy = pcy + Math.sin(a) * (outerCircleR - 3);
          const ox = pcx + Math.cos(a) * (outerCircleR + 3);
          const oy = pcy + Math.sin(a) * (outerCircleR + 3);
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.lineTo(ox, oy);
          ctx.strokeStyle = `rgba(232, 184, 75, ${0.04 * cubeAlpha})`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
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
