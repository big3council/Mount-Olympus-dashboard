import { QUORUM_MAP } from "../../utils/constants";

// QuorumPanel — rendered below a B3C head card for T2 missions.
//
// Mode = "full"    → head assigned: assignments list, spark return cards,
//                    backend synthesis section.
// Mode = "compact" → head unassigned: smoke test strip showing quorum health.
//
// Renders null if mission has no quorum data at all (keeps pre-T2 UI clean).
export default function QuorumPanel({ head, mode, quorumState, smokeTestResults }) {
  const headState = quorumState?.[head] || {};
  const { assignments = [], spark_returns = [], backend_council = [] } = headState;
  const headUpper = head.toUpperCase();
  const members = QUORUM_MAP[headUpper] || [];

  if (mode === "compact") {
    return <SmokeStrip head={head} members={members} smokeTestResults={smokeTestResults} />;
  }

  // Full mode — only render if we actually have data yet
  const hasAnyData = assignments.length > 0 || spark_returns.length > 0 || backend_council.length > 0;
  if (!hasAnyData) return null;

  return (
    <div className="quorum-panel full">
      {assignments.length > 0 && (
        <div className="quorum-section">
          <div className="quorum-section-label">Assignments</div>
          <ul className="quorum-assignments">
            {assignments.map((a, i) => (
              <li key={i} className="quorum-assignment-item">
                <span className="quorum-assignment-spark">{a.spark}</span>
                <span className="quorum-assignment-task">{a.task || a.text || ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {spark_returns.length > 0 && (
        <div className="quorum-section">
          <div className="quorum-section-label">
            Sparks <span className="quorum-section-count">{spark_returns.length}/{assignments.length || spark_returns.length}</span>
          </div>
          <div className="quorum-spark-grid">
            {spark_returns.map((s, i) => (
              <SparkCard
                key={`${s.spark}-${i}`}
                entry={s}
                assignment={assignments.find(a => a.spark === s.spark) || null}
              />
            ))}
          </div>
        </div>
      )}

      {backend_council.length > 0 && (
        <div className="quorum-section">
          <div className="quorum-section-label">Backend Synthesis</div>
          <div className="quorum-backend">
            {backend_council.map((m, i) => (
              <div key={i} className="quorum-backend-msg">
                <span className="quorum-backend-speaker">{(m.speaker || "").toUpperCase()}</span>
                <span className="quorum-backend-text">{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// SparkCard — mirrors the B3C execution card pattern.
// Header: name + status badge + optional confidence score.
// Body (priority cascade): failed → error, else deliverable assignment,
// then finding output, with "working…" fallback when nothing has returned yet.
function SparkCard({ entry, assignment }) {
  const status = entry.status || "complete";
  const classes = `spark-card spark-${status}`;
  const deliverable = assignment?.task || assignment?.text || null;
  const finding = entry.output ? String(entry.output) : null;

  // Confidence may ride on entry.confidence (0-1 or 0-100). Normalize to percent.
  const rawConf = entry.confidence ?? entry.score ?? null;
  const confidencePct = rawConf == null
    ? null
    : rawConf > 1
      ? Math.round(rawConf)
      : Math.round(rawConf * 100);

  const badgeLabel = status === "failed"   ? "FAILED"
                  : status === "working"   ? "WORKING"
                  : status === "complete"  ? "COMPLETE"
                  : null;

  return (
    <div className={classes}>
      <div className="spark-card-head">
        <span className="spark-card-name">{entry.spark}</span>
        {badgeLabel && <span className={`spark-card-badge spark-badge-${status}`}>{badgeLabel}</span>}
        {confidencePct != null && (
          <span className="spark-card-confidence" title={`Confidence ${confidencePct}%`}>
            {confidencePct}%
          </span>
        )}
      </div>
      {deliverable && (
        <div className="spark-card-deliverable">{deliverable}</div>
      )}
      {entry.error ? (
        <div className="spark-card-error">{entry.error}</div>
      ) : finding ? (
        <div className="spark-card-finding">
          {finding.length > 280 ? finding.slice(0, 280) + "…" : finding}
        </div>
      ) : (
        <div className="spark-card-pending">working…</div>
      )}
    </div>
  );
}

function SmokeStrip({ head, members, smokeTestResults }) {
  const results = smokeTestResults?.[head] || {};
  if (members.length === 0) return null;

  return (
    <div className="quorum-panel compact">
      <div className="smoke-strip">
        <span className="smoke-strip-label">QUORUM</span>
        {members.map(m => {
          const r = results[m];
          const state = r == null ? "unknown" : r.ok ? "ok" : "failed";
          const title = r == null
            ? `${m} — no smoke test yet`
            : r.ok
              ? `${m} — ok (${r.latency_ms ?? "?"}ms)`
              : `${m} — failed`;
          return (
            <span key={m} className={`smoke-chip smoke-${state}`} title={title}>
              <span className="smoke-chip-dot" />
              {m}
            </span>
          );
        })}
      </div>
    </div>
  );
}
