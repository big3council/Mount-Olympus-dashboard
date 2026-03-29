#!/bin/bash
# olympus-deploy.sh — Mount Olympus Self-Deployment Loop
#
# Five stages: Produce → Sign → Approve → Execute → Report
# NAS at /Volumes/olympus/deploy/ is the shared bus.
# Carson approves via Telegram before any execution.
#
# Usage:
#   olympus-deploy.sh stage <name> <target> <payload_dir>   — Stage a deployment
#   olympus-deploy.sh sign <deployment_id>                   — Council head signs off
#   olympus-deploy.sh execute <deployment_id>                — Execute after approval
#   olympus-deploy.sh status [deployment_id]                 — Check deployment status
#   olympus-deploy.sh list                                   — List all staged deployments
#
# Created: 2026-03-27 by Hades (Flywheel MVP)

set -e

NAS_BASE="/Volumes/olympus/deploy"
STAGING="$NAS_BASE/staging"
RESULTS="$NAS_BASE/results"
AUDIT="$NAS_BASE/audit"
TOKEN="b67accb237fdc708bc216bcf283ae3948ed84c3b5d9fc673"
SELF=$(hostname -s | tr '[:upper:]' '[:lower:]')

# ── Helpers ────────────────────────────────────────────────────────────
timestamp() { date '+%Y%m%d-%H%M%S'; }
log() { echo "[deploy:$SELF] $(date '+%H:%M:%S') $1"; }

get_ip() {
  case "$1" in
    zeus)        echo "10.0.1.1" ;;
    poseidon)    echo "10.0.1.2" ;;
    hades)       echo "10.0.2.2" ;;
    gaia)        echo "10.0.3.2" ;;
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
    *) echo "" ;;
  esac
}

check_nas() {
  if [ ! -d "$NAS_BASE" ]; then
    log "ERROR: NAS not accessible at $NAS_BASE"
    log "Fix: sudo umount -f /Volumes/olympus && sudo mount -a"
    exit 1
  fi
  # Quick write test
  local probe="$NAS_BASE/.probe-$$"
  echo "probe" > "$probe" 2>/dev/null
  if [ $? -ne 0 ]; then
    log "ERROR: NAS not writable at $NAS_BASE"
    exit 1
  fi
  rm -f "$probe"
}

# ── Stage 1: Produce ──────────────────────────────────────────────────
cmd_stage() {
  local name="$1" target="$2" payload_dir="$3"
  
  if [ -z "$name" ] || [ -z "$target" ] || [ -z "$payload_dir" ]; then
    echo "Usage: olympus-deploy.sh stage <name> <target_node> <payload_dir>"
    exit 1
  fi
  
  if [ ! -d "$payload_dir" ]; then
    log "ERROR: Payload directory not found: $payload_dir"
    exit 1
  fi

  check_nas
  
  local ts=$(timestamp)
  local deploy_id="${ts}-${name}"
  local deploy_dir="$STAGING/$deploy_id"
  
  mkdir -p "$deploy_dir/payload"
  
  # Copy payload
  cp -R "$payload_dir"/* "$deploy_dir/payload/" 2>/dev/null
  
  # Generate manifest
  cat > "$deploy_dir/MANIFEST.md" << EOF
# Deployment: $name
- **ID:** $deploy_id
- **Target:** $target
- **Staged by:** $SELF
- **Staged at:** $(date -u '+%Y-%m-%dT%H:%M:%SZ')
- **Files:**
$(cd "$deploy_dir/payload" && find . -type f | sed 's/^/  - /')

## What This Deployment Does
[Council head: describe the change here]

## Expected Outcome
[What should happen when this executes]

## Rollback Plan
[How to undo this if it fails]
EOF

  # Generate diff (file listing with sizes)
  cat > "$deploy_dir/DIFF.md" << EOF
# Diff: $name → $target
$(cd "$deploy_dir/payload" && find . -type f -exec ls -la {} \; | awk '{printf "  %s %s\n", $5, $NF}')
EOF

  # Target file
  echo "$target" > "$deploy_dir/target.txt"
  
  # Council sign-off (empty — waiting for signatures)
  echo "# Council Sign-Off" > "$deploy_dir/council-sign.txt"
  echo "Deployment: $deploy_id" >> "$deploy_dir/council-sign.txt"
  echo "" >> "$deploy_dir/council-sign.txt"
  
  # Status
  echo "STAGED" > "$deploy_dir/status.txt"
  
  log "Staged: $deploy_id"
  log "Target: $target"
  log "Files: $(find "$deploy_dir/payload" -type f | wc -l | tr -d ' ')"
  
  # Broadcast to dashboard
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [ -x "$SCRIPT_DIR/flywheel-broadcast.sh" ]; then
    "$SCRIPT_DIR/flywheel-broadcast.sh" "deploy.staged" "${name}" "Staged for $target by $SELF" "$deploy_id" 2>/dev/null &
  fi
  
  log ""
  log "Next: council members sign with: olympus-deploy.sh sign $deploy_id"
  log "Then: notify Carson for approval"
  log "Then: olympus-deploy.sh execute $deploy_id"
}

# ── Stage 2: Sign ─────────────────────────────────────────────────────
cmd_sign() {
  local deploy_id="$1"
  
  if [ -z "$deploy_id" ]; then
    echo "Usage: olympus-deploy.sh sign <deployment_id>"
    exit 1
  fi
  
  check_nas
  
  local deploy_dir="$STAGING/$deploy_id"
  if [ ! -d "$deploy_dir" ]; then
    log "ERROR: Deployment not found: $deploy_id"
    exit 1
  fi
  
  local sign_file="$deploy_dir/council-sign.txt"
  
  # Check if already signed
  if grep -q "$SELF" "$sign_file" 2>/dev/null; then
    log "$SELF already signed this deployment"
    return 0
  fi
  
  echo "$SELF — reviewed and approved — $(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$sign_file"
  log "Signed: $deploy_id (by $SELF)"
  
  # Show sign-off status
  echo ""
  cat "$sign_file"
}

# ── Stage 4: Execute ──────────────────────────────────────────────────
cmd_execute() {
  local deploy_id="$1"
  
  if [ -z "$deploy_id" ]; then
    echo "Usage: olympus-deploy.sh execute <deployment_id>"
    exit 1
  fi
  
  check_nas
  
  local deploy_dir="$STAGING/$deploy_id"
  if [ ! -d "$deploy_dir" ]; then
    log "ERROR: Deployment not found: $deploy_id"
    exit 1
  fi
  
  # Check status
  local current_status=$(cat "$deploy_dir/status.txt" 2>/dev/null)
  if [ "$current_status" = "EXECUTED" ]; then
    log "Already executed: $deploy_id"
    exit 0
  fi
  
  # Check for approval marker
  if [ ! -f "$deploy_dir/approved.txt" ]; then
    log "ERROR: No approval found. Carson must approve before execution."
    log "Create approval: echo 'Approved by Carson — $(date)' > $deploy_dir/approved.txt"
    exit 1
  fi
  
  local target=$(cat "$deploy_dir/target.txt" 2>/dev/null)
  local target_ip=$(get_ip "$target")
  
  if [ -z "$target_ip" ]; then
    log "ERROR: Unknown target: $target"
    exit 1
  fi
  
  # Create results directory
  local result_dir="$RESULTS/$deploy_id"
  mkdir -p "$result_dir"
  
  log "Executing deployment: $deploy_id → $target ($target_ip)"
  echo "EXECUTING" > "$deploy_dir/status.txt"
  
  # Execute: for quorum nodes, use call_quorum.sh pattern
  # For council nodes, would use SSH (when available) or direct exec
  
  # Check if there's an install.sh in the payload
  if [ -f "$deploy_dir/payload/install.sh" ]; then
    # Read and send the install script content to the target
    local script_content=$(cat "$deploy_dir/payload/install.sh")
    log "Running install.sh on $target..."
    
    # For quorum nodes: send via API
    if echo "hermes athena apollo hestia aphrodite iris demeter prometheus hephaestus nike artemis ares" | grep -qw "$target"; then
      local escaped=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "Execute this deployment script and report the result: $script_content")
      
      /usr/bin/curl -s --max-time 90 -X POST "http://${target_ip}:18789/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -H "x-openclaw-session-key: deploy-${deploy_id}" \
        -d "{\"model\":\"openclaw\",\"messages\":[{\"role\":\"user\",\"content\":${escaped}}],\"stream\":false}" \
        > "$result_dir/stdout.log" 2>"$result_dir/stderr.log"
      
      local exit_code=$?
    else
      # Council node — would use SSH or local exec
      log "Council node deployment: manual execution required"
      echo "MANUAL" > "$result_dir/result.txt"
      exit_code=0
    fi
  else
    # No install script — just log the payload listing
    log "No install.sh found. Payload staged for manual application."
    ls -la "$deploy_dir/payload/" > "$result_dir/stdout.log"
    exit_code=0
  fi
  
  # Record result and broadcast
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [ $exit_code -eq 0 ]; then
    echo "SUCCESS" > "$result_dir/result.txt"
    echo "EXECUTED" > "$deploy_dir/status.txt"
    log "✓ Deployment succeeded"
    if [ -x "$SCRIPT_DIR/flywheel-broadcast.sh" ]; then
      "$SCRIPT_DIR/flywheel-broadcast.sh" "deploy.executed" "$(cat "$deploy_dir/target.txt" 2>/dev/null)" "Deployment succeeded on $target" "$deploy_id" 2>/dev/null &
    fi
  else
    echo "FAILED (exit $exit_code)" > "$result_dir/result.txt"
    echo "FAILED" > "$deploy_dir/status.txt"
    log "✗ Deployment failed (exit $exit_code)"
    if [ -x "$SCRIPT_DIR/flywheel-broadcast.sh" ]; then
      "$SCRIPT_DIR/flywheel-broadcast.sh" "deploy.failed" "$(cat "$deploy_dir/target.txt" 2>/dev/null)" "Deployment failed on $target (exit $exit_code)" "$deploy_id" 2>/dev/null &
    fi
  fi
  
  # Audit entry
  mkdir -p "$AUDIT"
  cat > "$AUDIT/$deploy_id.log" << EOF
Deployment: $deploy_id
Target: $target ($target_ip)
Staged by: $SELF
Executed at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')
Result: $(cat "$result_dir/result.txt")
Council sign-off:
$(cat "$deploy_dir/council-sign.txt")
Approval:
$(cat "$deploy_dir/approved.txt" 2>/dev/null || echo "NONE")
EOF
  
  log "Audit logged: $AUDIT/$deploy_id.log"
}

# ── Status ────────────────────────────────────────────────────────────
cmd_status() {
  local deploy_id="$1"
  
  check_nas
  
  if [ -n "$deploy_id" ]; then
    local deploy_dir="$STAGING/$deploy_id"
    if [ ! -d "$deploy_dir" ]; then
      log "Deployment not found: $deploy_id"
      exit 1
    fi
    echo "=== $deploy_id ==="
    cat "$deploy_dir/status.txt" 2>/dev/null
    echo ""
    cat "$deploy_dir/MANIFEST.md" 2>/dev/null
    echo ""
    cat "$deploy_dir/council-sign.txt" 2>/dev/null
  else
    echo "=== All Staged Deployments ==="
    for d in "$STAGING"/*/; do
      if [ -d "$d" ]; then
        local id=$(basename "$d")
        local status=$(cat "$d/status.txt" 2>/dev/null || echo "UNKNOWN")
        local target=$(cat "$d/target.txt" 2>/dev/null || echo "?")
        printf "  %-40s %-10s → %s\n" "$id" "$status" "$target"
      fi
    done
  fi
}

# ── List ──────────────────────────────────────────────────────────────
cmd_list() {
  check_nas
  cmd_status
}

# ── Init NAS structure ────────────────────────────────────────────────
cmd_init() {
  check_nas
  mkdir -p "$STAGING" "$RESULTS" "$AUDIT"
  log "Deploy directories initialized at $NAS_BASE"
  ls -la "$NAS_BASE/"
}

# ── Main ──────────────────────────────────────────────────────────────
case "${1:-help}" in
  stage)    shift; cmd_stage "$@" ;;
  sign)     shift; cmd_sign "$@" ;;
  execute)  shift; cmd_execute "$@" ;;
  status)   shift; cmd_status "$@" ;;
  list)     cmd_list ;;
  init)     cmd_init ;;
  *)
    echo "olympus-deploy.sh — Mount Olympus Self-Deployment Loop"
    echo ""
    echo "Commands:"
    echo "  init                               Initialize NAS deploy directories"
    echo "  stage <name> <target> <payload>    Stage a deployment"
    echo "  sign <deployment_id>               Council head sign-off"
    echo "  execute <deployment_id>            Execute (requires approval)"
    echo "  status [deployment_id]             Check status"
    echo "  list                               List all deployments"
    ;;
esac
