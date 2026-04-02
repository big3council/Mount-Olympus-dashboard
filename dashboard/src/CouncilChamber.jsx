/**
 * CouncilChamber.jsx — B3C Council idle state
 * Constellation background + Greek throne chamber with agent logos
 */
import { useEffect, useRef } from "react";

// ── Sacred Geometry Background — 4 independent wandering elements ────────────
// Each element occupies one corner, holds, fades, then moves to a new corner.
// Elements: Metatron's Cube, Golden Ratio Spiral, Sri Yantra, Platonic Solids
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
    const TWO_PI = Math.PI * 2;

    // ── Particles ────────────────────────────────────────────────────────
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.2 + Math.random() * 0.5,
      baseA: 0.03 + Math.random() * 0.08,
      ph: Math.random() * TWO_PI,
      sp: 0.0003 + Math.random() * 0.0006,
      vy: -(0.002 + Math.random() * 0.006),
      vx: (Math.random() - 0.5) * 0.001,
    }));

    // ── Corner positions ─────────────────────────────────────────────────
    const CORNERS = [
      { x: 0.18, y: 0.78 },  // bottom-left
      { x: 0.82, y: 0.78 },  // bottom-right
      { x: 0.82, y: 0.18 },  // top-right
      { x: 0.18, y: 0.18 },  // top-left
    ];

    // ── Element state machine (shared pattern) ───────────────────────────
    function createElementState(startCorner, holdTime) {
      return {
        cornerIdx: startCorner,
        x: CORNERS[startCorner].x,
        y: CORNERS[startCorner].y,
        targetX: CORNERS[startCorner].x,
        targetY: CORNERS[startCorner].y,
        phase: 0, // 0=fade-in, 1=hold, 2=fade-out, 3=travel
        elapsed: 0,
        durations: [3000, holdTime, 3000, 6000],  // fade-in, hold, fade-out, pause
      };
    }

    function tickElement(el, dt) {
      el.elapsed += dt;
      if (el.elapsed >= el.durations[el.phase]) {
        el.elapsed = 0;
        el.phase = (el.phase + 1) % 4;
        if (el.phase === 3) {
          // Stay in same corner — just pause before fading back in
          el.targetX = CORNERS[el.cornerIdx].x;
          el.targetY = CORNERS[el.cornerIdx].y;
        }
      }
      const t = Math.min(1, el.elapsed / el.durations[el.phase]);
      // Element stays in its assigned corner
      el.x = CORNERS[el.cornerIdx].x;
      el.y = CORNERS[el.cornerIdx].y;
      if (el.phase === 0) return t;
      if (el.phase === 1) return 1;
      if (el.phase === 2) return 1 - t;
      return 0;
    }

    // ── Element states (each starts in a different corner, different hold times) ──
    const metatronState  = createElementState(0, 22000); // bottom-left, 22s hold
    const spiralState    = createElementState(1, 18000); // bottom-right, 18s hold
    const yantraState    = createElementState(2, 20000); // top-right, 20s hold
    const platonicState  = createElementState(3, 16000); // top-left, 16s hold

    // ══════════════════════════════════════════════════════════════════════
    // METATRON'S CUBE RENDERER
    // ══════════════════════════════════════════════════════════════════════
    const MET_RINGS = [
      { r: 0, count: 1 }, { r: 0.11, count: 6 },
      { r: 0.22, count: 6 }, { r: 0.33, count: 6 }, { r: 0.42, count: 12 },
    ];
    const FOL_RADII = [0.11, 0.08, 0.065, 0.05, 0.03];

    function getMetCircles(ts) {
      const circles = [];
      const rots = [0, -(ts/90000)*TWO_PI, (ts/120000)*TWO_PI, -(ts/150000)*TWO_PI, (ts/200000)*TWO_PI];
      for (let ri = 0; ri < MET_RINGS.length; ri++) {
        const ring = MET_RINGS[ri];
        for (let i = 0; i < ring.count; i++) {
          const a = rots[ri] + (i * TWO_PI) / ring.count;
          circles.push({ x: ring.r === 0 ? 0 : Math.cos(a)*ring.r, y: ring.r === 0 ? 0 : Math.sin(a)*ring.r, ring: ri });
        }
      }
      return circles;
    }

    function getMetLines(circles) {
      const lines = [];
      let idx = 0;
      for (const ring of MET_RINGS) { if (ring.count > 1) { for (let i = 0; i < ring.count; i++) lines.push([idx+i, idx+((i+1)%ring.count)]); } idx += ring.count; }
      for (let i = 1; i <= 6; i++) lines.push([0, i]);
      for (let i = 0; i < 6; i++) { lines.push([1+i, 7+i]); lines.push([1+i, 7+((i+1)%6)]); }
      for (let i = 0; i < 6; i++) { lines.push([7+i, 13+i]); lines.push([7+i, 13+((i+1)%6)]); }
      for (let i = 0; i < 6; i++) { lines.push([13+i, 19+(i*2)]); lines.push([13+i, 19+(i*2+1)]); }
      for (let i = 0; i < 3; i++) lines.push([1+i, 1+i+3]);
      return lines;
    }

    function drawMetatron(ts, pcx, pcy, size, alpha) {
      const breathe = 0.5 + 0.5 * Math.sin(ts / 12500);
      const breathe2 = 0.5 + 0.5 * Math.sin(ts / 8000 + 1.5);
      const circles = getMetCircles(ts);
      const lines = getMetLines(circles);

      // Aura
      const auraR = size * 0.5;
      const aura = ctx.createRadialGradient(pcx, pcy, size*0.1, pcx, pcy, auraR);
      aura.addColorStop(0, `rgba(232,184,75,${0.025*alpha})`);
      aura.addColorStop(0.6, `rgba(180,140,60,${0.012*alpha})`);
      aura.addColorStop(1, "rgba(232,184,75,0)");
      ctx.beginPath(); ctx.arc(pcx,pcy,auraR,0,TWO_PI); ctx.fillStyle=aura; ctx.fill();

      // Flower of Life circles
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        const px = pcx+c.x*size, py = pcy+c.y*size;
        const pulse = 1 + 0.08*Math.sin(ts/5000+i*0.4);
        const r = (FOL_RADII[c.ring]||0.03)*size*pulse;
        const a = ([0.07,0.06,0.05,0.04,0.025][c.ring]||0.03 + breathe*0.03)*alpha;
        ctx.beginPath(); ctx.arc(px,py,r,0,TWO_PI);
        ctx.strokeStyle=`rgba(232,184,75,${a})`; ctx.lineWidth=0.35; ctx.stroke();
      }

      // Lines
      const bla = (0.04+breathe*0.05)*alpha;
      for (const [i,j] of lines) {
        if (i>=circles.length||j>=circles.length) continue;
        const c1=circles[i],c2=circles[j];
        const avgR=(c1.ring+c2.ring)/2;
        ctx.beginPath(); ctx.moveTo(pcx+c1.x*size,pcy+c1.y*size); ctx.lineTo(pcx+c2.x*size,pcy+c2.y*size);
        ctx.strokeStyle=`rgba(232,184,75,${bla*(1-avgR*0.15)})`; ctx.lineWidth=avgR<1?0.6:0.35; ctx.stroke();
      }

      // Vertex dots
      for (let i = 0; i < circles.length; i++) {
        const c=circles[i], px=pcx+c.x*size, py=pcy+c.y*size;
        const dotR=[2.5,2,1.5,1.2,0.8][c.ring]||1, dotA=[0.5,0.4,0.3,0.2,0.12][c.ring]||0.15;
        const haloR=dotR*4;
        const halo=ctx.createRadialGradient(px,py,0,px,py,haloR);
        halo.addColorStop(0,`rgba(232,184,75,${dotA*alpha*breathe2})`); halo.addColorStop(1,"rgba(232,184,75,0)");
        ctx.beginPath(); ctx.arc(px,py,haloR,0,TWO_PI); ctx.fillStyle=halo; ctx.fill();
        ctx.beginPath(); ctx.arc(px,py,dotR,0,TWO_PI); ctx.fillStyle=`rgba(255,230,160,${dotA*alpha})`; ctx.fill();
      }

      // Star of David triangles
      const triRot1=(ts/25000)*TWO_PI, triR=size*0.18, triA=(0.04+breathe*0.03)*alpha;
      for (let t=0;t<2;t++) {
        const rot=t===0?triRot1:-triRot1;
        ctx.beginPath();
        for (let i=0;i<=3;i++) { const a=rot+(i*TWO_PI)/3-Math.PI/2; const tx=pcx+Math.cos(a)*triR,ty=pcy+Math.sin(a)*triR; i===0?ctx.moveTo(tx,ty):ctx.lineTo(tx,ty); }
        ctx.closePath(); ctx.strokeStyle=`rgba(232,184,75,${triA})`; ctx.lineWidth=0.5; ctx.stroke();
      }

      // Outer circle + ticks
      const ocR=size*0.44, ocRot=(ts/60000)*TWO_PI;
      ctx.beginPath(); ctx.arc(pcx,pcy,ocR,0,TWO_PI);
      ctx.strokeStyle=`rgba(232,184,75,${0.025*alpha})`; ctx.lineWidth=0.3; ctx.stroke();
      for (let i=0;i<12;i++) {
        const a=ocRot+(i*TWO_PI)/12;
        ctx.beginPath(); ctx.moveTo(pcx+Math.cos(a)*(ocR-3),pcy+Math.sin(a)*(ocR-3));
        ctx.lineTo(pcx+Math.cos(a)*(ocR+3),pcy+Math.sin(a)*(ocR+3));
        ctx.strokeStyle=`rgba(232,184,75,${0.04*alpha})`; ctx.lineWidth=0.4; ctx.stroke();
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GOLDEN RATIO SPIRAL RENDERER
    // ══════════════════════════════════════════════════════════════════════
    function drawGoldenSpiral(ts, pcx, pcy, size, alpha) {
      const rot = (ts / 40000) * TWO_PI; // slow rotation
      const breathe = 0.5 + 0.5 * Math.sin(ts / 10000);
      const PHI = 1.618033988749;

      // Aura
      const aura = ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,size*0.45);
      aura.addColorStop(0,`rgba(74,184,232,${0.02*alpha})`);
      aura.addColorStop(1,"rgba(74,184,232,0)");
      ctx.beginPath(); ctx.arc(pcx,pcy,size*0.45,0,TWO_PI); ctx.fillStyle=aura; ctx.fill();

      ctx.save();
      ctx.translate(pcx, pcy);
      ctx.rotate(rot);

      // Golden rectangles — subdividing inward
      let rw = size * 0.4, rh = rw / PHI;
      let ox = 0, oy = 0;
      const rectAlpha = (0.04 + breathe * 0.03) * alpha;

      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = `rgba(74,184,232,${rectAlpha * (1 - i * 0.08)})`;
        ctx.lineWidth = 0.4;
        ctx.strokeRect(ox - rw/2, oy - rh/2, rw, rh);

        // Quarter-circle arc in each rectangle
        const arcR = Math.min(rw, rh);
        const arcCx = ox + (i%4===0 ? -rw/2 : i%4===1 ? rw/2 : i%4===2 ? rw/2 : -rw/2);
        const arcCy = oy + (i%4===0 ? -rh/2 : i%4===1 ? -rh/2 : i%4===2 ? rh/2 : rh/2);
        const startA = (i%4) * Math.PI/2;
        ctx.beginPath();
        ctx.arc(arcCx, arcCy, arcR, startA, startA + Math.PI/2);
        ctx.strokeStyle = `rgba(74,184,232,${(0.06 + breathe*0.04) * alpha * (1 - i*0.06)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Subdivide
        const newW = rh;
        const newH = rw - rh;
        if (i%4===0) { ox += (rw - newW)/2; oy -= (rh - newH)/2; }
        else if (i%4===1) { ox += (rw - newW)/2; oy += (rh - newH)/2; }
        else if (i%4===2) { ox -= (rw - newW)/2; oy += (rh - newH)/2; }
        else { ox -= (rw - newW)/2; oy -= (rh - newH)/2; }
        rw = newW; rh = newH > 0 ? newH : rh * 0.618;
        if (rw < 2 || rh < 2) break;
      }

      // Fibonacci spiral (smooth logarithmic)
      ctx.beginPath();
      const spiralTurns = 4;
      const spiralPoints = 200;
      for (let i = 0; i <= spiralPoints; i++) {
        const t = i / spiralPoints;
        const angle = t * spiralTurns * TWO_PI;
        const r = size * 0.01 * Math.pow(PHI, angle / (Math.PI/2));
        if (r > size * 0.45) break;
        const sx = Math.cos(angle) * r;
        const sy = Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.strokeStyle = `rgba(74,184,232,${(0.08 + breathe*0.05) * alpha})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Phi ratio markers — small dots along spiral
      for (let i = 1; i <= 6; i++) {
        const angle = i * Math.PI/2;
        const r = size * 0.01 * Math.pow(PHI, angle / (Math.PI/2));
        if (r > size * 0.45) break;
        const sx = Math.cos(angle) * r, sy = Math.sin(angle) * r;
        const dotR = 1.5 - i * 0.15;
        const halo = ctx.createRadialGradient(sx,sy,0,sx,sy,dotR*3);
        halo.addColorStop(0,`rgba(74,184,232,${0.3*alpha})`); halo.addColorStop(1,"rgba(74,184,232,0)");
        ctx.beginPath(); ctx.arc(sx,sy,dotR*3,0,TWO_PI); ctx.fillStyle=halo; ctx.fill();
        ctx.beginPath(); ctx.arc(sx,sy,dotR,0,TWO_PI); ctx.fillStyle=`rgba(140,220,255,${0.5*alpha})`; ctx.fill();
      }

      ctx.restore();
    }

    // ══════════════════════════════════════════════════════════════════════
    // SRI YANTRA RENDERER
    // ══════════════════════════════════════════════════════════════════════
    function drawSriYantra(ts, pcx, pcy, size, alpha) {
      const breathe = 0.5 + 0.5 * Math.sin(ts / 15000);
      const innerRot = (ts / 120000) * TWO_PI;

      // Aura
      const aura = ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,size*0.48);
      aura.addColorStop(0,`rgba(176,74,220,${0.035*alpha})`);
      aura.addColorStop(1,"rgba(176,74,220,0)");
      ctx.beginPath(); ctx.arc(pcx,pcy,size*0.48,0,TWO_PI); ctx.fillStyle=aura; ctx.fill();

      // Outer lotus petals (16 petals in outer ring, 8 in inner)
      for (let ring = 0; ring < 2; ring++) {
        const petalCount = ring === 0 ? 16 : 8;
        const petalR = size * (ring === 0 ? 0.42 : 0.34);
        const petalW = TWO_PI / petalCount * 0.4;
        const baseRot = ring === 0 ? innerRot * 0.2 : -innerRot * 0.25;
        const pa = (0.06 + breathe * 0.04) * alpha;

        for (let i = 0; i < petalCount; i++) {
          const a = baseRot + (i * TWO_PI) / petalCount;
          const tip = petalR + size * 0.04;
          ctx.beginPath();
          ctx.moveTo(pcx + Math.cos(a - petalW) * petalR, pcy + Math.sin(a - petalW) * petalR);
          ctx.quadraticCurveTo(pcx + Math.cos(a) * tip, pcy + Math.sin(a) * tip,
                                pcx + Math.cos(a + petalW) * petalR, pcy + Math.sin(a + petalW) * petalR);
          ctx.strokeStyle = `rgba(176,74,220,${pa})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // Concentric circles (3)
      for (let i = 0; i < 3; i++) {
        const r = size * (0.30 - i * 0.05);
        ctx.beginPath(); ctx.arc(pcx, pcy, r, 0, TWO_PI);
        ctx.strokeStyle = `rgba(176,74,220,${(0.07 + breathe*0.04)*alpha})`;
        ctx.lineWidth = 0.45; ctx.stroke();
      }

      // 9 interlocking triangles (the core yantra)
      // 4 upward triangles, 5 downward — at varying sizes, counter-rotating
      const triSets = [
        { dir: 1, scales: [0.26, 0.20, 0.14, 0.08], rot: innerRot },
        { dir: -1, scales: [0.24, 0.18, 0.12, 0.06, 0.03], rot: -innerRot * 1.2 },
      ];

      for (const set of triSets) {
        for (let si = 0; si < set.scales.length; si++) {
          const s = set.scales[si];
          const r = size * s;
          const rot = set.rot + si * 0.15;
          const ta = (0.09 + breathe * 0.06) * alpha * (1 - si * 0.08);

          ctx.beginPath();
          for (let i = 0; i <= 3; i++) {
            const a = rot + set.dir * ((i * TWO_PI) / 3 - Math.PI / 2);
            const tx = pcx + Math.cos(a) * r;
            const ty = pcy + Math.sin(a) * r;
            i === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
          }
          ctx.closePath();
          ctx.strokeStyle = `rgba(176,74,220,${ta})`;
          ctx.lineWidth = 0.55;
          ctx.stroke();
        }
      }

      // Gate squares (bhupura) — outermost rectangular frame
      const gateRot = innerRot * 0.15;
      for (let g = 0; g < 3; g++) {
        const gateR = size * (0.46 - g * 0.015);
        const ga = (0.045 + breathe * 0.03) * alpha;
        ctx.save();
        ctx.translate(pcx, pcy);
        ctx.rotate(gateRot + g * 0.02);
        ctx.strokeStyle = `rgba(176,74,220,${ga})`;
        ctx.lineWidth = 0.3;
        ctx.strokeRect(-gateR, -gateR, gateR*2, gateR*2);
        ctx.restore();
      }

      // Gate openings (T-shapes on each side of outer square)
      const gateOpenR = size * 0.46;
      const gateW = size * 0.04;
      const goa = 0.025 * alpha;
      for (let side = 0; side < 4; side++) {
        const a = gateRot + side * Math.PI / 2;
        const mx = pcx + Math.cos(a) * gateOpenR;
        const my = pcy + Math.sin(a) * gateOpenR;
        const px = Math.cos(a + Math.PI/2) * gateW;
        const py = Math.sin(a + Math.PI/2) * gateW;
        ctx.beginPath();
        ctx.moveTo(mx - px, my - py);
        ctx.lineTo(mx + Math.cos(a)*gateW - px, my + Math.sin(a)*gateW - py);
        ctx.lineTo(mx + Math.cos(a)*gateW + px, my + Math.sin(a)*gateW + py);
        ctx.lineTo(mx + px, my + py);
        ctx.strokeStyle = `rgba(176,74,220,${goa})`;
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }

      // Additional inner triangle details — thin inscribed triangles
      for (let i = 0; i < 3; i++) {
        const r = size * (0.05 + i * 0.03);
        const tRot = innerRot * (1.5 + i * 0.2);
        const ta2 = (0.06 + breathe * 0.04) * alpha;
        ctx.beginPath();
        for (let j = 0; j <= 3; j++) {
          const a = tRot + (j * TWO_PI) / 3 - Math.PI / 2;
          const tx = pcx + Math.cos(a) * r, ty = pcy + Math.sin(a) * r;
          j === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(220,160,255,${ta2})`;
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }

      // Central bindu (point)
      const binduPulse = 1 + 0.3 * Math.sin(ts / 3000);
      const binduR = 2.5 * binduPulse;
      const binduHalo = ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,binduR*4);
      binduHalo.addColorStop(0,`rgba(220,160,255,${0.6*alpha})`);
      binduHalo.addColorStop(1,"rgba(176,74,220,0)");
      ctx.beginPath(); ctx.arc(pcx,pcy,binduR*4,0,TWO_PI); ctx.fillStyle=binduHalo; ctx.fill();
      ctx.beginPath(); ctx.arc(pcx,pcy,binduR,0,TWO_PI);
      ctx.fillStyle=`rgba(240,200,255,${0.8*alpha})`; ctx.fill();
    }

    // ══════════════════════════════════════════════════════════════════════
    // MERKABA (Star Tetrahedron) RENDERER
    // ══════════════════════════════════════════════════════════════════════
    function drawMerkaba(ts, pcx, pcy, size, alpha) {
      const breathe = 0.5 + 0.5 * Math.sin(ts / 13000);
      const breathe2 = 0.5 + 0.5 * Math.sin(ts / 9000 + 2);

      // Two interlocking tetrahedra — one points up, one points down
      // Rotating in opposite directions
      const rot1 = ts * 0.00008;  // slow clockwise
      const rot2 = -ts * 0.00006; // slower counter-clockwise
      const tilt = Math.PI * 0.12; // slight tilt for 3D feel

      const scale = size * 0.14;

      // Tetrahedron vertices (unit)
      const tetUp = [
        [0, -1.2, 0],           // top
        [-1, 0.6, -0.7],       // base left-back
        [1, 0.6, -0.7],        // base right-back
        [0, 0.6, 1],           // base front
      ];
      const tetDown = [
        [0, 1.2, 0],            // bottom
        [-1, -0.6, -0.7],      // top left-back
        [1, -0.6, -0.7],       // top right-back
        [0, -0.6, 1],          // top front
      ];
      const tetEdges = [[0,1],[0,2],[0,3],[1,2],[2,3],[3,1]];

      function rotateY(v, a) {
        return [v[0]*Math.cos(a)-v[2]*Math.sin(a), v[1], v[0]*Math.sin(a)+v[2]*Math.cos(a)];
      }
      function rotateX(v, a) {
        return [v[0], v[1]*Math.cos(a)-v[2]*Math.sin(a), v[1]*Math.sin(a)+v[2]*Math.cos(a)];
      }
      function proj(v) {
        const d = 5;
        const s = d / (d + v[2]);
        return { x: v[0] * s * scale, y: v[1] * s * scale, z: v[2] };
      }

      // Aura
      const auraR = size * 0.42;
      const aura = ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,auraR);
      aura.addColorStop(0, `rgba(94,232,176,${0.025*alpha})`);
      aura.addColorStop(1, "rgba(94,232,176,0)");
      ctx.beginPath(); ctx.arc(pcx,pcy,auraR,0,TWO_PI); ctx.fillStyle=aura; ctx.fill();

      // Draw both tetrahedra
      const tets = [
        { verts: tetUp, rot: rot1, color: "94,232,176", label: "up" },
        { verts: tetDown, rot: rot2, color: "120,200,255", label: "down" },
      ];

      for (const tet of tets) {
        const projected = tet.verts.map(v => {
          let rv = rotateY(v, tet.rot);
          rv = rotateX(rv, tilt);
          return proj(rv);
        });

        const lineA = (0.08 + breathe * 0.06) * alpha;

        // Edges
        ctx.lineWidth = 0.5;
        for (const [i, j] of tetEdges) {
          const a = projected[i], b = projected[j];
          const avgZ = (a.z + b.z) / 2;
          const df = 0.4 + 0.6 * Math.max(0, Math.min(1, (avgZ + 2) / 4));
          ctx.beginPath();
          ctx.moveTo(pcx + a.x, pcy + a.y);
          ctx.lineTo(pcx + b.x, pcy + b.y);
          ctx.strokeStyle = `rgba(${tet.color},${lineA * df})`;
          ctx.stroke();
        }

        // Face fills (very subtle transparent)
        const faceA = (0.012 + breathe2 * 0.008) * alpha;
        const faces = [[0,1,2],[0,2,3],[0,3,1],[1,2,3]];
        for (const face of faces) {
          const [a,b,c] = face.map(i => projected[i]);
          ctx.beginPath();
          ctx.moveTo(pcx+a.x, pcy+a.y);
          ctx.lineTo(pcx+b.x, pcy+b.y);
          ctx.lineTo(pcx+c.x, pcy+c.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(${tet.color},${faceA})`;
          ctx.fill();
        }

        // Vertices
        for (const p of projected) {
          const df = 0.4 + 0.6 * Math.max(0, Math.min(1, (p.z + 2) / 4));
          const dotR = 1.5 * df + 0.5;
          const halo = ctx.createRadialGradient(pcx+p.x,pcy+p.y,0,pcx+p.x,pcy+p.y,dotR*3.5);
          halo.addColorStop(0, `rgba(${tet.color},${0.3*alpha*df})`);
          halo.addColorStop(1, `rgba(${tet.color},0)`);
          ctx.beginPath(); ctx.arc(pcx+p.x,pcy+p.y,dotR*3.5,0,TWO_PI);
          ctx.fillStyle=halo; ctx.fill();
          ctx.beginPath(); ctx.arc(pcx+p.x,pcy+p.y,dotR,0,TWO_PI);
          ctx.fillStyle=`rgba(200,255,230,${0.5*alpha*df})`; ctx.fill();
        }
      }

      // Central energy core — pulsing at intersection
      const coreR = 3 + breathe2 * 2;
      const coreHalo = ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,coreR*5);
      coreHalo.addColorStop(0, `rgba(200,255,230,${0.2*alpha})`);
      coreHalo.addColorStop(0.4, `rgba(94,232,176,${0.08*alpha})`);
      coreHalo.addColorStop(1, "rgba(94,232,176,0)");
      ctx.beginPath(); ctx.arc(pcx,pcy,coreR*5,0,TWO_PI); ctx.fillStyle=coreHalo; ctx.fill();
      ctx.beginPath(); ctx.arc(pcx,pcy,coreR,0,TWO_PI);
      ctx.fillStyle=`rgba(220,255,240,${0.5*alpha})`; ctx.fill();

      // Outer sphere (containment)
      ctx.beginPath(); ctx.arc(pcx,pcy,size*0.38,0,TWO_PI);
      ctx.strokeStyle=`rgba(94,232,176,${0.02*alpha})`; ctx.lineWidth=0.3; ctx.stroke();

      // Second sphere slightly larger
      ctx.beginPath(); ctx.arc(pcx,pcy,size*0.42,0,TWO_PI);
      ctx.strokeStyle=`rgba(94,232,176,${0.012*alpha})`; ctx.lineWidth=0.25; ctx.stroke();
    }

    // ══════════════════════════════════════════════════════════════════════
    // MAIN DRAW LOOP
    // ══════════════════════════════════════════════════════════════════════
    let lt = 0, raf;

    const draw = (ts) => {
      if (!lt) lt = ts;
      const dt = ts - lt;
      lt = ts;
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      const S = Math.min(W, H);

      // Tick all element state machines
      const metAlpha  = tickElement(metatronState, dt);
      const spirAlpha = tickElement(spiralState, dt);
      const yanAlpha  = tickElement(yantraState, dt);
      const platAlpha = tickElement(platonicState, dt);

      // Particles
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(ts*0.00015+p.ph)*0.00015;
        if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        p.ph += p.sp * dt;
        const a = p.baseA * (0.5+0.5*Math.sin(p.ph));
        ctx.beginPath(); ctx.arc(p.x*W, p.y*H, p.r, 0, TWO_PI);
        ctx.fillStyle = `rgba(180,200,240,${a})`; ctx.fill();
      }

      // Draw each element at its current position
      const eSize = S * 0.32;

      if (metAlpha > 0.01)  drawMetatron(ts, metatronState.x*W, metatronState.y*H, eSize, metAlpha);
      if (spirAlpha > 0.01) drawGoldenSpiral(ts, spiralState.x*W, spiralState.y*H, eSize, spirAlpha);
      if (yanAlpha > 0.01)  drawSriYantra(ts, yantraState.x*W, yantraState.y*H, eSize, yanAlpha);
      if (platAlpha > 0.01) drawMerkaba(ts, platonicState.x*W, platonicState.y*H, eSize, platAlpha);

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
