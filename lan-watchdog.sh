#!/bin/bash
# Mount Olympus LAN Watchdog
# Monitors LAN connectivity and promotes WiFi as failover if LAN drops

LAN_GW="192.168.1.1"
LAN_IF="en9"
WIFI_IF="en1"
FAIL_COUNT=0
FAIL_THRESHOLD=3
RECOVERY_COUNT=0
RECOVERY_THRESHOLD=3
WIFI_ACTIVE=false
LOG="/Volumes/olympus/ops/lan-watchdog.log"
HOSTNAME=$(hostname -s)

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$HOSTNAME] $1" | tee -a "$LOG"
}

log "LAN watchdog started. LAN=$LAN_IF WiFi=$WIFI_IF Gateway=$LAN_GW"

while true; do
  LAN_IP=$(ipconfig getifaddr $LAN_IF 2>/dev/null)
  if [ -n "$LAN_IP" ] && ping -c 1 -W 2 -S "$LAN_IP" $LAN_GW &>/dev/null; then
    if $WIFI_ACTIVE; then
      RECOVERY_COUNT=$((RECOVERY_COUNT + 1))
      if [ $RECOVERY_COUNT -ge $RECOVERY_THRESHOLD ]; then
        log "LAN restored. Removing WiFi default route."
        sudo route delete default -ifscope $WIFI_IF 2>/dev/null
        WIFI_ACTIVE=false
        RECOVERY_COUNT=0
        FAIL_COUNT=0
      fi
    else
      FAIL_COUNT=0
      RECOVERY_COUNT=0
    fi
  else
    RECOVERY_COUNT=0
    FAIL_COUNT=$((FAIL_COUNT + 1))
    log "LAN ping failed ($FAIL_COUNT/$FAIL_THRESHOLD)"
    if [ $FAIL_COUNT -ge $FAIL_THRESHOLD ] && ! $WIFI_ACTIVE; then
      log "LAN down. Promoting WiFi as default route."
      sudo route add default -ifscope $WIFI_IF $(ipconfig getifaddr $WIFI_IF | awk -F. '{print $1"."$2"."$3".1"}') 2>/dev/null || \
      sudo route add default 192.168.1.1 -ifscope $WIFI_IF 2>/dev/null
      # Remove conflicting LAN IP from WiFi interface if present
      WIFI_LAN_IP=$(ipconfig getifaddr $WIFI_IF 2>/dev/null)
      if echo "$WIFI_LAN_IP" | grep -q "^192\.168\.1\."; then
        sudo /sbin/ifconfig $WIFI_IF delete $WIFI_LAN_IP 2>/dev/null
        log "Removed conflicting LAN IP $WIFI_LAN_IP from $WIFI_IF to prevent subnet ambiguity"
      fi
      WIFI_ACTIVE=true
    fi
  fi
  sleep 30
done
