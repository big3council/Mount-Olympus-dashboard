import { useRef, useEffect } from "react";

export default function StarField() {
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
