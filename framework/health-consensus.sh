#!/bin/bash
# health-consensus.sh — Consensus-based health probe
# Probes a node 3 times with 1s sleep. Requires 2-of-3 successful probes.
# Usage: health-consensus.sh <node_name> <host> <port>
# Exit 0 = HEALTHY (≥2/3 probes succeeded), Exit 1 = DOWN (<2/3)

NODE_NAME="${1:?Usage: health-consensus.sh <node_name> <host> <port>}"
HOST="${2:?Missing host}"
PORT="${3:?Missing port}"

URL="http://${HOST}:${PORT}/health"
PASS=0
TOTAL=3
REQUIRED=2

for i in $(seq 1 $TOTAL); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "$URL" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then
    PASS=$((PASS + 1))
  fi
  [ $i -lt $TOTAL ] && sleep 1
done

if [ $PASS -ge $REQUIRED ]; then
  echo "HEALTHY  ${NODE_NAME}  ${PASS}/${TOTAL} probes passed"
  exit 0
else
  echo "DOWN     ${NODE_NAME}  ${PASS}/${TOTAL} probes passed"
  exit 1
fi
