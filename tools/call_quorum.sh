#!/bin/bash
# call_quorum.sh — Dispatch a message to a quorum member and return their response
# Usage: call_quorum.sh <agent_name> <message>

AGENT="$1"
shift
MESSAGE="$*"

if [ -z "$AGENT" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: call_quorum.sh <agent_name> <message>"
  echo "Available: hermes athena apollo hestia aphrodite iris demeter prometheus hephaestus nike artemis ares"
  exit 1
fi

AGENT_LOWER=$(echo "$AGENT" | tr '[:upper:]' '[:lower:]')

case "$AGENT_LOWER" in
  hermes)      IP="192.168.1.102" ;;
  athena)      IP="192.168.1.189" ;;
  apollo)      IP="192.168.1.170" ;;
  hestia)      IP="192.168.1.105" ;;
  aphrodite)   IP="192.168.1.123" ;;
  iris)        IP="192.168.1.117" ;;
  demeter)     IP="192.168.1.113" ;;
  prometheus)  IP="192.168.1.131" ;;
  hephaestus)  IP="192.168.1.156" ;;
  nike)        IP="192.168.1.165" ;;
  artemis)     IP="192.168.1.152" ;;
  ares)        IP="192.168.1.182" ;;
  *) echo "ERROR: Unknown agent: $AGENT"; exit 1 ;;
esac

TOKEN="b67accb237fdc708bc216bcf283ae3948ed84c3b5d9fc673"
URL="http://${IP}:18789/v1/chat/completions"

ESCAPED_MSG=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$MESSAGE")

RESPONSE=$(curl -s --max-time 180 -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-openclaw-scopes: operator.write" \
  -H "x-openclaw-session-key: quorum-${AGENT_LOWER}-$(date +%s%3N)" \
  -d "{\"model\":\"openclaw\",\"messages\":[{\"role\":\"user\",\"content\":${ESCAPED_MSG}}],\"stream\":false}" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
  echo "ERROR: Failed to reach $AGENT_LOWER at $IP:18789"
  exit 1
fi

echo "$RESPONSE" | python3 -c '
import sys,json
d=json.load(sys.stdin)
content = d["choices"][0]["message"]["content"]
if not content or content.strip() == "" or content.strip() == "NO_REPLY":
    print(f"[{sys.argv[1]} chose silence — NO_REPLY]")
    sys.exit(0)
print(content)
' "$AGENT_LOWER"
