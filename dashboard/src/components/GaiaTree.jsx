import { useRef, useEffect } from "react";
import { FRUIT_DEFS, DOMAIN_ORBS } from "../utils/constants";
import {
  bezierPoint, drawTapered, getFruitPositions,
  getTrunkPoints, getTrunkAt, getBranchPath,
  TREE_STARS, LEAF_DEFS,
} from "../utils/treeHelpers";

export default function GaiaTree({ fruitRipeness, activePulses, selectedFruit, onFruitClick, sshCtrlPulse }) {
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
          ? 0.9 + 0.1 * Math.sin(tSec * 6)
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
