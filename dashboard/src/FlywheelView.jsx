// FlywheelView.jsx — Mount Olympus dashboard view for the Flywheel backend.
// Self-contained: polls /flywheel/jobs every 10s, renders job list with expandable detail.
// Proxied via vite to framework on localhost:18780.

import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const shortId = (id) => (id || '').replace(/^(job|wp|plan|dep|ret|find)-/, '').slice(0, 8);
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const fmtAgo = (iso) => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
};

const STATUS_COLORS = {
  submitted:          '#6ec1ff',
  plan_proposed:      '#f0c060',
  work_in_progress:   '#5ee8b0',
  awaiting_accept:    '#f0c060',
  accepted:           '#5ee8b0',
  returned:           '#c896ff',
  returned_stale:     '#ff8866',
  timed_out:          '#ff5050',
  completed:          '#5ee8b0',
  open:               '#6ec1ff',
  proposed:           '#f0c060',
  ratified:           '#5ee8b0',
  synthesized:        '#c896ff',
  converged:          '#5ee8b0',
  approved:           '#5ee8b0',
  granted:            '#5ee8b0',
  denied:             '#ff5050',
  expired:            '#ff8866',
};
const statusColor = (s) => STATUS_COLORS[s] || '#8a9dab';


// ---------------------------------------------------------------------------
// FlywheelView
// ---------------------------------------------------------------------------
export default function FlywheelView() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastPollAt, setLastPollAt] = useState(null);
  const pollTimerRef = useRef(null);

  // Polling loop
  const fetchJobs = useCallback(async () => {
    try {
      const resp = await fetch('/flywheel/jobs');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const sorted = (data.jobs || []).slice().sort((a, b) => {
        const ta = new Date(a.updated_at || a.created_at).getTime();
        const tb = new Date(b.updated_at || b.created_at).getTime();
        return tb - ta;
      });
      setJobs(sorted);
      setError(null);
      setLastPollAt(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    pollTimerRef.current = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [fetchJobs]);

  // When a job is selected, fetch its full detail (job record only; related
  // records can be derived from the job's ids).
  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/flywheel/jobs/${selectedJobId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!cancelled) setSelectedJobDetail(data);
      } catch (e) {
        if (!cancelled) setSelectedJobDetail({ error: e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedJobId, lastPollAt]);

  // Aggregate status tallies for the header strip
  const tallies = jobs.reduce((acc, j) => {
    acc.total++;
    acc.byStatus[j.status] = (acc.byStatus[j.status] || 0) + 1;
    return acc;
  }, { total: 0, byStatus: {} });

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || selectedJobDetail;

  return (
    <>
      <style>{flywheelCss}</style>
      <div className="flywheel-view">
        {/* Header strip */}
        <div className="fw-header">
          <div className="fw-header-title">
            <span className="fw-header-mark">⚙</span>
            <div>
              <div className="fw-header-label">FLYWHEEL</div>
              <div className="fw-header-sub">
                {loading ? 'loading…' : `${tallies.total} jobs · last poll ${fmtAgo(lastPollAt)}`}
              </div>
            </div>
          </div>
          <div className="fw-tallies">
            <div className="fw-tally">
              <div className="fw-tally-label">DELIVERED</div>
              <div className="fw-tally-value">{tallies.byStatus['delivered'] || 0}</div>
            </div>
            <div className="fw-tally">
              <div className="fw-tally-label">IN PROGRESS</div>
              <div className="fw-tally-value">
                {(tallies.byStatus['work_in_progress'] || 0)
                  + (tallies.byStatus['accepted'] || 0)
                  + (tallies.byStatus['awaiting_accept'] || 0)}
              </div>
            </div>
            <div className="fw-tally">
              <div className="fw-tally-label">OPEN</div>
              <div className="fw-tally-value">{tallies.byStatus['submitted'] || 0}</div>
            </div>
          </div>
        </div>

        {error && <div className="fw-error">flywheel fetch error: {error}</div>}

        {/* Two-pane: list + detail */}
        <div className="fw-body">
          <div className="fw-list">
            {!loading && jobs.length === 0 && (
              <div className="fw-empty">No jobs in the flywheel yet. Submit one via @olympusforge_bot.</div>
            )}
            {jobs.map((job) => {
              return (
                <button
                  key={job.id}
                  className={`fw-row ${selectedJobId === job.id ? 'selected' : ''}`}
                  onClick={() => setSelectedJobId(job.id === selectedJobId ? null : job.id)}
                >
                  <div className="fw-row-top">
                    <span className="fw-row-id">{shortId(job.id)}</span>
                    <span className="fw-row-status" style={{ color: statusColor(job.status) }}>
                      ● {job.status}
                    </span>
                    <span className="fw-row-time">{fmtAgo(job.updated_at || job.created_at)}</span>
                  </div>
                  <div className="fw-row-title">{job.title}</div>
                  <div className="fw-row-meta">
                    <span>by {job.submitter}</span>
                    <span className="fw-sep">·</span>
                    <span>{(job.work_package_ids || []).length} WP</span>
                    {job.routing_plan_id && (
                      <>
                        <span className="fw-sep">·</span>
                        <span>plan {shortId(job.routing_plan_id)}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="fw-detail">
            {!selectedJob && (
              <div className="fw-detail-empty">
                Select a job to see its full record.
              </div>
            )}
            {selectedJob && selectedJobDetail && !selectedJobDetail.error && (
              <div className="fw-detail-inner">
                <div className="fw-detail-header">
                  <div className="fw-detail-title">{selectedJobDetail.title}</div>
                  <div className="fw-detail-id">{selectedJobDetail.id}</div>
                </div>
                <div className="fw-detail-meta">
                  <div><span className="fw-k">status</span> <span style={{ color: statusColor(selectedJobDetail.status) }}>{selectedJobDetail.status}</span></div>
                  <div><span className="fw-k">submitter</span> {selectedJobDetail.submitter}</div>
                  <div><span className="fw-k">created</span> {fmtTime(selectedJobDetail.created_at)} ({fmtAgo(selectedJobDetail.created_at)})</div>
                  <div><span className="fw-k">updated</span> {fmtTime(selectedJobDetail.updated_at)} ({fmtAgo(selectedJobDetail.updated_at)})</div>
                </div>
                {selectedJobDetail.description && (
                  <div className="fw-detail-description">
                    <div className="fw-k">description</div>
                    <pre>{selectedJobDetail.description}</pre>
                  </div>
                )}
                <div className="fw-detail-section">
                  <div className="fw-k">routing plan</div>
                  <div className="fw-mono">{selectedJobDetail.routing_plan_id || '—'}</div>
                </div>
                <div className="fw-detail-section">
                  <div className="fw-k">work packages ({(selectedJobDetail.work_package_ids || []).length})</div>
                  <ul className="fw-wp-list">
                    {(selectedJobDetail.work_package_ids || []).map((wp) => (
                      <li key={wp} className="fw-mono">{wp}</li>
                    ))}
                    {(selectedJobDetail.work_package_ids || []).length === 0 && (
                      <li className="fw-empty-small">none</li>
                    )}
                  </ul>
                </div>
                <div className="fw-detail-footer">
                  Auto-refreshes every {POLL_INTERVAL_MS / 1000}s
                </div>
              </div>
            )}
            {selectedJobDetail && selectedJobDetail.error && (
              <div className="fw-error">detail fetch error: {selectedJobDetail.error}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles — scoped to .flywheel-view, matches dashboard dark theme
// ---------------------------------------------------------------------------
const flywheelCss = `
.flywheel-view {
  position: absolute;
  inset: 60px 0 80px 0;
  display: flex;
  flex-direction: column;
  color: var(--text, #d8dee9);
  font-family: 'Inter', sans-serif;
  overflow: hidden;
}

.fw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border2, rgba(200,150,10,0.15));
  background: var(--bg2, rgba(20,25,30,0.6));
  flex-shrink: 0;
}

.fw-header-title { display: flex; align-items: center; gap: 14px; }
.fw-header-mark {
  font-size: 22px;
  color: var(--gold, #e6b44c);
  animation: fw-spin 12s linear infinite;
}
@keyframes fw-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.fw-header-label {
  font-size: 13px;
  letter-spacing: 0.32em;
  color: var(--gold2, #f0c060);
  font-weight: 600;
}
.fw-header-sub {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--muted, #8a9dab);
  text-transform: uppercase;
  margin-top: 2px;
}

.fw-tallies {
  display: flex;
  gap: 24px;
  align-items: center;
}
.fw-tally {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.fw-tally-label {
  font-size: 9px;
  letter-spacing: 0.15em;
  color: var(--muted, #8a9dab);
  text-transform: uppercase;
}
.fw-tally-value {
  font-size: 18px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text, #d8dee9);
  margin-top: 2px;
}

.fw-error {
  padding: 8px 24px;
  background: rgba(255, 80, 80, 0.08);
  border-bottom: 1px solid rgba(255, 80, 80, 0.3);
  color: #ff8866;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
}

.fw-body {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 1px;
  flex: 1;
  min-height: 0;
  background: rgba(200, 150, 10, 0.08);
}

.fw-list {
  background: var(--bg1, #0a0d10);
  overflow-y: auto;
  padding: 8px 8px 40px 8px;
}

.fw-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--muted, #8a9dab);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.fw-row {
  display: block;
  width: 100%;
  text-align: left;
  background: var(--bg2, rgba(20,25,30,0.6));
  border: 1px solid var(--border, rgba(200,150,10,0.1));
  padding: 12px 14px;
  margin-bottom: 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  color: var(--text, #d8dee9);
  font-family: inherit;
}
.fw-row:hover { border-color: var(--gold, #e6b44c); background: rgba(200,150,10,0.06); }
.fw-row.selected {
  border-color: var(--gold2, #f0c060);
  background: rgba(200,150,10,0.1);
  box-shadow: inset 3px 0 0 var(--gold2, #f0c060);
}

.fw-row-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 10px;
  letter-spacing: 0.08em;
  font-family: 'JetBrains Mono', monospace;
}
.fw-row-id {
  color: var(--muted, #8a9dab);
}
.fw-row-class {
  padding: 1px 7px;
  border: 1px solid;
  border-radius: 2px;
  font-size: 9px;
}
.fw-row-status {
  font-size: 10px;
  margin-left: 4px;
}
.fw-row-time {
  margin-left: auto;
  color: var(--muted, #8a9dab);
  text-transform: lowercase;
}

.fw-row-title {
  font-size: 14px;
  color: var(--text, #d8dee9);
  margin-bottom: 4px;
  line-height: 1.3;
}
.fw-row-meta {
  font-size: 10px;
  color: var(--muted, #8a9dab);
  letter-spacing: 0.04em;
}
.fw-sep { margin: 0 6px; opacity: 0.5; }

.fw-detail {
  background: var(--bg1, #0a0d10);
  padding: 20px 24px 40px 24px;
  overflow-y: auto;
}
.fw-detail-empty {
  color: var(--muted, #8a9dab);
  font-size: 12px;
  text-align: center;
  padding: 40px 20px;
  letter-spacing: 0.08em;
}

.fw-detail-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border, rgba(200,150,10,0.1));
}
.fw-detail-title {
  font-size: 18px;
  color: var(--text, #d8dee9);
  margin-bottom: 6px;
  line-height: 1.3;
}
.fw-detail-id {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--muted, #8a9dab);
  letter-spacing: 0.04em;
}

.fw-detail-meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text, #d8dee9);
}
.fw-k {
  display: inline-block;
  color: var(--muted, #8a9dab);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 9px;
  margin-right: 6px;
}

.fw-detail-description {
  background: var(--bg2, rgba(20,25,30,0.6));
  border: 1px solid var(--border, rgba(200,150,10,0.1));
  border-radius: 3px;
  padding: 10px 12px;
  margin-bottom: 16px;
}
.fw-detail-description pre {
  margin: 4px 0 0 0;
  font-family: inherit;
  font-size: 11px;
  color: var(--text, #d8dee9);
  white-space: pre-wrap;
  line-height: 1.5;
}

.fw-detail-section {
  margin-bottom: 14px;
}

.fw-wp-list {
  list-style: none;
  padding: 0;
  margin: 6px 0 0 0;
}
.fw-wp-list li {
  padding: 4px 8px;
  background: var(--bg2, rgba(20,25,30,0.6));
  border: 1px solid var(--border, rgba(200,150,10,0.1));
  border-radius: 2px;
  margin-bottom: 4px;
  font-size: 10px;
  color: var(--text, #d8dee9);
}
.fw-empty-small { color: var(--muted, #8a9dab); font-size: 10px; padding: 4px 0; border: none; background: transparent; }
.fw-mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text, #d8dee9); }

.fw-detail-footer {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid var(--border, rgba(200,150,10,0.1));
  font-size: 9px;
  letter-spacing: 0.08em;
  color: var(--muted, #8a9dab);
  text-transform: uppercase;
  text-align: center;
}
`;
