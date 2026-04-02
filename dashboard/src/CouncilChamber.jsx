/**
 * CouncilChamber.jsx — B3C Council idle state
 * Constellation background + Greek throne chamber with agent logos
 */
import { useEffect, useRef } from "react";

// ── Constellations — gnomonic projection of real J2000 RA/Dec star positions ──
// Each constellation preserves the actual visual shape as seen from Earth.
const CONSTELLATIONS = [
  { name:"Orion",
    stars:[[0.204,0.08],[0.642,0.08],[0.542,0.452],[0.482,0.504],[0.415,0.547],[0.796,0.915],[0.314,0.92]],
    lines:[[0,1],[0,4],[1,2],[2,3],[3,4],[2,5],[4,6]],
    // Hunter silhouette: head, right arm raised with club, left arm with shield, torso, legs
    silhouette:[[0.42,0.0],[0.36,0.02],[0.32,0.06],[0.30,0.04],[0.22,0.0],[0.10,0.0],[0.05,0.05],[0.08,0.10],[0.14,0.08],[0.18,0.06],[0.22,0.08],[0.16,0.14],[0.14,0.20],[0.18,0.22],[0.22,0.16],[0.28,0.12],[0.32,0.14],[0.30,0.20],[0.28,0.30],[0.30,0.38],[0.34,0.42],[0.38,0.46],[0.36,0.50],[0.32,0.56],[0.28,0.60],[0.24,0.68],[0.22,0.76],[0.24,0.84],[0.28,0.90],[0.30,0.96],[0.32,1.0],[0.38,1.0],[0.40,0.94],[0.38,0.86],[0.36,0.78],[0.38,0.70],[0.42,0.62],[0.48,0.58],[0.52,0.62],[0.56,0.70],[0.58,0.78],[0.56,0.86],[0.58,0.92],[0.62,0.96],[0.68,1.0],[0.72,1.0],[0.78,0.96],[0.80,0.90],[0.82,0.82],[0.78,0.74],[0.74,0.66],[0.70,0.58],[0.68,0.50],[0.70,0.42],[0.72,0.34],[0.76,0.30],[0.82,0.28],[0.88,0.24],[0.90,0.18],[0.86,0.14],[0.78,0.16],[0.72,0.18],[0.68,0.14],[0.66,0.10],[0.62,0.06],[0.56,0.04],[0.50,0.02],[0.46,0.0]] },
  { name:"Big Dipper",
    stars:[[0.92,0.267],[0.92,0.474],[0.725,0.635],[0.596,0.509],[0.382,0.54],[0.207,0.551],[0.08,0.733]],
    lines:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]],
    // Bear (Ursa Major) silhouette
    silhouette:[[0.95,0.18],[0.98,0.22],[0.98,0.30],[0.96,0.38],[0.96,0.48],[0.94,0.52],[0.88,0.56],[0.82,0.60],[0.78,0.66],[0.74,0.72],[0.72,0.68],[0.70,0.60],[0.66,0.56],[0.62,0.52],[0.58,0.48],[0.52,0.46],[0.46,0.48],[0.40,0.52],[0.36,0.56],[0.30,0.56],[0.24,0.54],[0.20,0.50],[0.16,0.52],[0.12,0.56],[0.10,0.62],[0.08,0.68],[0.06,0.76],[0.04,0.82],[0.08,0.82],[0.12,0.78],[0.14,0.72],[0.18,0.68],[0.22,0.64],[0.26,0.62],[0.30,0.64],[0.32,0.68],[0.30,0.74],[0.28,0.80],[0.32,0.82],[0.36,0.78],[0.38,0.72],[0.42,0.66],[0.46,0.62],[0.50,0.60],[0.54,0.58],[0.58,0.58],[0.62,0.60],[0.66,0.64],[0.68,0.68],[0.72,0.72],[0.76,0.68],[0.80,0.64],[0.84,0.58],[0.88,0.52],[0.92,0.48],[0.94,0.42],[0.96,0.36],[0.96,0.28],[0.95,0.22]] },
  { name:"Cassiopeia",
    stars:[[0.92,0.553],[0.698,0.805],[0.514,0.48],[0.227,0.507],[0.08,0.195]],
    lines:[[0,1],[1,2],[2,3],[3,4]],
    // Seated queen silhouette
    silhouette:[[0.06,0.10],[0.04,0.16],[0.06,0.22],[0.10,0.28],[0.14,0.34],[0.18,0.40],[0.22,0.46],[0.20,0.52],[0.16,0.58],[0.18,0.64],[0.24,0.60],[0.30,0.54],[0.36,0.50],[0.42,0.46],[0.48,0.44],[0.52,0.46],[0.56,0.50],[0.60,0.56],[0.64,0.62],[0.68,0.68],[0.72,0.74],[0.76,0.80],[0.80,0.84],[0.84,0.82],[0.88,0.76],[0.92,0.68],[0.96,0.60],[0.96,0.52],[0.92,0.50],[0.86,0.54],[0.80,0.60],[0.74,0.64],[0.68,0.62],[0.62,0.56],[0.56,0.48],[0.52,0.42],[0.48,0.38],[0.42,0.36],[0.36,0.38],[0.30,0.42],[0.24,0.44],[0.18,0.40],[0.14,0.34],[0.10,0.26],[0.08,0.18]] },
  { name:"Scorpius",
    stars:[[0.909,0.08],[0.92,0.134],[0.64,0.29],[0.573,0.368],[0.436,0.637],[0.423,0.804],[0.408,0.92],[0.08,0.789],[0.08,0.795]],
    lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[4,7],[7,8]],
    // Scorpion: pincers at top, body curving down, tail curling with stinger
    silhouette:[[0.96,0.04],[0.92,0.02],[0.86,0.06],[0.88,0.12],[0.92,0.16],[0.88,0.20],[0.82,0.18],[0.78,0.14],[0.74,0.18],[0.70,0.22],[0.66,0.26],[0.62,0.30],[0.58,0.34],[0.54,0.38],[0.50,0.44],[0.46,0.52],[0.44,0.60],[0.42,0.68],[0.40,0.76],[0.38,0.84],[0.36,0.92],[0.38,0.98],[0.42,0.96],[0.44,0.88],[0.46,0.80],[0.48,0.72],[0.50,0.64],[0.52,0.56],[0.56,0.48],[0.60,0.42],[0.64,0.36],[0.68,0.32],[0.72,0.28],[0.76,0.24],[0.80,0.22],[0.84,0.24],[0.88,0.28],[0.84,0.30],[0.78,0.28],[0.72,0.30],[0.18,0.72],[0.10,0.76],[0.04,0.80],[0.02,0.84],[0.06,0.86],[0.12,0.82],[0.18,0.78],[0.30,0.72],[0.36,0.68],[0.40,0.64]] },
  { name:"Leo",
    stars:[[0.837,0.738],[0.841,0.577],[0.739,0.477],[0.92,0.262],[0.92,0.334],[0.315,0.442],[0.08,0.621]],
    lines:[[0,1],[1,2],[2,5],[5,6],[1,3],[3,4],[4,1]],
    // Lion: head with mane, body, legs, tail
    silhouette:[[0.96,0.20],[0.94,0.16],[0.88,0.14],[0.84,0.18],[0.80,0.22],[0.78,0.28],[0.82,0.32],[0.86,0.30],[0.90,0.28],[0.94,0.30],[0.96,0.34],[0.94,0.40],[0.90,0.44],[0.86,0.48],[0.82,0.52],[0.78,0.54],[0.72,0.54],[0.64,0.52],[0.56,0.50],[0.48,0.48],[0.40,0.46],[0.32,0.44],[0.24,0.46],[0.18,0.50],[0.12,0.54],[0.08,0.58],[0.06,0.64],[0.04,0.70],[0.06,0.72],[0.10,0.68],[0.14,0.64],[0.18,0.60],[0.22,0.58],[0.26,0.60],[0.28,0.66],[0.26,0.72],[0.28,0.74],[0.32,0.70],[0.36,0.64],[0.40,0.60],[0.46,0.58],[0.52,0.58],[0.58,0.60],[0.64,0.62],[0.70,0.64],[0.76,0.68],[0.80,0.72],[0.82,0.78],[0.84,0.82],[0.86,0.78],[0.88,0.72],[0.86,0.66],[0.84,0.60],[0.86,0.54],[0.90,0.48],[0.94,0.42],[0.96,0.36]] },
  { name:"Hercules",
    stars:[[0.286,0.92],[0.714,0.702],[0.597,0.298],[0.574,0.08],[0.316,0.086],[0.434,0.327],[0.297,0.569]],
    lines:[[1,2],[2,3],[3,4],[4,5],[5,2],[5,6],[6,1],[6,0]],
    // Kneeling warrior with club raised
    silhouette:[[0.56,0.0],[0.50,0.02],[0.48,0.06],[0.50,0.10],[0.54,0.08],[0.58,0.06],[0.62,0.04],[0.64,0.08],[0.66,0.14],[0.68,0.20],[0.64,0.22],[0.58,0.24],[0.54,0.28],[0.50,0.32],[0.46,0.36],[0.42,0.32],[0.38,0.26],[0.34,0.20],[0.30,0.14],[0.26,0.10],[0.22,0.08],[0.18,0.12],[0.22,0.16],[0.26,0.20],[0.30,0.24],[0.34,0.28],[0.36,0.34],[0.34,0.40],[0.30,0.46],[0.28,0.52],[0.26,0.58],[0.24,0.64],[0.22,0.70],[0.20,0.76],[0.22,0.82],[0.26,0.88],[0.28,0.94],[0.30,1.0],[0.36,0.98],[0.34,0.92],[0.32,0.84],[0.34,0.76],[0.38,0.68],[0.42,0.62],[0.48,0.58],[0.54,0.56],[0.60,0.58],[0.66,0.62],[0.70,0.68],[0.74,0.74],[0.76,0.68],[0.74,0.60],[0.70,0.54],[0.66,0.48],[0.62,0.42],[0.58,0.36],[0.56,0.30],[0.58,0.24],[0.62,0.18],[0.64,0.12],[0.62,0.06],[0.60,0.02]] },
  { name:"Lyra",
    stars:[[0.82,0.123],[0.6,0.08],[0.603,0.297],[0.448,0.907],[0.18,0.92],[0.325,0.397]],
    lines:[[0,1],[0,2],[1,5],[2,3],[3,4],[4,5]],
    // Lyre/harp shape
    silhouette:[[0.70,0.04],[0.58,0.02],[0.48,0.06],[0.42,0.14],[0.38,0.24],[0.34,0.34],[0.30,0.44],[0.26,0.56],[0.22,0.68],[0.18,0.80],[0.14,0.90],[0.16,0.96],[0.22,0.96],[0.28,0.88],[0.34,0.78],[0.38,0.68],[0.42,0.58],[0.46,0.68],[0.48,0.78],[0.50,0.88],[0.52,0.96],[0.58,0.96],[0.60,0.88],[0.56,0.76],[0.52,0.64],[0.50,0.52],[0.52,0.40],[0.56,0.30],[0.60,0.22],[0.66,0.14],[0.72,0.08],[0.78,0.06],[0.84,0.08],[0.86,0.14],[0.82,0.16],[0.76,0.12],[0.72,0.08]] },
  { name:"Corona Borealis",
    stars:[[0.841,0.137],[0.92,0.441],[0.802,0.773],[0.555,0.833],[0.347,0.863],[0.103,0.748],[0.08,0.337]],
    lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]],
    // Crown/tiara arc
    silhouette:[[0.86,0.08],[0.80,0.06],[0.74,0.10],[0.78,0.16],[0.84,0.14],[0.90,0.18],[0.94,0.28],[0.96,0.40],[0.94,0.52],[0.90,0.62],[0.86,0.72],[0.82,0.80],[0.76,0.86],[0.68,0.88],[0.58,0.90],[0.48,0.92],[0.38,0.92],[0.28,0.88],[0.18,0.82],[0.12,0.76],[0.08,0.66],[0.06,0.54],[0.06,0.42],[0.08,0.32],[0.12,0.26],[0.18,0.30],[0.14,0.40],[0.12,0.52],[0.14,0.64],[0.20,0.74],[0.28,0.80],[0.36,0.84],[0.46,0.84],[0.56,0.82],[0.66,0.78],[0.74,0.72],[0.80,0.64],[0.86,0.54],[0.90,0.42],[0.92,0.30],[0.90,0.20],[0.88,0.12]] },
  { name:"B3C Triangle",
    stars:[[0.5,0.08],[0.08,0.92],[0.92,0.92]],
    lines:[[0,1],[1,2],[2,0]],
    silhouette:null },
];

// Sky regions — edges and corners, never overlapping the throne chamber
const SKY_REGIONS = [
  { x: 0.01, y: 0.02, w: 0.28, h: 0.36 },
  { x: 0.72, y: 0.02, w: 0.27, h: 0.36 },
  { x: 0.01, y: 0.60, w: 0.24, h: 0.36 },
  { x: 0.76, y: 0.60, w: 0.23, h: 0.36 },
  { x: 0.00, y: 0.25, w: 0.18, h: 0.42 },
  { x: 0.82, y: 0.25, w: 0.17, h: 0.42 },
  { x: 0.30, y: 0.00, w: 0.40, h: 0.13 },
  { x: 0.30, y: 0.85, w: 0.40, h: 0.14 },
];

function ConstellationCanvas({ active }) {
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

    // Deep space background
    const bgStars = Array.from({ length: 400 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.15 + Math.random() * 0.7,
      a: 0.02 + Math.random() * 0.12,
      ph: Math.random() * 6.28,
      sp: 0.0002 + Math.random() * 0.0006,
    }));

    const maxS = Math.max(...CONSTELLATIONS.map(c => c.stars.length));
    const cS = Array.from({ length: maxS }, () => ({
      x: Math.random(), y: Math.random(), sx: 0, sy: 0, tx: 0, ty: 0,
    }));

    let cIdx = Math.floor(Math.random() * CONSTELLATIONS.length);
    let regionIdx = Math.floor(Math.random() * SKY_REGIONS.length);
    let phase = 0, elapsed = 0;
    const DUR = [10000, 14000, 5000, 3000];

    function setTgts() {
      const c = CONSTELLATIONS[cIdx];
      const r = SKY_REGIONS[regionIdx];
      for (let i = 0; i < maxS; i++) {
        cS[i].sx = cS[i].x; cS[i].sy = cS[i].y;
        if (i < c.stars.length) {
          cS[i].tx = r.x + c.stars[i][0] * r.w;
          cS[i].ty = r.y + c.stars[i][1] * r.h;
        } else {
          cS[i].tx = Math.random(); cS[i].ty = Math.random();
        }
      }
    }
    function scatter() {
      for (const s of cS) { s.sx = s.x; s.sy = s.y; s.tx = Math.random(); s.ty = Math.random(); }
    }
    setTgts();

    let lt = 0, raf;
    function ease(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2) / 2; }

    const draw = (ts) => {
      if (!lt) lt = ts;
      const dt = ts - lt; lt = ts; elapsed += dt;
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = active ? 0.15 : 1;

      // Background dust
      for (const s of bgStars) {
        s.ph += s.sp * dt;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, 6.28);
        ctx.fillStyle = `rgba(140, 150, 190, ${s.a * (0.5 + 0.5 * Math.sin(s.ph))})`;
        ctx.fill();
      }

      if (elapsed >= DUR[phase]) {
        elapsed = 0; phase = (phase + 1) % 4;
        if (phase === 0) {
          cIdx = (cIdx + 1) % CONSTELLATIONS.length;
          let nr; do { nr = Math.floor(Math.random() * SKY_REGIONS.length); } while (nr === regionIdx && SKY_REGIONS.length > 1);
          regionIdx = nr;
          setTgts();
        }
        if (phase === 2) scatter();
      }

      const t = Math.min(1, elapsed / DUR[phase]);
      const et = (phase === 0 || phase === 2) ? ease(t) : 0;
      const c = CONSTELLATIONS[cIdx];

      if (phase === 0 || phase === 2) {
        for (const s of cS) { s.x = s.sx + (s.tx - s.sx) * et; s.y = s.sy + (s.ty - s.sy) * et; }
      }

      // Silhouette — translucent mythological figure
      if ((phase === 1 || phase === 0) && c.silhouette) {
        const silAlpha = phase === 1
          ? Math.min(0.08, t * 0.16)
          : Math.max(0, ease(t) * 0.06);
        if (silAlpha > 0.005) {
          ctx.beginPath();
          const sil = c.silhouette;
          const r = SKY_REGIONS[regionIdx];
          // Map silhouette coords through same region transform as stars
          const sx0 = r.x * W, sy0 = r.y * H, sw = r.w * W, sh = r.h * H;
          ctx.moveTo(sx0 + sil[0][0] * sw, sy0 + sil[0][1] * sh);
          for (let i = 1; i < sil.length; i++) {
            ctx.lineTo(sx0 + sil[i][0] * sw, sy0 + sil[i][1] * sh);
          }
          ctx.closePath();
          // Radial gradient fill — brighter in center, fading at edges
          const cx = sx0 + 0.5 * sw, cy = sy0 + 0.5 * sh;
          const gr = Math.max(sw, sh) * 0.6;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
          grad.addColorStop(0, "rgba(80, 120, 200, " + (silAlpha * 1.5) + ")");
          grad.addColorStop(0.6, "rgba(60, 90, 170, " + silAlpha + ")");
          grad.addColorStop(1, "rgba(40, 60, 140, 0)");
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Also draw silhouette during fade-out
      if (phase === 2 && c.silhouette) {
        const silAlpha = 0.08 * Math.max(0, 1 - t);
        if (silAlpha > 0.005) {
          ctx.beginPath();
          const sil = c.silhouette;
          const r = SKY_REGIONS[regionIdx];
          const sx0 = r.x * W, sy0 = r.y * H, sw = r.w * W, sh = r.h * H;
          ctx.moveTo(sx0 + sil[0][0] * sw, sy0 + sil[0][1] * sh);
          for (let i = 1; i < sil.length; i++) {
            ctx.lineTo(sx0 + sil[i][0] * sw, sy0 + sil[i][1] * sh);
          }
          ctx.closePath();
          const cx = sx0 + 0.5 * sw, cy = sy0 + 0.5 * sh;
          const gr = Math.max(sw, sh) * 0.6;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
          grad.addColorStop(0, "rgba(80, 120, 200, " + (silAlpha * 1.5) + ")");
          grad.addColorStop(0.6, "rgba(60, 90, 170, " + silAlpha + ")");
          grad.addColorStop(1, "rgba(40, 60, 140, 0)");
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Lines — soft glow + crisp core
      if (phase === 1 || phase === 2) {
        const lineAlpha = phase === 1 ? Math.min(0.3, t * 0.6) : 0.3 * Math.max(0, 1 - t);
        const lv = phase === 1 ? Math.ceil(Math.min(1, t * 1.5) * c.lines.length) : c.lines.length;

        for (let i = 0; i < lv && i < c.lines.length; i++) {
          const [a, b] = c.lines[i];
          if (a >= maxS || b >= maxS) continue;
          const ax = cS[a].x*W, ay = cS[a].y*H, bx = cS[b].x*W, by = cS[b].y*H;
          // Glow
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          ctx.strokeStyle = `rgba(190, 170, 110, ${lineAlpha * 0.25})`;
          ctx.lineWidth = 3; ctx.stroke();
          // Core
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          ctx.strokeStyle = `rgba(210, 190, 120, ${lineAlpha})`;
          ctx.lineWidth = 0.7; ctx.stroke();
        }
      }

      // Stars
      const locked = phase === 1;
      const starBright = phase === 0 ? ease(t) : phase === 2 ? 1 - ease(t) : phase === 1 ? 1 : 0;

      for (let i = 0; i < c.stars.length && i < maxS; i++) {
        const s = cS[i];
        const px = s.x * W, py = s.y * H;
        const b = locked ? 1 : starBright * 0.6;

        if (b > 0.08) {
          const hr = locked ? 8 : 4;
          const halo = ctx.createRadialGradient(px, py, 0, px, py, hr);
          halo.addColorStop(0, `rgba(220, 200, 130, ${0.22 * b})`);
          halo.addColorStop(1, "rgba(220, 200, 130, 0)");
          ctx.beginPath(); ctx.arc(px, py, hr, 0, 6.28);
          ctx.fillStyle = halo; ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px, py, locked ? 1.5 : 0.8, 0, 6.28);
        ctx.fillStyle = locked
          ? `rgba(240, 225, 160, ${0.85 * Math.max(b, 0.25)})`
          : `rgba(180, 190, 215, ${0.3 * Math.max(b, 0.15)})`;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [active]);

  return <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:0 }} />;
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
      <ConstellationCanvas active={classifying} />

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
