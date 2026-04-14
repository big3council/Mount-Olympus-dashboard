#!/usr/bin/env bash
# ~/olympus/gaia-memory-distill.sh
# Mount Olympus — Gaia nightly council-memory distillation.
#
# Reads the last 7 days of council session entries from the institutional
# council archive, asks Gaia's OpenClaw to distill recurring patterns, and
# writes the result to patterns.json. Each run is logged to distill-log.jsonl.
#
# Triggered by crontab on Gaia: 0 4 * * * (04:00 local, daily).
#
# Failure-mode behavior:
#   - Missing archive → logs and exits 0 (nothing to distill).
#   - OpenClaw unreachable → logs error, writes no patterns.json update,
#     exits non-zero. Prior patterns.json stays intact.
#   - Malformed Gaia response → same as above.

set -euo pipefail

ARCHIVE_ROOT="/Volumes/olympus/pool/memory/council/institutional"
ARCHIVE_FILE="${ARCHIVE_ROOT}/archive.jsonl"
PATTERNS_FILE="${ARCHIVE_ROOT}/patterns.json"
LOG_FILE="${ARCHIVE_ROOT}/distill-log.jsonl"

GAIA_URL="${GAIA_URL:-http://192.168.1.14:18789/v1/chat/completions}"
GAIA_TOKEN="${GAIA_OPENCLAW_TOKEN:-}"

WINDOW_DAYS=7
MAX_ENTRIES=60         # cap input to keep Haiku/Gaia cost sane
TIMESTAMP_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

log_event() {
  local level="$1"; shift
  local message="$*"
  printf '{"ts":"%s","level":"%s","msg":%s}\n' \
    "$TIMESTAMP_NOW" "$level" "$(printf '%s' "$message" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')" \
    >> "$LOG_FILE" 2>/dev/null || true
  echo "[distill] $level: $message"
}

if [[ -z "$GAIA_TOKEN" ]]; then
  # Try loading from the shared env file
  if [[ -f /Volumes/olympus/config/shared.env ]]; then
    # shellcheck disable=SC1091
    set -a; source /Volumes/olympus/config/shared.env; set +a
    GAIA_TOKEN="${GAIA_OPENCLAW_TOKEN:-}"
  fi
fi

if [[ -z "$GAIA_TOKEN" ]]; then
  log_event error "GAIA_OPENCLAW_TOKEN missing; cannot call Gaia"
  exit 2
fi

if [[ ! -s "$ARCHIVE_FILE" ]]; then
  log_event info "archive empty or missing; nothing to distill"
  exit 0
fi

# Select entries from the last N days, capped at MAX_ENTRIES.
RECENT_ENTRIES=$(python3 - "$ARCHIVE_FILE" "$WINDOW_DAYS" "$MAX_ENTRIES" <<'PY'
import json, sys, datetime
path, window_days, max_entries = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=window_days)
keep = []
with open(path, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        try:
            entry = json.loads(line)
        except Exception:
            continue
        ts = entry.get('timestamp')
        if not ts: continue
        try:
            t = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
        except Exception:
            continue
        if t < cutoff: continue
        keep.append({
            'timestamp': entry.get('timestamp'),
            'userKey':   entry.get('userKey'),
            'verdict':   (entry.get('verdict') or '')[:600],
            'summary':   entry.get('summary') or '',
        })
keep = keep[-max_entries:]
print(json.dumps(keep))
PY
)

COUNT=$(printf '%s' "$RECENT_ENTRIES" | python3 -c 'import json,sys;print(len(json.loads(sys.stdin.read())))')
if [[ "$COUNT" == "0" ]]; then
  log_event info "no council sessions in the last ${WINDOW_DAYS} days; keeping patterns.json as-is"
  exit 0
fi

log_event info "distilling ${COUNT} council sessions from last ${WINDOW_DAYS} days"

# Build the Gaia prompt. Ask for strict-JSON patterns output.
GAIA_PROMPT=$(python3 - "$RECENT_ENTRIES" <<'PY'
import json, sys
entries = json.loads(sys.argv[1])
lines = []
for i, e in enumerate(entries, 1):
    lines.append(f"--- Session {i} ({e.get('timestamp','?')}, user={e.get('userKey','?')}) ---")
    if e.get('summary'): lines.append(f"Summary: {e['summary']}")
    if e.get('verdict'): lines.append(f"Verdict: {e['verdict']}")
sessions = '\n'.join(lines)
prompt = f"""You are Gaia, the observing memory of the Mount Olympus council.
Below are {len(entries)} recent council sessions. Your task: distill up to 8 institutional patterns — recurring themes, biases, or decision templates the council has exhibited. Write each pattern as ONE concise sentence (max 180 chars). Think: "When asked X, the council tends to Y." Be specific, not generic.

Respond STRICTLY as JSON, no markdown, no preamble:
{{"patterns": ["pattern one", "pattern two", ...]}}

RECENT SESSIONS:
{sessions}
"""
print(json.dumps(prompt))
PY
)

RESPONSE=$(curl -sS -X POST "$GAIA_URL" \
  -H "Authorization: Bearer $GAIA_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-openclaw-scopes: operator.write" \
  -H "x-openclaw-session-key: gaia-distill-${TIMESTAMP_NOW}" \
  -d "{\"model\":\"openclaw\",\"stream\":false,\"messages\":[{\"role\":\"user\",\"content\":${GAIA_PROMPT}}]}" \
  || echo '{}')

# Parse Gaia's response into patterns.json. Pass data via env vars to avoid
# the stdin/heredoc conflict when `python3 -` reads script from stdin.
PARSED=$(RESPONSE="$RESPONSE" TS="$TIMESTAMP_NOW" COUNT="$COUNT" WINDOW="$WINDOW_DAYS" python3 <<'PY'
import json, os, re
raw = os.environ.get('RESPONSE', '')
ts  = os.environ.get('TS', '')
count = int(os.environ.get('COUNT', '0') or '0')
window = int(os.environ.get('WINDOW', '7') or '7')
try:
    data = json.loads(raw)
except Exception as e:
    print(json.dumps({"error": f"openclaw response not json: {e}", "raw": raw[:400]}))
    raise SystemExit(0)
content = (data.get('choices') or [{}])[0].get('message', {}).get('content') or ''
if not content:
    print(json.dumps({"error": "openclaw returned empty content", "raw": raw[:400]}))
    raise SystemExit(0)
# Extract JSON object from content (strip markdown fences if present).
m = re.search(r'\{[\s\S]*\}', content)
if not m:
    print(json.dumps({"error": "no JSON object in gaia output", "raw": content[:400]}))
    raise SystemExit(0)
try:
    parsed = json.loads(m.group(0))
except Exception as e:
    print(json.dumps({"error": f"parse fail: {e}", "raw": content[:400]}))
    raise SystemExit(0)
patterns = parsed.get('patterns') or []
if not isinstance(patterns, list):
    print(json.dumps({"error": "patterns not a list", "raw": content[:400]}))
    raise SystemExit(0)
patterns = [str(p).strip() for p in patterns if str(p).strip()][:8]
print(json.dumps({
    "updated_at":      ts,
    "source_sessions": count,
    "window_days":     window,
    "patterns":        patterns,
}))
PY
)

# If there's an error, log it and bail without overwriting patterns.json.
if printf '%s' "$PARSED" | python3 -c 'import sys,json;d=json.load(sys.stdin);exit(0 if "patterns" in d else 1)'; then
  # Write patterns.json atomically.
  TMP="$(mktemp)"
  printf '%s\n' "$PARSED" | python3 -m json.tool > "$TMP"
  mv "$TMP" "$PATTERNS_FILE"
  N=$(printf '%s' "$PARSED" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["patterns"]))')
  log_event info "wrote ${N} patterns to ${PATTERNS_FILE}"
  exit 0
else
  ERR=$(printf '%s' "$PARSED" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("error",""))' 2>/dev/null || echo "unknown")
  log_event error "distillation failed: ${ERR}"
  exit 1
fi
