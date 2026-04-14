import { useRef, useEffect } from "react";

export default function CouncilTriangle({ classifying = false }) {
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
        fontSize: 9,
        letterSpacing: "0.25em",
        color: classifying ? "var(--gold2)" : "var(--muted)",
        marginTop: 16,
        textAlign: "center",
        transition: "color 0.4s",
      }}>
        {classifying ? "ROUTER CLASSIFYING . . ." : "B3C COUNCIL · PRESENT AND WAITING"}
      </div>
    </div>
  );
}
