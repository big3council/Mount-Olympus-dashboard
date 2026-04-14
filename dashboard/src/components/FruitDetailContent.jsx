import { FRUIT_DEFS, FRUIT_INFO } from "../utils/constants";

export default function FruitDetailContent({ fruitId, ripeness, growthHistory }) {
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
        <div style={{ fontSize: 9, color: "var(--text)", lineHeight: 1.7 }}>{info.domain}</div>
        <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.7, marginTop: 5 }}>{info.desc}</div>
      </div>
      <div className="fruit-panel-section">
        <div className="fruit-panel-label">Growth Directives {growthHistory.length > 0 ? `(${growthHistory.length})` : ""}</div>
        {growthHistory.length === 0 && (
          <div style={{ fontSize: 9, color: "var(--dim)", lineHeight: 1.7 }}>No directives issued yet. Gaia is watching.</div>
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
