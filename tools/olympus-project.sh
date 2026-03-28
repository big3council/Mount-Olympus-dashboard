#!/bin/bash
# olympus-project.sh — Create and manage project structures on the NAS
#
# Writes project.json, README.md, and task directories to the NAS
# via Gaia (Path B) or direct NAS write (Path A).
#
# Usage:
#   olympus-project.sh create <id> <name> <purpose> [--owner zeus|hades|poseidon] [--tier 1|2|3]
#   olympus-project.sh task <project-id> <title> [--assign member] [--council-head head]
#   olympus-project.sh status [project-id]
#   olympus-project.sh event <project-id> <type> <detail>
#   olympus-project.sh list
#
# Created: 2026-03-27 by Hades (Dashboard Architecture)

set -e

NAS_PROJECTS="/Volumes/olympus/shared/projects"
NAS_LOGS="/Volumes/olympus/logs"
SELF=$(hostname -s | tr '[:upper:]' '[:lower:]' | sed 's/s-mac-mini.*//; s/-mac-mini.*//')

timestamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
datestamp() { date '+%Y%m%d'; }
log() { echo "[project:$SELF] $(date '+%H:%M:%S') $1"; }

# ── NAS write (direct or log for Gaia to process) ─────────────────────
write_nas() {
  local path="$1"
  local content="$2"
  local dir=$(dirname "$path")

  # Try direct write first
  mkdir -p "$dir" 2>/dev/null
  echo "$content" > "$path" 2>/dev/null
  if [ $? -eq 0 ]; then
    return 0
  fi

  # Fallback: write locally and log for Gaia
  log "WARN: Cannot write to NAS directly. Queuing for Gaia."
  local local_queue="/Users/$SELF/olympus/hades/.nas-queue"
  mkdir -p "$local_queue"
  local qfile="$local_queue/$(date +%s)-$(basename "$path")"
  echo "TARGET_PATH=$path" > "$qfile"
  echo "---" >> "$qfile"
  echo "$content" >> "$qfile"
  return 1
}

# ── Append event to the shared event log ──────────────────────────────
emit_event() {
  local project="$1"
  local etype="$2"
  local detail="$3"
  local event="{\"ts\":\"$(timestamp)\",\"node\":\"$SELF\",\"type\":\"$etype\",\"project\":\"$project\",\"detail\":\"$detail\"}"

  # Try direct append to NAS
  echo "$event" >> "$NAS_LOGS/events.jsonl" 2>/dev/null
  if [ $? -ne 0 ]; then
    # Fallback: local log
    local local_log="/Users/$SELF/olympus/hades/logs/events-local.jsonl"
    echo "$event" >> "$local_log"
    log "Event logged locally (NAS unavailable): $etype"
  fi
}

# ── Create a new project ──────────────────────────────────────────────
cmd_create() {
  local id="$1"
  local name="$2"
  local purpose="$3"
  shift 3

  local owner="$SELF"
  local tier="2"

  while [ $# -gt 0 ]; do
    case "$1" in
      --owner) owner="$2"; shift 2 ;;
      --tier)  tier="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [ -z "$id" ] || [ -z "$name" ] || [ -z "$purpose" ]; then
    echo "Usage: olympus-project.sh create <id> <name> <purpose> [--owner X] [--tier N]"
    exit 1
  fi

  local project_dir="$NAS_PROJECTS/$id"
  local now=$(timestamp)

  # Create directory structure
  mkdir -p "$project_dir/tasks/active" "$project_dir/tasks/completed" "$project_dir/tasks/blocked" "$project_dir/deploys" 2>/dev/null

  # project.json
  local project_json=$(cat << ENDJSON
{
  "id": "$id",
  "name": "$name",
  "purpose": "$purpose",
  "status": "active",
  "owner": "$owner",
  "tier": $tier,
  "council_domains": ["zeus", "hades", "poseidon"],
  "created": "$now",
  "updated": "$now",
  "phase": "planning",
  "tasks": {
    "active": 0,
    "completed": 0,
    "blocked": 0
  },
  "deploys": {
    "staged": 0,
    "executing": 0,
    "completed": 0,
    "failed": 0
  },
  "last_event": null,
  "next_decision": null,
  "tags": ["tier-$tier"]
}
ENDJSON
)
  write_nas "$project_dir/project.json" "$project_json"

  # README.md
  local readme="# $name

## Purpose
$purpose

## Owner
$owner (council head)

## Status
Active — created $(date '+%Y-%m-%d')

## Context
[Council: add context about why this project exists and what it serves]
"
  write_nas "$project_dir/README.md" "$readme"

  emit_event "$id" "project.created" "Project '$name' created by $SELF (tier $tier)"
  log "Created project: $id ($name)"
}

# ── Create a task within a project ────────────────────────────────────
cmd_task() {
  local project_id="$1"
  local title="$2"
  shift 2

  local assigned=""
  local council_head="$SELF"
  local spec=""
  local domain_fit=""
  local contrib_type="production"

  while [ $# -gt 0 ]; do
    case "$1" in
      --assign) assigned="$2"; shift 2 ;;
      --council-head) council_head="$2"; shift 2 ;;
      --spec) spec="$2"; shift 2 ;;
      --domain-fit) domain_fit="$2"; shift 2 ;;
      --type) contrib_type="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [ -z "$project_id" ] || [ -z "$title" ]; then
    echo "Usage: olympus-project.sh task <project-id> <title> [--assign member] [--spec '...'] [--domain-fit '...'] [--type research|analysis|production|decision-support|field-report]"
    exit 1
  fi

  local now=$(timestamp)
  local task_id="task-$(datestamp)-$(printf '%03d' $((RANDOM % 1000)))"
  local task_dir="$NAS_PROJECTS/$project_id/tasks/active"

  local escaped_spec=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "${spec:-No spec provided}" 2>/dev/null)
  local escaped_fit=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "${domain_fit:-Not specified}" 2>/dev/null)

  local task_json=$(cat << ENDJSON
{
  "id": "$task_id",
  "project": "$project_id",
  "title": "$title",
  "spec": ${escaped_spec},
  "assigned_to": "${assigned:-unassigned}",
  "council_head": "$council_head",
  "quorum": "$council_head",
  "domain_fit": ${escaped_fit},
  "contribution_type": "$contrib_type",
  "status": "active",
  "created": "$now",
  "updated": "$now",
  "completion": {
    "completed_at": null,
    "evidence": null,
    "artifacts": [],
    "council_review": null,
    "council_accepted": false
  },
  "cross_quorum": null
}
ENDJSON
)

  write_nas "$task_dir/$task_id.json" "$task_json"
  emit_event "$project_id" "task.created" "Task '$title' created${assigned:+, assigned to $assigned}"
  log "Created task: $task_id in $project_id${assigned:+ (assigned: $assigned)}"
}

# ── Find a task file by ID across status directories ──────────────────
find_task() {
  local project_id="$1"
  local task_id="$2"
  local pdir="$NAS_PROJECTS/$project_id"
  
  for status_dir in active review completed blocked; do
    local fpath="$pdir/tasks/$status_dir/$task_id.json"
    if [ -f "$fpath" ]; then
      echo "$fpath"
      return 0
    fi
  done
  return 1
}

# ── Move task between status directories ──────────────────────────────
move_task() {
  local task_file="$1"
  local new_status="$2"
  local project_id="$3"
  local task_id="$4"
  
  local new_dir="$NAS_PROJECTS/$project_id/tasks/$new_status"
  mkdir -p "$new_dir" 2>/dev/null
  
  local new_path="$new_dir/$task_id.json"
  if [ "$task_file" != "$new_path" ]; then
    mv "$task_file" "$new_path" 2>/dev/null
  fi
  echo "$new_path"
}

# ── Update task with completion report ────────────────────────────────
cmd_task_update() {
  local task_id="$1"
  shift
  
  local project_id=""
  local new_status=""
  local report=""
  local artifact=""
  
  while [ $# -gt 0 ]; do
    case "$1" in
      --project) project_id="$2"; shift 2 ;;
      --status) new_status="$2"; shift 2 ;;
      --report) report="$2"; shift 2 ;;
      --artifact) artifact="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  
  if [ -z "$task_id" ]; then
    echo "Usage: olympus-project.sh task-update <task-id> --project <id> --status review --report '...'"
    exit 1
  fi
  
  # Search all projects if project not specified
  if [ -z "$project_id" ]; then
    for pdir in "$NAS_PROJECTS"/*/; do
      local pid=$(basename "$pdir")
      if find_task "$pid" "$task_id" >/dev/null 2>&1; then
        project_id="$pid"
        break
      fi
    done
  fi
  
  if [ -z "$project_id" ]; then
    log "ERROR: Task $task_id not found in any project"
    exit 1
  fi
  
  local task_file=$(find_task "$project_id" "$task_id")
  if [ -z "$task_file" ]; then
    log "ERROR: Task $task_id not found in $project_id"
    exit 1
  fi
  
  local now=$(timestamp)
  
  # Update the task JSON
  python3 -c "
import json, sys

task_file = '$task_file'
with open(task_file) as f:
    task = json.load(f)

task['updated'] = '$now'

status = '${new_status}'
if status:
    task['status'] = status

report = '''${report}'''
if report:
    task['completion']['evidence'] = report
    task['completion']['completed_at'] = '$now'

artifact = '${artifact}'
if artifact:
    task['completion']['artifacts'].append(artifact)

with open(task_file, 'w') as f:
    json.dump(task, f, indent=2)

print(f'Updated: {task[\"id\"]} → status={task[\"status\"]}')
" 2>/dev/null
  
  # Move to new status directory if status changed
  if [ -n "$new_status" ]; then
    local new_path=$(move_task "$task_file" "$new_status" "$project_id" "$task_id")
    log "Moved $task_id to $new_status"
  fi
  
  emit_event "$project_id" "task.updated" "Task '$task_id' updated to $new_status"
  log "Updated: $task_id in $project_id"
}

# ── Council head accepts a task (column goes up) ─────────────────────
cmd_task_accept() {
  local task_id="$1"
  shift
  
  local project_id=""
  local review=""
  
  while [ $# -gt 0 ]; do
    case "$1" in
      --project) project_id="$2"; shift 2 ;;
      --review) review="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  
  if [ -z "$task_id" ]; then
    echo "Usage: olympus-project.sh task-accept <task-id> --project <id> --review '...'"
    exit 1
  fi
  
  # Find the task
  if [ -z "$project_id" ]; then
    for pdir in "$NAS_PROJECTS"/*/; do
      local pid=$(basename "$pdir")
      if find_task "$pid" "$task_id" >/dev/null 2>&1; then
        project_id="$pid"
        break
      fi
    done
  fi
  
  if [ -z "$project_id" ]; then
    log "ERROR: Task $task_id not found"
    exit 1
  fi
  
  local task_file=$(find_task "$project_id" "$task_id")
  local now=$(timestamp)
  
  python3 -c "
import json
with open('$task_file') as f:
    task = json.load(f)

task['status'] = 'accepted'
task['updated'] = '$now'
task['completion']['council_review'] = '''${review:-Accepted by council head}'''
task['completion']['council_accepted'] = True

with open('$task_file', 'w') as f:
    json.dump(task, f, indent=2)

print(f'ACCEPTED: {task[\"title\"]}')
print(f'  Assigned: {task[\"assigned_to\"]}')
print(f'  Type: {task[\"contribution_type\"]}')
print(f'  Evidence: {str(task[\"completion\"][\"evidence\"])[:100]}...' if task['completion']['evidence'] else '  Evidence: none')
" 2>/dev/null
  
  # Move to completed directory
  move_task "$task_file" "completed" "$project_id" "$task_id" >/dev/null
  
  emit_event "$project_id" "task.accepted" "Task '$task_id' accepted by $SELF — column up"
  
  # Broadcast to dashboard
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [ -x "$SCRIPT_DIR/flywheel-broadcast.sh" ]; then
    "$SCRIPT_DIR/flywheel-broadcast.sh" "task.accepted" "$project_id" "Task accepted: $(python3 -c "import json; print(json.load(open('$NAS_PROJECTS/$project_id/tasks/completed/$task_id.json'))['title'])" 2>/dev/null)" "$task_id" 2>/dev/null &
  fi
  
  log "✓ Task $task_id ACCEPTED — column goes up"
}

# ── Council head rejects a task (back to active with feedback) ────────
cmd_task_reject() {
  local task_id="$1"
  shift
  
  local project_id=""
  local feedback=""
  
  while [ $# -gt 0 ]; do
    case "$1" in
      --project) project_id="$2"; shift 2 ;;
      --feedback) feedback="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  
  if [ -z "$task_id" ]; then
    echo "Usage: olympus-project.sh task-reject <task-id> --project <id> --feedback '...'"
    exit 1
  fi
  
  # Find the task
  if [ -z "$project_id" ]; then
    for pdir in "$NAS_PROJECTS"/*/; do
      local pid=$(basename "$pdir")
      if find_task "$pid" "$task_id" >/dev/null 2>&1; then
        project_id="$pid"
        break
      fi
    done
  fi
  
  if [ -z "$project_id" ]; then
    log "ERROR: Task $task_id not found"
    exit 1
  fi
  
  local task_file=$(find_task "$project_id" "$task_id")
  local now=$(timestamp)
  
  python3 -c "
import json
with open('$task_file') as f:
    task = json.load(f)

task['status'] = 'active'
task['updated'] = '$now'
task['completion']['council_review'] = '''${feedback:-Rejected — see feedback}'''
task['completion']['council_accepted'] = False
# Append feedback to spec so it's included in next dispatch
task['spec'] = task.get('spec', '') + '\n\n[COUNCIL FEEDBACK]: ${feedback}'

with open('$task_file', 'w') as f:
    json.dump(task, f, indent=2)

print(f'REJECTED: {task[\"title\"]}')
print(f'  Feedback: ${feedback:-No feedback provided}')
print(f'  Status: back to active for re-dispatch')
" 2>/dev/null
  
  # Move back to active directory
  move_task "$task_file" "active" "$project_id" "$task_id" >/dev/null
  
  emit_event "$project_id" "task.rejected" "Task '$task_id' rejected by $SELF — feedback attached"
  log "Task $task_id REJECTED — back to active with feedback"
}

# ── Emit a custom event ───────────────────────────────────────────────
cmd_event() {
  local project_id="$1"
  local etype="$2"
  shift 2
  local detail="$*"

  if [ -z "$project_id" ] || [ -z "$etype" ]; then
    echo "Usage: olympus-project.sh event <project-id> <type> <detail>"
    exit 1
  fi

  emit_event "$project_id" "$etype" "$detail"
  log "Event: $etype on $project_id"
}

# ── List projects ─────────────────────────────────────────────────────
cmd_list() {
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║              MOUNT OLYMPUS — PROJECTS                      ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  if [ ! -d "$NAS_PROJECTS" ]; then
    log "No projects directory at $NAS_PROJECTS"
    log "Run: olympus-project.sh create <id> <name> <purpose>"
    return
  fi

  printf "%-20s %-8s %-10s %-12s %s\n" "PROJECT" "TIER" "STATUS" "PHASE" "PURPOSE"
  echo "────────────────────────────────────────────────────────────────────────"

  for pdir in "$NAS_PROJECTS"/*/; do
    if [ -f "$pdir/project.json" ]; then
      local id=$(basename "$pdir")
      local name=$(python3 -c "import json; d=json.load(open('$pdir/project.json')); print(d.get('name','?'))" 2>/dev/null)
      local tier=$(python3 -c "import json; d=json.load(open('$pdir/project.json')); print(d.get('tier','?'))" 2>/dev/null)
      local status=$(python3 -c "import json; d=json.load(open('$pdir/project.json')); print(d.get('status','?'))" 2>/dev/null)
      local phase=$(python3 -c "import json; d=json.load(open('$pdir/project.json')); print(d.get('phase','?'))" 2>/dev/null)
      local purpose=$(python3 -c "import json; d=json.load(open('$pdir/project.json')); print(d.get('purpose','?')[:50])" 2>/dev/null)
      printf "%-20s %-8s %-10s %-12s %s\n" "$id" "T$tier" "$status" "$phase" "$purpose"
    fi
  done
}

# ── Project status ────────────────────────────────────────────────────
cmd_status() {
  local project_id="$1"

  if [ -z "$project_id" ]; then
    cmd_list
    return
  fi

  local pdir="$NAS_PROJECTS/$project_id"
  if [ ! -f "$pdir/project.json" ]; then
    log "Project not found: $project_id"
    exit 1
  fi

  python3 -c "
import json, os

d = json.load(open('$pdir/project.json'))
print(f\"Project: {d['name']}\")
print(f\"Purpose: {d['purpose']}\")
print(f\"Status:  {d['status']} | Phase: {d['phase']} | Tier: {d.get('tier','?')}\")
print(f\"Owner:   {d['owner']}\")
print(f\"Tasks:   {d['tasks']['active']} active, {d['tasks']['completed']} done, {d['tasks']['blocked']} blocked\")
print(f\"Deploys: {d['deploys']['staged']} staged, {d['deploys']['completed']} done, {d['deploys']['failed']} failed\")
print(f\"Updated: {d['updated']}\")

# List tasks by status
for status_name, status_dir in [('Active', 'active'), ('In Review', 'review'), ('Completed', 'completed'), ('Blocked', 'blocked')]:
    task_dir = f'$pdir/tasks/{status_dir}'
    if os.path.isdir(task_dir):
        tasks = [f for f in os.listdir(task_dir) if f.endswith('.json')]
        if tasks:
            print(f\"\n{status_name} Tasks:\")
            for tf in sorted(tasks):
                t = json.load(open(os.path.join(task_dir, tf)))
                assigned = t.get('assigned_to', 'unassigned')
                ctype = t.get('contribution_type', '?')
                accepted = '✓' if t.get('completion', {}).get('council_accepted') else ' '
                print(f\"  [{accepted}] {t['title']} → {assigned} ({ctype})\")
" 2>/dev/null
}

# ── Main ──────────────────────────────────────────────────────────────

# ── Dispatch a task to a quorum member via the AI bridge ──────────────
cmd_task_dispatch() {
  local task_id="$1"
  local target_node="$2"
  local project_id=""

  shift 2 2>/dev/null
  while [ $# -gt 0 ]; do
    case "$1" in
      --project) project_id="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [ -z "$task_id" ] || [ -z "$target_node" ]; then
    echo "Usage: olympus-project.sh task-dispatch <task-id> <target-node> [--project <id>]"
    exit 1
  fi

  # Find the task file
  if [ -z "$project_id" ]; then
    for pdir in "$NAS_PROJECTS"/*/; do
      local pid=$(basename "$pdir")
      if find_task "$pid" "$task_id" >/dev/null 2>&1; then
        project_id="$pid"
        break
      fi
    done
  fi

  if [ -z "$project_id" ]; then
    log "ERROR: Task $task_id not found in any project"
    exit 1
  fi

  local task_file=$(find_task "$project_id" "$task_id")
  if [ -z "$task_file" ]; then
    log "ERROR: Task $task_id not found in $project_id"
    exit 1
  fi

  local now=$(timestamp)

  # Export env vars for python script
  export TASK_FILE="$task_file"
  export TARGET_NODE="$target_node"
  export SELF_NODE="$SELF"
  export NOW="$now"
  export PROJECT_ID="$project_id"

  python3 << 'PYEOF'
import json, sys, uuid, os

try:
    from websockets.sync.client import connect
except ImportError:
    print("ERROR: websockets not installed. Run: pip3 install websockets", file=sys.stderr)
    sys.exit(1)

task_file = os.environ["TASK_FILE"]
target = os.environ["TARGET_NODE"]
self_node = os.environ["SELF_NODE"]
now = os.environ["NOW"]
project_id = os.environ["PROJECT_ID"]

with open(task_file) as f:
    task = json.load(f)

task_id = task["id"]

payload = {
    "id": str(uuid.uuid4()),
    "from": self_node,
    "to": self_node,
    "type": "task.dispatch",
    "body": json.dumps({
        "task_id": task_id,
        "target_agent": target,
        "spec": task.get("spec", ""),
        "domain_fit": task.get("domain_fit", ""),
        "contribution_type": task.get("contribution_type", "production"),
        "council_head": task.get("council_head", self_node),
        "timeout_seconds": 120,
        "require_evidence": True,
        "project": task.get("project", project_id),
    }),
    "session_ref": None,
    "timestamp": now,
}

peers = {"zeus": "10.0.0.1", "poseidon": "10.0.0.2", "hades": "10.0.0.3", "gaia": "10.0.0.4"}
my_ip = peers.get(self_node, "127.0.0.1")

try:
    ws = connect(f"ws://{my_ip}:18800", open_timeout=5)
    ws.send(json.dumps(payload))
    try:
        resp = ws.recv(timeout=5)
        msg = json.loads(resp)
        print(f"Bridge acknowledged: {msg.get('type', 'unknown')}")
    except Exception:
        print("Dispatch sent (no immediate ack)")
    ws.close()
except Exception as e:
    print(f"ERROR: Could not connect to council-peer: {e}", file=sys.stderr)
    sys.exit(1)

task["dispatched_to"] = target
task["dispatched_at"] = now
task["updated"] = now
with open(task_file, "w") as f:
    json.dump(task, f, indent=2)

print(f"Dispatched task {task_id} to {target}")
PYEOF

  if [ $? -eq 0 ]; then
    emit_event "$project_id" "task.dispatched" "Task '$task_id' dispatched to $target_node"
    log "Dispatched $task_id to $target_node"
  else
    log "ERROR: Dispatch failed for $task_id"
    exit 1
  fi
}
case "${1:-help}" in
  create)      shift; cmd_create "$@" ;;
  task)        shift; cmd_task "$@" ;;
  task-update) shift; cmd_task_update "$@" ;;
  task-accept) shift; cmd_task_accept "$@" ;;
  task-reject) shift; cmd_task_reject "$@" ;;
  task-dispatch) shift; cmd_task_dispatch "$@" ;;
  event)       shift; cmd_event "$@" ;;
  status)      shift; cmd_status "$@" ;;
  list)        cmd_list ;;
  *)
    echo "olympus-project.sh — Mount Olympus Project Management"
    echo ""
    echo "Task Lifecycle:"
    echo "  task <project> <title> [--assign X] [--spec '...'] [--type T]  Create task"
    echo "  task-update <task-id> --project P --status review --report '...'  Report completion"
    echo "  task-accept <task-id> --project P --review '...'                 Council accepts (column up)"
    echo "  task-reject <task-id> --project P --feedback '...'               Council rejects (back to active)"
    echo "  task-dispatch <task-id> <target-node> [--project P]              Dispatch via AI bridge"
    echo ""
    echo "Project Management:"
    echo "  create <id> <name> <purpose> [--owner X] [--tier N]   Create project"
    echo "  event <project> <type> <detail>                       Log event"
    echo "  status [project-id]                                   Show status"
    echo "  list                                                  List all projects"
    echo ""
    echo "Task Types: research | analysis | production | decision-support | field-report"
    echo "Task Statuses: active → review → accepted (column up) | rejected → active"
    ;;
esac
