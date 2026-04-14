import { FRUIT_DEFS } from "./constants";

export function bezierPoint(p0, cp1, cp2, p1, t) {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*p1.x,
    y: u*u*u*p0.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*p1.y,
  };
}

export function bezierTangent(p0, cp1, cp2, p1, t) {
  const u = 1 - t;
  return {
    x: 3*u*u*(cp1.x-p0.x) + 6*u*t*(cp2.x-cp1.x) + 3*t*t*(p1.x-cp2.x),
    y: 3*u*u*(cp1.y-p0.y) + 6*u*t*(cp2.y-cp1.y) + 3*t*t*(p1.y-cp2.y),
  };
}

export function drawTapered(ctx, p0, cp1, cp2, p1, wStart, wEnd, fillStyle, alpha) {
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

export function getFruitPositions(W, H) {
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

export function getTrunkPoints(W, H) {
  const gY = H * 0.60;
  const cx = W / 2;
  return {
    base: { x: cx,       y: gY + 20 },
    tip:  { x: cx + 8,   y: gY - H*0.47 },
  };
}

export function getTrunkAt(W, H, t) {
  const { base, tip } = getTrunkPoints(W, H);
  return { x: base.x + (tip.x - base.x) * t, y: base.y + (tip.y - base.y) * t };
}

export function getBranchPath(W, H, fruitId) {
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

function lcg(seed) { return ((seed * 1664525 + 1013904223) >>> 0) / 4294967296; }

export const TREE_STARS = Array.from({ length: 120 }, (_, i) => {
  const r = ((i * 2654435761) >>> 0) / 4294967296;
  const r2 = ((i * 1664525 + 1013904223) >>> 0) / 4294967296;
  const r3 = ((i * 22695477 + 1) >>> 0) / 4294967296;
  return { xf: r, yf: r2 * 0.62, radius: r3 * 1.1 + 0.2, a: r2 * 0.55 + 0.1 };
});

export const LEAF_DEFS = Array.from({ length: 28 }, (_, i) => {
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
