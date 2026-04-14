const STAMP_AGENTS = [
  { key: "zeus",     symbol: "⚡", name: "ZEUS",     cls: "zeus"     },
  { key: "poseidon", symbol: "🔱", name: "POSEIDON", cls: "poseidon" },
  { key: "hades",    symbol: "🏛",  name: "HADES",   cls: "hades"   },
];

export function deriveVotes(messages) {
  const voted = { zeus: false, poseidon: false, hades: false };
  let unanimous = false;
  for (const msg of messages) {
    if (msg.vote === "approve") {
      voted.zeus = true; voted.poseidon = true; voted.hades = true;
      unanimous = true;
    } else if (
      msg.vote === "aye" ||
      msg.text?.includes("VOTE: AYE") ||
      msg.text?.includes("VOTE: APPROVE")
    ) {
      if (msg.speaker in voted) voted[msg.speaker] = true;
    }
  }
  if (voted.zeus && voted.poseidon && voted.hades) unanimous = true;
  return { voted, unanimous };
}

export default function VoteStamps({ messages, missionId }) {
  const { voted, unanimous } = deriveVotes(messages);
  return (
    <div className="stamp-section">
      <div className="stamp-row">
        {STAMP_AGENTS.map(agent => {
          const isVoted = voted[agent.key];
          return (
            <div key={`${missionId}-${agent.key}`}
              className={`stamp-box ${isVoted ? `stamp-voted stamp-voted-${agent.cls}` : ""}`}>
              <span className="stamp-icon">{agent.symbol}</span>
              <span className="stamp-label">{agent.name}</span>
              {isVoted && <span className="stamp-aye">AYE</span>}
            </div>
          );
        })}
      </div>
      {unanimous && (
        <div className="vote-unanimous" style={{ marginBottom: 0 }}>
          <div className="vote-unanimous-mark">⚡</div>
          <div>
            <div className="vote-unanimous-text">UNANIMOUS — APPROVED</div>
            <div className="vote-unanimous-sub">Zeus · Poseidon · Hades all in favor</div>
          </div>
        </div>
      )}
    </div>
  );
}
