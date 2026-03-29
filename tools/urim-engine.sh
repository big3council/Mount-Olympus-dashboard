#!/bin/bash
# urim-engine.sh — URIM Autonomous Research Engine
# Dispatches a passage to all quorum members across six analytical layers
# and collects responses into a structured run directory.
# 
# Usage: urim-engine.sh "<passage_reference>" "<passage_text>"
# Example: urim-engine.sh "Mosiah 3:17" "And moreover, I say unto you..."

set -euo pipefail

PASSAGE_REF="${1:-}"
PASSAGE_TEXT="${2:-}"

if [ -z "$PASSAGE_REF" ] || [ -z "$PASSAGE_TEXT" ]; then
  echo "Usage: urim-engine.sh '<passage_ref>' '<passage_text>'"
  echo "Example: urim-engine.sh 'Mosiah 3:17' 'And moreover...'"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RUN_DIR="/Volumes/olympus/shared/projects/urim/quorum-logs/${TIMESTAMP}"
FINDINGS_DIR="/Volumes/olympus/shared/projects/urim/findings"
TOKEN="b67accb237fdc708bc216bcf283ae3948ed84c3b5d9fc673"
DISPATCH="$HOME/olympus/tools/call_quorum.sh"

mkdir -p "$RUN_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$RUN_DIR/engine.log"
}

dispatch_agent() {
  local agent="$1"
  local layer="$2"
  local prompt="$3"
  local outfile="$RUN_DIR/${agent}-L${layer}.txt"
  
  log "Dispatching $agent (Layer $layer)..."
  
  ESCAPED=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$prompt")
  IP=""
  case "$agent" in
    hermes)     IP="192.168.1.102" ;;
    athena)     IP="192.168.1.189" ;;
    apollo)     IP="192.168.1.170" ;;
    hestia)     IP="192.168.1.105" ;;
    aphrodite)  IP="192.168.1.123" ;;
    iris)       IP="192.168.1.117" ;;
    demeter)    IP="192.168.1.113" ;;
    prometheus) IP="192.168.1.131" ;;
    hephaestus) IP="192.168.1.156" ;;
    nike)       IP="192.168.1.165" ;;
    artemis)    IP="192.168.1.152" ;;
    ares)       IP="192.168.1.182" ;;
    *) log "Unknown agent: $agent"; return 1 ;;
  esac
  
  RESPONSE=$(curl -s --max-time 120 -X POST "http://${IP}:18789/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-openclaw-scopes: operator.write" \
    -H "x-openclaw-session-key: quorum-${agent}-urim-${TIMESTAMP}" \
    -d "{\"model\":\"openclaw\",\"messages\":[{\"role\":\"user\",\"content\":${ESCAPED}}],\"stream\":false}" 2>/dev/null)
  
  if echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" > "$outfile" 2>/dev/null; then
    local size=$(wc -c < "$outfile")
    log "$agent returned ${size} bytes → $outfile"
    return 0
  else
    echo "ERROR: $RESPONSE" > "$outfile"
    log "ERROR: $agent failed — $(echo $RESPONSE | head -c 200)"
    return 1
  fi
}

log "=== URIM Engine starting — Passage: $PASSAGE_REF ==="
log "Run directory: $RUN_DIR"

# Write run manifest
cat > "$RUN_DIR/manifest.json" << JSON
{
  "passage_ref": "$PASSAGE_REF",
  "passage_text": $(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$PASSAGE_TEXT"),
  "timestamp": "$TIMESTAMP",
  "status": "running",
  "agents": {
    "zeus_quorum": ["apollo", "hermes", "athena", "hestia"],
    "poseidon_quorum": ["demeter", "prometheus", "iris"],
    "hades_quorum": ["hephaestus", "ares", "artemis"]
  }
}
JSON

log "Manifest written."

# === ZEUS QUORUM ===
# Apollo — Layer 2: Symbolic Grammar
APOLLO_PROMPT="APOLLO — LAYER 2 ASSIGNMENT
Project: URIM Autonomous Research Engine
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Symbolic Grammar — how does 'name' function in this verse?

In the Hebrew prophetic tradition, 'the name of' functions as a covenant trust mark — a legally exclusive identifier in a covenant relationship. Your task:

PART 1: Identify at least three scriptural examples where 'the name of' functions as a covenant access mechanism (not a personal identifier). Map the pattern.

PART 2: Apply the pattern to this verse. Does 'the name of Christ' function as: (a) personal identifier, (b) covenant trust mark, or (c) both? What in the verse's structure supports your reading?

PART 3: The chapter arc — this speech ends (Mosiah 5) with the people taking upon themselves the name of Christ — explicitly a covenant-making act. Does this strengthen or complicate the Layer 2 hypothesis?

COMPLETION: Three cross-references, your reading with textual support, arc assessment, confidence score (Low/Medium/Medium-High/High), one unsolicited observation from your domain."

dispatch_agent "apollo" "2" "$APOLLO_PROMPT" &

# Hestia — Layer 6: Spiritual Discernment
HESTIA_PROMPT="HESTIA — LAYER 6 ASSIGNMENT
Project: URIM Autonomous Research Engine
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Spiritual Discernment — hold this passage attentively and report what you notice.

You are not asked to analyze. You are asked to discern.

QUESTION 1: Does the formulation 'no other name... no other way... no other means' feel like a doctrinal declaration being taught to an audience that needs information, or does it feel like a covenant declaration being uttered at a moment of covenant-making? What in the text gives you this sense?

QUESTION 2: 'The Lord Omnipotent' appears only in the Book of Mormon. When you read it in this context, does it feel like a title that carries specific covenant weight, or a general theological description?

QUESTION 3: Is there anything in how the council might read this passage — symbolic grammar claims, intertextual connections — that feels like it might be imposing rather than receiving? If yes, name it. If no, confirm the approach feels grounded.

COMPLETION: Your discernment responses, one sentence for the council to carry before proceeding, and whether you would flag this passage for elevated care before any formal elevation — yes, no, or pending."

dispatch_agent "hestia" "6" "$HESTIA_PROMPT" &

wait
log "Zeus quorum complete."

# Athena — Layer 3 Adversarial (after Apollo has run)
APOLLO_OUTPUT=""
if [ -f "$RUN_DIR/apollo-L2.txt" ]; then
  APOLLO_OUTPUT=$(cat "$RUN_DIR/apollo-L2.txt" | head -300)
fi

ATHENA_PROMPT="ATHENA — LAYER 3 ADVERSARIAL ASSIGNMENT
Project: URIM Autonomous Research Engine
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Challenge the intertextual connections and symbolic grammar hypotheses. Break what doesn't hold.

Apollo's Layer 2 analysis (for context — challenge it):
${APOLLO_OUTPUT}

YOUR THREE CHALLENGES:

CHALLENGE 1: The 'name' as covenant trust mark — find contexts in the Book of Mormon where 'name' is clearly NOT functioning as a covenant marker. If 'name' is used broadly and non-covenantally, the Layer 2 reading imports meaning not linguistically grounded.

CHALLENGE 2: The Acts 4:12 intertextual connection ('neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved'). These passages share vocabulary. Is this independent revelation or parallel rhetorical response to the same human question — what would distinguish the two? Specify the test.

CHALLENGE 3: The exclusive formulation 'no other name / no other way / no other means' — does this appear frequently enough in ancient and Christian tradition that its presence in the Book of Mormon requires no special explanation?

FOR EACH CHALLENGE: State the strongest version, identify what evidence would resolve it, rate its strength (weak/medium/strong), and give your verdict on whether the hypothesis survives it.

COMPLETION: Three challenge assessments, your verdict on the strongest challenge, what evidence the surviving challenge still needs."

dispatch_agent "athena" "3" "$ATHENA_PROMPT"
log "Athena complete."

# === POSEIDON QUORUM ===
# Demeter — Layer 4: Structural Position + Null Hypothesis
DEMETER_PROMPT="DEMETER — LAYER 4 ASSIGNMENT
Project: URIM Autonomous Research Engine  
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Structural Position Analysis — null hypothesis FIRST, then count.

PART 1 — NULL HYPOTHESIS (state this before counting):
Mosiah 3:17 sits within King Benjamin's angelic address (Mosiah 3:1-27). If key declarations in prophetic speeches are randomly distributed within the speech — state what a random position would look like: what percentage constitutes the first, middle, and final thirds of a 27-verse unit? What position would constitute a structurally privileged location vs. incidental? State this explicitly before examining the actual verse position.

PART 2 — COUNT AND MAP (after Part 1):
- Exact verse position of Mosiah 3:17 within Mosiah 3:1-27
- What structural unit does 3:17 conclude or open?
- How many times does 'name' appear in Mosiah 3:1-27? Where does it cluster?
- Is there a chiastic structure with a center point? If so, what is the center?

PART 3 — HONEST VERDICT:
Does Mosiah 3:17's position beat the null hypothesis? Structurally privileged, incidental, or insufficient evidence?

COMPLETION: Null hypothesis stated before counting (non-negotiable), raw counts before interpretation, confidence score, falsification flag if null hypothesis not beaten."

dispatch_agent "demeter" "4" "$DEMETER_PROMPT" &

# Prometheus — Adversarial Stress-Test (runs alongside Demeter)
PROM_PROMPT="PROMETHEUS — ADVERSARIAL ASSIGNMENT
Project: URIM Autonomous Research Engine
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Challenge all layer findings before seeing them. Generate adversarial tests in advance.

CHALLENGE 1 — Symbolic Grammar ('name' as covenant trust mark):
Find the strongest counterexample: is there a Book of Mormon context where 'name' appears in a clearly non-covenantal register? State the verse. If none, acknowledge that.

CHALLENGE 2 — Acts 4:12 intertextual connection:
Calculate: both passages may reflect common theological tradition (the exclusive mediation claim), not independent revelation. What is the minimum evidence required to distinguish 'cross-dispensational design' from 'parallel response to the same human question'?

CHALLENGE 3 — Structural position claim:
In any 27-verse unit, what is the probability that any given verse could plausibly be argued to be at the 'center' or 'apex' of something? Calculate this. Does the structural claim need a tighter standard?

CHALLENGE 4 — 'Lord Omnipotent' as distinctive evidence:
Uniqueness to the Book of Mormon does not establish translation archaeology significance — it may reflect Joseph Smith's 1829-1830 vocabulary. What evidence would distinguish a revealed title from ambient vocabulary?

FOR EACH: State the challenge at full strength, rate it (weak/medium/strong), specify what evidence resolves it."

dispatch_agent "prometheus" "4" "$PROM_PROMPT" &

wait
log "Poseidon quorum complete."

# === HADES QUORUM ===
# Hephaestus — Layer 1: Structural Map
HEPH_PROMPT="HEPHAESTUS — LAYER 1 ASSIGNMENT
Project: URIM Autonomous Research Engine
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Map the chiastic or parallel structure of Mosiah 3:1-27 BEFORE locating the verse.

MANDATORY ORDER: Find the structure first. Locate the verse within it second. Do not reverse this order.

PART 1 — STRUCTURAL MAP (before locating 3:17):
Map any chiastic or parallel structures in Mosiah 3:1-27. Show the structure (shown, not asserted). Identify structural units — where does each argument begin and end?

PART 2 — VERSE LOCATION:
After completing the structural map: which unit does Mosiah 3:17 belong to? Does it open, close, or center that unit? What is its relationship to Mosiah 3:16 and 3:18?

PART 3 — ENGINEERING VERDICT:
Structurally privileged, structurally incidental, or insufficient evidence? What is the load-bearing element — the one feature most distinctive or most vulnerable to falsification?

COMPLETION: Structural map shown (not asserted), verse placement, verdict with confidence score, one engineering observation a non-engineer would miss."

dispatch_agent "hephaestus" "1" "$HEPH_PROMPT" &

# Artemis — Layer 5: Translation Archaeology
ARTEMIS_PROMPT="ARTEMIS — LAYER 5 ASSIGNMENT
Project: URIM Autonomous Research Engine
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Translation Archaeology — three specific targets.

TARGET 1 — DUAL PREPOSITION 'in and through':
Null hypothesis FIRST: if 'in and through' is a stylistic construction with no Hebraic significance, what would its distribution look like across the Book of Mormon?
Then: map every occurrence of 'in and through' in the Book of Mormon with brief context. Does it cluster in covenant contexts or appear broadly?
Hebrew note: The beth preposition carries simultaneous locative (in) and instrumental (through) force. Does this dual construction appear to render a beth with double force?

TARGET 2 — 'LORD OMNIPOTENT':
Map every occurrence in the Book of Mormon. Do these cluster around specific theological contexts?

TARGET 3 — TEXTUAL VARIANTS AT THIS VERSE:
Any variants between the 1830 text and 2013 edition?

COMPLETION: Null hypothesis before counting, all 'in and through' occurrences listed, all 'Lord Omnipotent' occurrences mapped, variant assessment, confidence score, one observation no other layer covers."

dispatch_agent "artemis" "5" "$ARTEMIS_PROMPT" &

wait
log "Hades quorum complete."

# Ares — Adversarial challenge of Hephaestus structural claims
HEPH_OUTPUT=""
if [ -f "$RUN_DIR/hephaestus-L1.txt" ]; then
  HEPH_OUTPUT=$(cat "$RUN_DIR/hephaestus-L1.txt" | head -300)
fi

ARES_PROMPT="ARES — ADVERSARIAL ASSIGNMENT
Project: URIM Autonomous Research Engine
Passage: ${PASSAGE_REF}: \"${PASSAGE_TEXT}\"

Task: Challenge the structural analysis. Break what doesn't hold.

Hephaestus's Layer 1 structural map (for context — challenge it):
${HEPH_OUTPUT}

YOUR THREE CHALLENGES:

CHALLENGE 1 — Chiasm selection problem:
What is the minimum standard for a non-arbitrary chiasm? Specify the test before examining whether Hephaestus's chiasm meets it. A chiasm that can be constructed from any text by selecting the relevant elements is not evidence of intentional architecture.

CHALLENGE 2 — Significance problem:
Structural centrality doesn't automatically carry theological weight. What additional evidence links structural position to theological intention? What would prove the position is meaningful rather than incidental?

CHALLENGE 3 — Sermon genre explanation:
Ancient covenant speeches follow genre conventions. What element of this verse's position would be distinctive to this specific passage rather than characteristic of the genre generally?

COMPLETION: Three challenge assessments, which challenge is strongest and why, what evidence would allow the structural claim to survive your strongest challenge."

dispatch_agent "ares" "1" "$ARES_PROMPT"
log "Ares complete."

# Update manifest
python3 -c "
import json, os
manifest_path = '$RUN_DIR/manifest.json'
with open(manifest_path) as f:
    m = json.load(f)
m['status'] = 'complete'
m['agents_complete'] = [
    f.replace('.txt','') for f in os.listdir('$RUN_DIR') if f.endswith('.txt') and not f.startswith('engine')
]
with open(manifest_path, 'w') as f:
    json.dump(m, f, indent=2)
"

log "=== URIM Engine complete. Run: $RUN_DIR ==="
echo ""
echo "Run complete: $RUN_DIR"
echo "Responses:"
ls "$RUN_DIR"/*.txt 2>/dev/null | while read f; do
  echo "  $(basename $f): $(wc -c < $f) bytes"
done
echo ""
echo "Next step: Council heads review responses and write layer summaries."
