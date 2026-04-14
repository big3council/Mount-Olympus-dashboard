import { useState, useEffect } from "react";
import { gaiaCondense } from "../utils/constants";

export default function SummarizedBlock({ text, label, style, threshold = 120 }) {
  const [summary, setSummary] = useState(undefined);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!text || text.length < threshold) {
      setSummary(text);
      return;
    }
    setSummary(null);
    let cancelled = false;
    gaiaCondense("council member", text).then(s => {
      if (!cancelled) setSummary(s || text);
    });
    return () => { cancelled = true; };
  }, [text]);

  if (!text) return null;

  const isLoading = summary === null;
  const isShort = text.length < threshold;
  const hasSummary = !isLoading && !isShort && summary !== text;

  if (isShort) {
    return <div className="thought-block" style={style}>{text}</div>;
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {isLoading ? (
        <div style={{ padding: "8px 0" }}>
          <div className="gaia-shimmer gaia-shimmer-long" />
          <div className="gaia-shimmer gaia-shimmer-short" />
        </div>
      ) : hasSummary ? (
        <>
          <div className="gaia-summary-label">GAIA SUMMARY</div>
          <div className="gaia-summary-text">{summary}</div>
          <button className="card-expand-btn" onClick={() => setExpanded(!expanded)}>
            <span className={`chevron ${expanded ? "open" : ""}`}>{"\u25be"}</span>
            {expanded ? "collapse" : "read full"}
          </button>
          {expanded && <div className="card-full-text">{text}</div>}
        </>
      ) : (
        <div className="thought-block" style={style}>{text}</div>
      )}
    </div>
  );
}
