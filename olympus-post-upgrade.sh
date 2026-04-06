#!/bin/bash
# Mount Olympus — Post-Upgrade Verification Script
# Usage: ./olympus-post-upgrade.sh <nodename|all>
# Checks cluster integrity after OS or OpenClaw updates.
# Compatible with macOS bash 3.2 (no associative arrays).
#
# SSH quorum model: each council head reaches ONLY its own quorum Sparks.
#   Zeus     → hermes, hestia, apollo, athena
#   Poseidon → aphrodite, demeter, iris, prometheus
#   Hades    → hephaestus, nike, artemis, ares

set -o pipefail

# ── Node lists ────────────────────────────────────────────────────
MAC_NODES="zeus poseidon hades gaia"
ZEUS_QUORUM="hermes hestia apollo athena"
POSEIDON_QUORUM="aphrodite demeter iris prometheus"
HADES_QUORUM="hephaestus nike artemis ares"
SPARK_NODES="$ZEUS_QUORUM $POSEIDON_QUORUM $HADES_QUORUM"
QUORUM_NODES="zeus poseidon hades"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# ── Lookups (bash 3.2 compatible) ────────────────────────────────
get_mac_ip() {
  case $1 in
    zeus)      echo "192.168.1.11" ;;
    poseidon)  echo "192.168.1.12" ;;
    hades)     echo "192.168.1.13" ;;
    gaia)      echo "192.168.1.14" ;;
    *)         echo "" ;;
  esac
}

get_mac_lan_if() {
  case $1 in
    zeus)      echo "en9" ;;
    poseidon)  echo "en11" ;;
    hades)     echo "en8" ;;
    gaia)      echo "en11" ;;
    *)         echo "" ;;
  esac
}

get_spark_ip() {
  case $1 in
    hermes)      echo "192.168.1.102" ;;
    athena)      echo "192.168.1.189" ;;
    apollo)      echo "192.168.1.170" ;;
    hestia)      echo "192.168.1.105" ;;
    aphrodite)   echo "192.168.1.123" ;;
    iris)        echo "192.168.1.117" ;;
    demeter)     echo "192.168.1.113" ;;
    prometheus)  echo "192.168.1.131" ;;
    hephaestus)  echo "192.168.1.156" ;;
    nike)        echo "192.168.1.165" ;;
    artemis)     echo "192.168.1.152" ;;
    ares)        echo "192.168.1.182" ;;
    *)           echo "" ;;
  esac
}

get_quorum_head() {
  case $1 in
    hermes|hestia|apollo|athena)             echo "zeus" ;;
    aphrodite|demeter|iris|prometheus)        echo "poseidon" ;;
    hephaestus|nike|artemis|ares)            echo "hades" ;;
    *)                                        echo "" ;;
  esac
}

get_mac_pm2_required() {
  case $1 in
    zeus)      echo "lan-watchdog olympus-dashboard olympus-framework" ;;
    poseidon)  echo "council-peer lan-watchdog" ;;
    hades)     echo "council-peer lan-watchdog" ;;
    gaia)      echo "council-peer lan-watchdog" ;;
    *)         echo "" ;;
  esac
}

is_mac() { echo "$MAC_NODES" | grep -qw "$1"; }
is_spark() { echo "$SPARK_NODES" | grep -qw "$1"; }
needs_quorum() { echo "$QUORUM_NODES" | grep -qw "$1"; }

# ── Helpers ───────────────────────────────────────────────────────
log_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  printf "  \033[0;32mPASS\033[0m  %s\n" "$1"
  echo "  PASS  $1" >> "$LOGFILE"
}

log_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  printf "  \033[0;31mFAIL\033[0m  %s\n" "$1"
  echo "  FAIL  $1" >> "$LOGFILE"
}

header() {
  echo ""
  printf "\033[0;36m━━━ %s ━━━\033[0m\n" "$1"
  echo "" >> "$LOGFILE"
  echo "━━━ $1 ━━━" >> "$LOGFILE"
}

CURRENT_USER=$(whoami)

run_on() {
  local node=$1; shift
  if [ "$node" = "$CURRENT_USER" ]; then
    bash -c "$*" 2>/dev/null
  else
    ssh -o ConnectTimeout=5 -o BatchMode=yes "$node" "$@" 2>/dev/null
  fi
}

# Run a command on a Spark via its quorum head.
# If we ARE the quorum head, SSH directly to the Spark.
# If not, SSH to the quorum head which then SSHes to the Spark.
run_on_spark() {
  local spark=$1; shift
  local head; head=$(get_quorum_head "$spark")
  if [ "$head" = "$CURRENT_USER" ]; then
    ssh -o ConnectTimeout=5 -o BatchMode=yes "$spark" "$@" 2>/dev/null
  else
    # Double-hop: escape the inner command for the intermediate shell
    local cmd="$*"
    ssh -o ConnectTimeout=5 -o BatchMode=yes "$head" "ssh -o ConnectTimeout=5 -o BatchMode=yes $spark $(printf '%q' "$cmd")" 2>/dev/null
  fi
}

# ── Mac Mini checks ──────────────────────────────────────────────
check_mac() {
  local node=$1
  local expected_ip; expected_ip=$(get_mac_ip "$node")
  local lan_if; lan_if=$(get_mac_lan_if "$node")

  header "$node (Mac Mini — expected $expected_ip)"

  # 1. LAN IP correct and static
  local actual_ip
  actual_ip=$(run_on "$node" "ipconfig getifaddr $lan_if" || echo "")
  if [ "$actual_ip" = "$expected_ip" ]; then
    log_pass "LAN IP correct ($actual_ip on $lan_if)"
  else
    log_fail "LAN IP mismatch: expected $expected_ip, got '${actual_ip:-none}' on $lan_if"
  fi

  # 2. PM2 running with correct process manifest
  local pm2_online
  pm2_online=$(run_on "$node" "pm2 jlist 2>/dev/null" | python3 -c "
import sys,json
try:
  data = json.load(sys.stdin)
  online = [p['name'] for p in data if p.get('pm2_env',{}).get('status') == 'online']
  print(' '.join(sorted(online)))
except: print('')
" 2>/dev/null || echo "")

  local required; required=$(get_mac_pm2_required "$node")
  local pm2_ok=true
  for proc in $required; do
    if echo "$pm2_online" | grep -qw "$proc"; then
      :
    else
      pm2_ok=false
      log_fail "PM2 missing: $proc (online: $pm2_online)"
    fi
  done
  if $pm2_ok; then
    log_pass "PM2 manifest OK ($required)"
  fi

  # 3. OpenClaw healthy (port 18789)
  local oc_status
  oc_status=$(run_on "$node" "curl -s -o /dev/null -w '%{http_code}' http://localhost:18789/" || echo "000")
  if [ "$oc_status" = "200" ]; then
    log_pass "OpenClaw healthy (port 18789)"
  else
    log_fail "OpenClaw unreachable (port 18789, HTTP $oc_status)"
  fi

  # 4. Framework healthy if Zeus (port 18780)
  if [ "$node" = "zeus" ]; then
    local fw_status
    fw_status=$(run_on "$node" "curl -s -o /dev/null -w '%{http_code}' http://localhost:18780/" || echo "000")
    if [ "$fw_status" = "200" ]; then
      log_pass "Framework healthy (port 18780)"
    else
      log_fail "Framework unreachable (port 18780, HTTP $fw_status)"
    fi
  fi

  # 5. NAS mounted
  local nas_ok
  nas_ok=$(run_on "$node" "[ -d /Volumes/olympus/ops ] && echo yes || echo no" || echo "no")
  if [ "$nas_ok" = "yes" ]; then
    log_pass "NAS mounted at /Volumes/olympus"
  else
    log_fail "NAS NOT mounted at /Volumes/olympus"
  fi

  # 6. call_quorum.sh present (Zeus, Poseidon, Hades only)
  if needs_quorum "$node"; then
    local cq_ok
    cq_ok=$(run_on "$node" "[ -f ~/olympus/call_quorum.sh ] && echo yes || echo no" || echo "no")
    if [ "$cq_ok" = "yes" ]; then
      log_pass "call_quorum.sh present"
    else
      log_fail "call_quorum.sh MISSING"
    fi
  fi

  # 7. council-peer.js present
  local cp_ok
  cp_ok=$(run_on "$node" "[ -f ~/olympus/framework/council-peer.js ] && echo yes || echo no" || echo "no")
  if [ "$cp_ok" = "yes" ]; then
    log_pass "council-peer.js present"
  else
    log_fail "council-peer.js MISSING"
  fi

  # 8. No TB IPs (10.0.x.x)
  local tb_routes
  tb_routes=$(run_on "$node" "netstat -rn 2>/dev/null | grep -c '10\.0\.' || true" || echo "0")
  tb_routes=$(echo "$tb_routes" | tr -d '[:space:]')
  local tb_files
  tb_files=$(run_on "$node" "grep -rlE '10\.0\.[0-9]+\.[0-9]+' ~/olympus/framework/*.js 2>/dev/null | wc -l | tr -d ' '" || echo "0")
  tb_files=$(echo "$tb_files" | tr -d '[:space:]')
  if [ "${tb_routes:-0}" = "0" ] && [ "${tb_files:-0}" = "0" ]; then
    log_pass "No Thunderbolt IPs (10.0.x.x) in routes or framework"
  else
    log_fail "TB IPs found: $tb_routes routes, $tb_files framework files"
  fi

  # 9. WiFi default route NOT present
  local wifi_default
  wifi_default=$(run_on "$node" "netstat -rn 2>/dev/null | grep '^default' | grep -cw 'en1' || true" || echo "0")
  wifi_default=$(echo "$wifi_default" | tr -d '[:space:]')
  if [ "${wifi_default:-0}" = "0" ]; then
    log_pass "No WiFi default route (LAN is sole default)"
  else
    log_fail "WiFi default route present on en1 ($wifi_default entries)"
  fi

  # 10. lan-watchdog running via PM2
  if echo "$pm2_online" | grep -qw "lan-watchdog"; then
    log_pass "lan-watchdog running via PM2"
  else
    log_fail "lan-watchdog NOT running via PM2"
  fi
}

# ── DGX Spark checks (routed via quorum head) ────────────────────
check_spark() {
  local node=$1
  local expected_ip; expected_ip=$(get_spark_ip "$node")
  local head; head=$(get_quorum_head "$node")

  header "$node (DGX Spark — expected $expected_ip, via $head)"

  # Test SSH connectivity via quorum head
  if ! run_on_spark "$node" "echo ok" >/dev/null 2>&1; then
    log_fail "SSH unreachable via $head — skipping remaining checks"
    return
  fi

  # 1. LAN IP correct
  local actual_ip
  actual_ip=$(run_on_spark "$node" "hostname -I 2>/dev/null | cut -d\" \" -f1" || echo "")
  if [ "$actual_ip" = "$expected_ip" ]; then
    log_pass "LAN IP correct ($actual_ip)"
  else
    log_fail "LAN IP mismatch: expected $expected_ip, got '${actual_ip:-none}'"
  fi

  # 2. OpenClaw healthy (port 18789)
  local oc_status
  oc_status=$(run_on_spark "$node" "curl -s -o /dev/null -w '%{http_code}' http://localhost:18789/" || echo "000")
  if [ "$oc_status" = "200" ]; then
    log_pass "OpenClaw healthy (port 18789)"
  else
    log_fail "OpenClaw unreachable (port 18789, HTTP $oc_status)"
  fi

  # 3. vLLM healthy (port 8000)
  local vllm_status
  vllm_status=$(run_on_spark "$node" "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health" || echo "000")
  if [ "$vllm_status" = "200" ]; then
    log_pass "vLLM healthy (port 8000)"
  else
    log_fail "vLLM unreachable (port 8000, HTTP $vllm_status)"
  fi

  # 4. openclaw.json gateway.bind = "lan"
  local bind_val
  bind_val=$(run_on_spark "$node" "cat ~/.openclaw/openclaw.json 2>/dev/null" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  print(d.get('gateway',{}).get('bind','missing'))
except: print('parse_error')
" 2>/dev/null || echo "read_error")
  if [ "$bind_val" = "lan" ]; then
    log_pass "openclaw.json gateway.bind = \"lan\""
  else
    log_fail "openclaw.json gateway.bind = \"$bind_val\" (expected \"lan\")"
  fi

  # 5. AGENTS.md present and contains "COMMUNICATION TOPOLOGY"
  local agents_check
  agents_check=$(run_on_spark "$node" "grep -c 'COMMUNICATION TOPOLOGY' ~/.openclaw/workspace/AGENTS.md 2>/dev/null || echo 0" || echo "0")
  agents_check=$(echo "$agents_check" | tr -d '[:space:]')
  if [ "${agents_check:-0}" -ge 1 ] 2>/dev/null; then
    log_pass "AGENTS.md present with COMMUNICATION TOPOLOGY"
  else
    local agents_exists
    agents_exists=$(run_on_spark "$node" "[ -f ~/.openclaw/workspace/AGENTS.md ] && echo yes || echo no" || echo "no")
    if [ "$agents_exists" = "yes" ]; then
      log_fail "AGENTS.md present but missing COMMUNICATION TOPOLOGY section"
    else
      log_fail "AGENTS.md MISSING"
    fi
  fi

  # 6. SOUL.md present
  local soul_ok
  soul_ok=$(run_on_spark "$node" "[ -f ~/.openclaw/workspace/SOUL.md ] && echo yes || echo no" || echo "no")
  if [ "$soul_ok" = "yes" ]; then
    log_pass "SOUL.md present"
  else
    log_fail "SOUL.md MISSING"
  fi
}

# ── Main ──────────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "Usage: $0 <nodename|all>"
  echo "  Mac Minis: $MAC_NODES"
  echo "  DGX Sparks: $SPARK_NODES"
  echo "  Quorums: Zeus($ZEUS_QUORUM) Poseidon($POSEIDON_QUORUM) Hades($HADES_QUORUM)"
  echo "  all: check everything (routed through correct quorum heads)"
  exit 1
fi

TARGET=$1
LOGFILE="/Volumes/olympus/ops/post-upgrade-${TARGET}-${TIMESTAMP}.log"

# Create log file
mkdir -p "$(dirname "$LOGFILE")" 2>/dev/null
echo "Mount Olympus Post-Upgrade Verification" > "$LOGFILE"
echo "Target: $TARGET | Run: $(date)" >> "$LOGFILE"
echo "========================================" >> "$LOGFILE"

echo ""
printf "\033[1;33mMount Olympus Post-Upgrade Verification\033[0m\n"
echo "Target: $TARGET | $(date)"
echo "========================================"

if [ "$TARGET" = "all" ]; then
  for node in $MAC_NODES; do
    check_mac "$node"
  done
  for node in $SPARK_NODES; do
    check_spark "$node"
  done
elif is_mac "$TARGET"; then
  check_mac "$TARGET"
elif is_spark "$TARGET"; then
  check_spark "$TARGET"
else
  printf "\033[0;31mUnknown node: %s\033[0m\n" "$TARGET"
  echo "Valid: $MAC_NODES $SPARK_NODES all"
  exit 1
fi

# ── Summary ───────────────────────────────────────────────────────
echo ""
echo "========================================"
if [ $FAIL_COUNT -eq 0 ]; then
  printf "\033[0;32mRESULT: ALL %d CHECKS PASSED\033[0m\n" "$TOTAL_COUNT"
  echo "RESULT: ALL $TOTAL_COUNT CHECKS PASSED" >> "$LOGFILE"
else
  printf "\033[0;31mRESULT: %d/%d FAILED\033[0m | \033[0;32m%d passed\033[0m\n" "$FAIL_COUNT" "$TOTAL_COUNT" "$PASS_COUNT"
  echo "RESULT: $FAIL_COUNT/$TOTAL_COUNT FAILED | $PASS_COUNT passed" >> "$LOGFILE"
fi
echo "Log: $LOGFILE"
echo ""
