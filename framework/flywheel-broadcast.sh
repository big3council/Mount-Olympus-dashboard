#!/bin/bash
# flywheel-broadcast.sh — Emit flywheel events to the WebSocket pipe
#
# Called by olympus-deploy.sh at three points:
#   1. After stage completes
#   2. After execute completes  
#   3. After result is written
#
# Sends a JSON event to Zeus's WebSocket broadcast endpoint.
# The broadcast() function in olympus-ws.js pushes to all connected dashboard clients.
#
# Usage:
#   flywheel-broadcast.sh <event_type> <project> <detail> [deploy_id]
#
# Event types: deploy.staged, deploy.signed, deploy.approved, deploy.executed, deploy.failed
#
# Created: 2026-03-27 by Hades

set -e

EVENT_TYPE="${1:?Usage: flywheel-broadcast.sh <type> <project> <detail> [deploy_id]}"
PROJECT="${2:?Missing project}"
DETAIL="${3:?Missing detail}"
DEPLOY_ID="${4:-}"
SELF=$(hostname -s | tr '[:upper:]' '[:lower:]' | sed 's/s-mac-mini.*//; s/-mac-mini.*//')
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Build the event JSON
EVENT=$(python3 -c "
import json, sys
print(json.dumps({
    'type': 'flywheel',
    'event': sys.argv[1],
    'project': sys.argv[2],
    'detail': sys.argv[3],
    'deploy_id': sys.argv[4] if sys.argv[4] else None,
    'node': sys.argv[5],
    'ts': sys.argv[6]
}))
" "$EVENT_TYPE" "$PROJECT" "$DETAIL" "$DEPLOY_ID" "$SELF" "$TIMESTAMP")

# Method 1: HTTP POST to Zeus's broadcast endpoint
# If server.js exposes a POST /broadcast or POST /emit endpoint:
BROADCAST_URL="http://10.0.1.1:18780/broadcast"
RESULT=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -X POST "$BROADCAST_URL" \
  -H "Content-Type: application/json" \
  -d "$EVENT" 2>/dev/null)

if [ "$RESULT" = "200" ] || [ "$RESULT" = "201" ] || [ "$RESULT" = "204" ]; then
  echo "[broadcast] ✓ Sent $EVENT_TYPE to dashboard ($RESULT)"
  exit 0
fi

# Method 2: If no HTTP broadcast endpoint, use wscat or node one-liner
# Try pushing via a quick Node.js WebSocket connection
node -e "
const { WebSocket } = require('ws');
const ws = new WebSocket('ws://10.0.1.1:18780/live');
ws.on('open', () => {
  ws.send(JSON.stringify($EVENT));
  console.log('[broadcast] ✓ Sent $EVENT_TYPE via WS /live');
  ws.close();
  process.exit(0);
});
ws.on('error', (e) => {
  console.error('[broadcast] ✗ WS error:', e.message);
  process.exit(1);
});
setTimeout(() => { console.error('[broadcast] ✗ WS timeout'); process.exit(1); }, 5000);
" 2>/dev/null

if [ $? -ne 0 ]; then
  echo "[broadcast] ⚠ Could not push to dashboard — event logged to events.jsonl only"
fi
