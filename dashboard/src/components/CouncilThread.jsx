import { useState, useEffect } from "react";
import { gaiaCondense } from "../utils/constants";

export default function CouncilThread({ messages }) {
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [summaries, setSummaries] = useState({});

  // Fire summarization for new messages
  useEffect(() => {
    messages.forEach((msg, i) => {
      const key = `${msg.speaker}-${i}`;
      if (summaries[key] !== undefined) return;
      if (!msg.text || msg.text.length < 80) {
        setSummaries(prev => ({ ...prev, [key]: msg.text }));
        return;
      }
      setSummaries(prev => ({ ...prev, [key]: null }));
      gaiaCondense(msg.speaker, msg.text).then(summary => {
        setSummaries(prev => ({ ...prev, [key]: summary || msg.text }));
      });
    });
  }, [messages.length]);

  const toggleExpand = (key) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <>
      {messages.map((msg, i) => {
        const key = `${msg.speaker}-${i}`;
        const summary = summaries[key];
        const isLoading = summary === null || summary === undefined;
        const isShort = msg.text && msg.text.length < 80;
        const isExpanded = expandedCards.has(key);
        const hasSummary = !isLoading && !isShort && summary !== msg.text;

        return (
          <div key={i} className={`chat-message ${msg.speaker}-msg`} style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="chat-msg-header">
              <div className={`chat-avatar ${msg.speaker}`}>
                {msg.speaker === "zeus" ? "\u26a1" : msg.speaker === "poseidon" ? "\ud83d\udd31" : "\ud83c\udfdb"}
              </div>
              <div className="chat-content">
                <div className={`chat-speaker ${msg.speaker}`}>{msg.speaker.toUpperCase()}</div>
              </div>
              {msg.vote === "calling" && <div className="vote-badge calling">{"\u2696"} CALLING VOTE</div>}
              {msg.vote === "aye"     && <div className="vote-badge aye">{"\u2713"} AYE</div>}
            </div>
            {isLoading && !isShort ? (
              <div style={{ padding: "4px 18px 12px 22px" }}>
                <div className="gaia-shimmer gaia-shimmer-long" />
                <div className="gaia-shimmer gaia-shimmer-short" />
              </div>
            ) : hasSummary ? (
              <>
                <div className="gaia-summary-label">GAIA WITNESS</div>
                <div className="gaia-summary-text">{summary}</div>
                <button className="card-expand-btn" onClick={() => toggleExpand(key)}>
                  <span className={`chevron ${isExpanded ? "open" : ""}`}>{"\u25be"}</span>
                  {isExpanded ? "collapse" : "read full"}
                </button>
                {isExpanded && <div className="card-full-text">{msg.text}</div>}
              </>
            ) : (
              <div className="chat-text">{msg.text}</div>
            )}
          </div>
        );
      })}
      {messages.length === 0 && (
        <div style={{ color: "var(--muted)", fontSize: 15, fontFamily: "Cinzel, serif", letterSpacing: "0.12em", textAlign: "center", padding: "24px 0" }}>Awaiting council...</div>
      )}
    </>
  );
}
