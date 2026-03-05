# Mount Olympus — Project State

## Overview

Multi-agent AI council system. Three AI agents (Zeus, Poseidon, Hades) collaborate via the
B3C (Balanced Three-Council) protocol to deliberate, execute, and synthesize responses to
requests. Gaia is a fourth agent who operates autonomously as the Memory and Retrospective
intelligence — she observes the council, issues nightly retrospectives, and sends growth
directives. A React dashboard visualizes everything in real time.

---

## Repository Layout

```
/Users/zeus/olympus/
├── CLAUDE.md                     ← this file
├── ecosystem.config.cjs          ← PM2 process definitions
├── data/
│   ├── missions.json             ← persisted B3C mission history
│   └── gaia_conversations.json  ← persisted Gaia conversation threads
├── dashboard/
│   ├── public/
│   │   ├── favicon.svg           ← lightning bolt icon (dark bg, gold)
│   │   └── site.webmanifest      ← PWA manifest (name: Mount Olympus, theme: #e8b84b)
│   ├── src/
│   │   └── OlympusDashboard.jsx  ← Single-file React component (~3600 lines), all UI
│   ├── index.html                ← favicon/manifest/theme-color links
│   └── vite.config.js            ← host 0.0.0.0, port 3000
└── framework/
    ├── server.js          ← Express + WebSocket server (port 18780)
    ├── b3c.js             ← B3C council orchestration (three-tier pipeline)
    ├── direct.js          ← Direct agent routing (ZEUS PROTOCOL / per-agent)
    ├── gaia.js            ← Gaia's standalone system (retrospectives, directives, direct invocation)
    ├── queue.js           ← Mission queue with tier-based concurrency and priority
    ├── agentCalls.js      ← All agent calls via HTTP to OpenClaw completions endpoints
    ├── processTracker.js  ← Child process registry (SSH era; killAll/cleanup now no-ops)
    ├── telegram.js        ← Telegram bot integration (Zeus/Poseidon/Hades bots)
    └── olympus-ws.js      ← WebSocket broadcast/subscribe helper
```

---

## Agents / Network

| Node     | Tailscale IP    | OpenClaw Port | Token env                | Domain                   |
|----------|-----------------|---------------|--------------------------|--------------------------|
| Zeus     | 100.78.126.27   | 18789         | OPENCLAW_GATEWAY_TOKEN   | Spiritual / Intellectual |
| Poseidon | 100.114.203.41  | 18789         | POSEIDON_OPENCLAW_TOKEN  | Financial / Social       |
| Hades    | 100.68.217.82   | 18789         | HADES_OPENCLAW_TOKEN     | Physical / Technical     |
| Gaia     | 100.74.201.75   | 18789         | GAIA_OPENCLAW_TOKEN      | Retrospective / Memory   |

**Important:** 10.0.0.x Thunderbolt IPs are NOT routed from Zeus. Always use Tailscale IPs.
**No SSH to any agent.** All four agents are called via HTTP POST to their OpenClaw completions endpoints.

### How agents are called (agentCalls.js)

All agents use the same HTTP pattern — POST to `/v1/chat/completions` with `Authorization: Bearer <token>`:

```js
// Generic pattern (callAgent helper inside agentCalls.js):
fetch(`http://<node-ip>:18789/v1/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ model: 'main', messages: [{ role: 'user', content: message }], stream: false }),
})
// Response: data.choices[0].message.content
```

Specific error messages surface on failure (connection refused, timeout, auth error, empty response, etc.) so Zeus diagnostics can pinpoint the cause.

`callGaia` additionally supports a `conversationMessages` array for full thread history (continuous conversation).

`processTracker.js` is still imported by queue.js for `killAll`/`cleanup` but these are now no-ops — no child processes are spawned.

---

## Service Ports

| Service              | Port  | URL                                 |
|----------------------|-------|-------------------------------------|
| Dashboard (Vite)     | 3000  | http://100.78.126.27:3000           |
| Framework API + WS   | 18780 | http://100.78.126.27:18780          |
| OpenClaw gateway     | 18789 | http://<node-ip>:18789 (per node)   |

The proxy health check (`GET /proxy/health?target=URL`) treats any HTTP 2xx as "up".
OpenClaw serves an HTML SPA at all paths — do not parse the body as JSON for health checks.

---

## Environment Variables (.env in framework/)

```
OPENCLAW_GATEWAY_TOKEN=...     # Zeus OpenClaw completions (http://100.78.126.27:18789)
POSEIDON_OPENCLAW_TOKEN=...    # Poseidon OpenClaw completions
HADES_OPENCLAW_TOKEN=...       # Hades OpenClaw completions
GAIA_OPENCLAW_TOKEN=...        # Gaia OpenClaw completions + WS poller auth
TELEGRAM_BOT_TOKEN=...         # Zeus Telegram bot
POSEIDON_BOT_TOKEN=...         # Poseidon Telegram bot
HADES_BOT_TOKEN=...            # Hades Telegram bot
WAR_ROOM_CHAT_ID=...           # Telegram group ID for War Room
GROWTH_GRID_CHAT_ID=...        # Telegram group ID for Gaia's Growth Grid
```

---

## PM2 Processes

Config: `/Users/zeus/olympus/ecosystem.config.cjs`
LaunchAgent plist: `~/Library/LaunchAgents/pm2.zeus.plist` (auto-starts on login)
Node binary: `/Users/zeus/.local/share/fnm/node-versions/v22.22.0/installation/bin/node`

| PM2 Name            | Script              | CWD           |
|---------------------|---------------------|---------------|
| olympus-framework   | server.js           | .../framework |
| olympus-dashboard   | vite preview --host | .../dashboard |

```bash
pm2 list                         # status
pm2 logs                         # tail all logs
pm2 restart olympus-framework    # restart framework
pm2 restart olympus-dashboard    # restart dashboard
pm2 restart all                  # restart both
pm2 save                         # persist after any changes
```

**IMPORTANT — Dashboard deploy workflow:**
The dashboard runs `vite preview` which serves pre-built files from `dist/`.
Source changes do NOT take effect until you rebuild:
```bash
cd /Users/zeus/olympus/dashboard && node_modules/.bin/vite build
pm2 restart olympus-dashboard
```

---

## Framework API (server.js :18780)

```
POST   /request                 Body: { text, channel, target?, userId?, isWarRoom?, priority?, messages? }
  target = "zeus"     (default) → full B3C council (tier-classified)
  target = "poseidon" | "hades" → direct agent, no council
  target = "gaia"               → direct Gaia via HTTP completions (isolated from B3C)
  text starts with "ZEUS PROTOCOL" → direct to Zeus, prefix stripped
  priority = true               → Zeus evaluates queue jump
  messages = [{role, content}]  → full conversation history (Gaia continuous conversation)
  Returns: { ok: true, id }     ← fires immediately; mission runs async via queue

GET    /health                           → { status: 'ok', ... }
GET    /proxy/health?target=<url>        → CORS-safe node reachability (3s timeout, 2xx = up)
GET    /queue                            → { pending: [...], running: [...] } current queue snapshot

GET    /missions                         → all B3C missions as JSON array
POST   /missions/:id                     → upsert a completed B3C mission, writes to disk
DELETE /missions/:id                     → remove mission from store and rewrite missions.json
POST   /missions/:id/cancel              → cancel a mission (no-op kill since HTTP agents)

GET    /gaia/conversations               → all Gaia conversation threads as JSON array
POST   /gaia/conversations/:id           → upsert a Gaia conversation, writes to disk
POST   /gaia/message                     → ingest gaia_message externally (from Gaia's webhook)
POST   /gaia/observe                     → receive mission transcript observation (body: observation object)
POST   /gaia/council                     → initiate council communication; returns { ok, id } immediately; thread arrives via gaia_directive WS events
POST   /gaia/ssh-control                 → Body: { node, command, reason }; SSHes to node, logs, broadcasts gaia_ssh_control

WS     /live                             → broadcasts all pipeline events to dashboard
```

CORS allows GET, POST, DELETE, OPTIONS from all origins.

---

## Mission Queue (queue.js)

All `/request` calls go through the queue. Handles concurrency, priority, and cancellation.

### Concurrency limits
| Tier    | Max concurrent | Used for                                      |
|---------|----------------|-----------------------------------------------|
| TIER_1  | 3              | B3C simple (Zeus only)                        |
| TIER_2  | 2              | B3C focused trio                              |
| TIER_3  | 1              | B3C full deliberation                         |
| DIRECT  | 3              | poseidon, hades, gaia, ZEUS PROTOCOL bypasses |

### Flow
1. `enqueue()` called with the mission
2. For B3C targets: `classifyRequest()` (Zeus HTTP call) determines tier; identity prefix stripped before classification
3. For direct targets: tier = DIRECT immediately
4. If slot open and nothing pending → starts immediately
5. Otherwise appended to pending; Zeus reviews queue asynchronously and may reorder
6. If `priority: true` → Zeus evaluates JUMP or QUEUE

### Queue slot release
The slot is released ONLY when `request_complete` is broadcast — not when the pipeline promise settles. A `subscribe`/`unsubscribe` listener on the WS bus triggers `releaseSlot(id)` at the exact moment the event fires.

### Cancellation
- `POST /missions/:id/cancel` → `cancelMission(id)`
- If pending: removed from queue immediately
- If running: `processTracker.killAll(id)` called (returns 0 since no SSH processes)
- Broadcasts `mission_cancelled` WS event

---

## Mission Persistence (server.js + ~/olympus/data/)

### B3C missions — `missions.json`
- Loaded on startup into `missionsStore`
- `GET /missions` returns all as array
- `POST /missions/:id` upserts; `DELETE /missions/:id` removes
- Dashboard fetches on mount + after WS reconnect (`rehydrateQueue`)
- Dashboard POSTs completed missions; `savedMissionIds` ref prevents duplicates
- ✕ delete button on completed/cancelled sidebar cards → optimistic UI removal + `DELETE /missions/:id`

### Gaia conversations — `gaia_conversations.json`
- Loaded on startup into `gaiaConvsStore`
- Each conversation: `{ id, userId, timestamp, messages: [{role, text, timestamp}] }`
- `savedGaiaConvIds` ref (keyed `convId:msgCount`) prevents duplicate POSTs

---

## B3C Pipeline (b3c.js)

### Classification (`classifyRequest`)

Strips `Message from [name]:` identity prefix before sending to Zeus, so routing context never inflates complexity. Uses a tight prompt with 5 concrete examples per tier:

- **TIER_1** — greetings, status checks, casual conversation, simple yes/no
- **TIER_2** — focused tasks: writing, coding, analysis, research, explanations
- **TIER_3** — complex multi-domain, high-stakes, strategic decisions

When in doubt, promotes UP. Logs: `[CLASSIFY] 'first 60 chars' → TIER_X`

### Agent call safety (`callSafe`)

Every agent call in the pipeline is wrapped:
```js
callSafe(requestId, agent, phase, fn)
// Emits: agent_start → runs fn() → agent_complete | agent_error
// Never throws — returns { ok, result } or { ok: false, error }
```

On `agent_error`, automatically fires `triggerZeusDiagnostic` in the background:
Zeus receives the failed agent, phase, and error message, and broadcasts a `zeus_diagnostic` event with his diagnosis and recommended fix.

Phases used: `'coordination'` · `'council_initial'` · `'execution'` · `'review'` · `'revision'` · `'synthesis'`

### Pipeline flow

```
POST /request (B3C target)
       │
       ▼
[QUEUE — queue.js]
  classifyRequest() — strips identity prefix, tight examples prompt
  Wait for open concurrency slot
       │
       ▼
[INITIAL COUNCIL]
  TIER_1: Zeus alone → immediate output (Tier 1 unchanged, no callSafe wrapping)
  TIER_2: Zeus coordinates (callSafe:coordination) → parallel execution → single review pass → synthesis
  TIER_3:
    Zeus frames (callSafe:council_initial)
    Poseidon + Hades respond in parallel (callSafe:council_initial)
    Zeus calls vote → VOTE: APPROVE or VOTE: DELIBERATE
    If DELIBERATE: Poseidon + Hades deliberate in parallel, loop back
       │
       ▼
[PARALLEL EXECUTION — TIER_2 and TIER_3]
  All three agents run concurrently via Promise.all(callSafe(...)) — phase: 'execution'
  One failure doesn't kill peers — null deliverable noted in synthesis
  task_assigned broadcast only for successful deliverables
       │
       ▼
[BACKEND COUNCIL — TIER_2 and TIER_3]
  TIER_2: All three review in parallel (callSafe:review) → synthesis
  TIER_3:
    Zeus reviews (callSafe:review) → Poseidon + Hades review in parallel (callSafe:review)
    Unanimous AYE → Zeus synthesizes (callSafe:synthesis)
    Not unanimous → targeted revisions (callSafe:revision) → loop back
       │
       ▼
[OUTPUT]
  broadcast: request_complete { id, elapsed, output, channel, tier?, direct?, councils? }
```

---

## Direct Routing (direct.js)

Used for ZEUS PROTOCOL and per-agent targets (Poseidon, Hades).
- Calls the agent directly via HTTP (no council)
- Broadcasts `agent_thought` then `request_complete { ..., direct: agentName }`
- The `direct` field on `request_complete` is used by telegram.js to select the right reply bot

---

## Gaia Standalone System (gaia.js)

Gaia is architecturally isolated from B3C. All calls via HTTP — no SSH ever.

### callGaia (agentCalls.js)
```js
callGaia(message, _requestId, conversationMessages = null)
```
- `conversationMessages` = full OpenAI-format history `[{role, content}]` — enables continuous conversation
- If null, wraps message in single-item array

### Capabilities

**1. Observer mesh** — `observeMission(observation)` (called from b3c.js after every mission)
- Appends full mission transcript to `~/olympus/gaia/observations/YYYY-MM-DD.json`
- Transcript includes: request, userId, channel, tier, councilInitial, councilBackend, deliverables, failures, output, elapsed
- One file per day (array of observations)

**2. Nightly retrospective** — cron at 23:00
- Reads today's `observations/YYYY-MM-DD.json` (rich transcripts); falls back to `missions.json`
- Broadcasts `gaia_retrospective`, sends to Growth Grid

**3. Direct Gaia invocation** — `runDirectGaia(requestId, text, channel, userId, conversationMessages)`
- Called by queue.js when `target === 'gaia'`
- Broadcasts `agent_thought` → `request_complete` → `gaia_message`

**4. B3C council communication** — `gaiaInitiateCouncil(message)`
- Zeus → [Poseidon + Hades parallel] → Gaia closes
- Each message broadcast as `gaia_directive`
- Full thread persisted to `~/olympus/gaia/council-log.json`

**5. Growth directives** — `sendGrowthDirective(targetAgent, directive)`
- Broadcasts `gaia_growth` events, sends summary to Growth Grid

**6. SSH Control** — `executeSSHControl(node, command, reason)`
- Valid nodes: zeus (100.78.126.27), poseidon (100.114.203.41), hades (100.68.217.82)
- Framework sends HTTP POST to `http://100.74.201.75:18790/ssh-control` (Gaia's SSH control service)
- Gaia's service executes SSH locally using her own keypair (`~/.ssh/id_ed25519`) — Zeus never touches Gaia
- Framework mirrors the log entry to `~/olympus/gaia/ssh-control.log` and broadcasts `gaia_ssh_control`
- Auth: `Authorization: Bearer GAIA_SSH_SERVICE_TOKEN` header if env var set

**Gaia SSH Control Service** — `~/olympus/gaia-ssh-service.js` on Gaia's machine
- Zero-dependency Node.js HTTP server on port 18790
- `POST /ssh-control` — executes SSH using `~/.ssh/id_ed25519`, returns `{ ok, result, node, command }`
- `GET /health` — health check
- Logs to `~/olympus/gaia/ssh-control.log` on Gaia's machine
- Start: `GAIA_SSH_SERVICE_TOKEN=<token> node gaia-ssh-service.js`
- Architectural isolation: B3C nodes never SSH into Gaia; Gaia executes all interventions herself

### Gaia OpenClaw Poller (server.js)
- Polls `ws://100.74.201.75:18789` every 30s
- Auth: `openclaw-probe` client + `Origin: http://localhost:18789` + `auth: { token: GAIA_TOKEN }`
- Method: `chat.history { sessionKey: 'main', limit: 100 }`
- Broadcasts `gaia_message` for new pairs; tracks `gaiaLastSeenTs`

---

## Telegram Integration (telegram.js)

Three bots (polling mode):

| Bot      | Token env            | Target   | Behavior                           |
|----------|----------------------|----------|------------------------------------|
| Zeus     | TELEGRAM_BOT_TOKEN   | zeus     | Full B3C or ZEUS PROTOCOL          |
| Poseidon | POSEIDON_BOT_TOKEN   | poseidon | Direct Poseidon                    |
| Hades    | HADES_BOT_TOKEN      | hades    | Direct Hades                       |

- `APPROVED_USERS`: Carson (8150818650), Tyler (874345067)
- Identity prefix prepended before routing: `"Message from Carson: "` / `"Message from Tyler: "` / `"Message from [name] in the War Room: "`
- For ZEUS PROTOCOL: identity goes AFTER the prefix so server routing still works: `"ZEUS PROTOCOL: Message from Carson: <text>"`

### Reply routing — two-path system

**Path 1 — Pending map (primary):**
When a Telegram message arrives, after `/request` returns `{ ok, id }`, stores `pending.set(id, { chatId, bot })`. On `request_complete`, if `pending.get(event.id)` exists, delivers immediately and deletes the entry.

**Path 2 — Channel-based routing (fallback):**
If no pending entry (restart, direct API call, etc.), `resolveDestination(channel, direct)` parses the channel string:
- `"War Room · *"` → `WAR_ROOM_CHAT_ID` via Zeus bot
- `"Telegram · Carson"` → chatId 8150818650, bot selected by `event.direct` (poseidon/hades/zeus)
- `"Telegram · Tyler"` → chatId 874345067, same bot selection
- `"dashboard"` / other → no Telegram delivery (WS only)

Both paths log which route was taken.

`sendToGrowthGrid(text)` sends Markdown to `GROWTH_GRID_CHAT_ID` via Zeus bot.

---

## WebSocket Events

All events include `id` (the request ID) for dashboard routing.

| Event              | Key Payload Fields                                                              |
|--------------------|---------------------------------------------------------------------------------|
| request_start      | id, text, channel, target, userId?, isWarRoom?, priority?                       |
| tier_classified    | id, tier (TIER_1\|TIER_2\|TIER_3)                                               |
| stage_change       | id, stage: idle\|council_initial\|execution\|council_backend\|done              |
| agent_thought      | id, agent, text                                                                 |
| agent_start        | id, agent, phase                                                                |
| agent_complete     | id, agent, phase                                                                |
| agent_error        | id, agent, phase, error (specific error message)                                |
| zeus_diagnostic    | id, agent, phase, error, diagnosis (Zeus's diagnosis of agent failure)          |
| council_message    | id, council: "initial"\|"backend", speaker, text, vote?                         |
| node_progress      | id, agent, value (0–100)                                                        |
| task_assigned      | id, agent, task (full deliverable text)                                         |
| request_complete   | id, elapsed, output, channel, tier?, direct?, councils?                         |
| mission_cancelled  | id, wasRunning, processesKilled?                                                |
| queue_update       | queue: [{ id, position, tier, userId, text, target, priority, status }]         |
| queue_reorder      | reason (Zeus's one-sentence explanation)                                        |
| gaia_message       | text, response, userId, channel, timestamp                                      |
| gaia_report        | timestamp, text                                                                 |
| gaia_retrospective | timestamp, text, missions_reviewed                                              |
| gaia_directive     | id, phase, speaker, text, timestamp                                             |
| gaia_growth        | id, target, directive?, response?, phase, timestamp                             |
| gaia_error         | id, error                                                                       |
| gaia_ssh_control   | node, command, reason, result, ok, timestamp                                    |

---

## Dashboard (OlympusDashboard.jsx)

Single file, ~3600 lines. All state is WS-driven. No external state library.

### Two worlds — fully isolated

**B3C world** (`gaiaMode === false`)
- Sidebar: Queue Panel → Mission History → Gaia Last Report
- Center: B3C pipeline view (tier1/tier2/tier3/direct)
- Input bar: B3C COUNCIL / ZEUS PROTOCOL / POSEIDON / HADES + ⚡ PRIORITY

**Gaia world** (`gaiaMode === true`, 🌿 topbar button)
- Sidebar: Conversation cards (ALL/CARSON/TYLER tabs) + Last Retrospective
- Center: TREE / CHAT / COUNCIL toggle; NEW CHAT starts fresh conversation
- Right panel: Fruit detail OR DIRECTIVES/RETROSPECTIVE/CONVERSATIONS feed
- Full forest green palette via `.mode-gaia` CSS class

### Mission state shape

```js
missions[id] = {
  id, text, channel, target, timestamp,
  status,   // "active" | "done" | "cancelled"
  stage, uiMode, tier,
  councilMessages, councilBackendMessages,
  progress: { zeus, poseidon, hades },
  nodeThoughts, nodeTasks,
  nodeStatus,   // { 'agent:phase': { status, startedAt, error } }
  stageTimes,   // { stage: timestamp } — set on stage_change receipt
  zeusDiagnostic, // null | { agent, phase, error, diagnosis }
  runStats, output, elapsed,
}
```

### Execution visibility (Tier 2 and Tier 3)

Each agent card / execution node shows live state driven by `nodeStatus['agent:execution']`:
- **ASSIGNED** — task received but `agent_start:execution` not yet seen
- **WORKING** — `agent_start:execution` received; live timer counts up from `startedAt`
- **COMPLETE** — `agent_complete:execution` received; deliverable preview shown
- **FAILED** — `agent_error:execution` received; card turns red, exact error message shown

Timers update every second by piggybacking on the 1s clock re-render (`time` state).

Council nodes show:
- Phase elapsed timer badge (from `stageTimes[stage]`)
- Blinking "■ ZEUS SPEAKING" / "■ POSEIDON REVIEWING" — from `nodeStatus['agent:council_initial'].status === 'working'`

Zeus Diagnostic section (gold panel) appears automatically below execution area when any agent fails, showing agent, phase, error, and Zeus's diagnosis. Also visible in the detail panel when clicking the failed node.

### State rehydration on refresh / reconnect

On mount: fetches `GET /missions` (history) + calls `rehydrateQueue()`.
On every WS reconnect: calls `rehydrateQueue()` again.

`rehydrateQueue`:
- Fetches `GET /queue` → sets `queueState`
- For running missions not in `missions` state → creates stub active entries

WS reconnect uses exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max. Resets to 1s on successful connection.

### Accidental close protection

`beforeunload` handler checks `queueStateRef.current` for any running/pending missions and shows browser "are you sure" warning if found. Uses a ref to avoid stale closure over queue state.

### Queue Panel (sidebar, B3C mode)
- Three pill indicators: TIER I (x/3) · TIER II (x/2) · TIER III (x/1)
- Each item: running dot or #N badge · tier badge · user label · 40-char text · ✕ cancel on hover
- Zeus reorder notification auto-dismisses after 8s

### Mission History (sidebar, B3C mode)
- Completed/cancelled: ✕ delete → `DELETE /missions/:id`, optimistic UI removal
- Active/queued: ✕ cancel → `POST /missions/:id/cancel`

### PWA / Favicon
- `dashboard/public/favicon.svg` — ⚡ on dark background
- `dashboard/public/site.webmanifest` — name: "Mount Olympus", theme: `#e8b84b`
- `index.html` — favicon, manifest, apple-touch-icon, theme-color meta

### User identity in requests

Dashboard `handleSend` prepends identity when `activeUser` badge is set:
- `CARSON` → `"Message from Carson: <text>"`
- `TYLER` → `"Message from Tyler: <text>"`
- ZEUS PROTOCOL: `"ZEUS PROTOCOL: Message from Carson: <text>"`

### Key sub-components
- `StarField` — canvas starfield background
- `CouncilThread` — chat messages with CALLING VOTE / AYE badges
- `VoteStamps` — per-agent stamp animation; UNANIMOUS banner when all three vote AYE
- `GaiaTree` — SVG Tree of Olympus with fruit ripeness, branch pulses, domain orbs
- `deriveVotes(messages)` — scans messages for vote state per agent

### Theme
Dark (`#05070f` bg), gold (`#e8b84b`), teal (`#5ee8b0`), Cinzel + JetBrains Mono fonts,
starfield canvas, grain overlay, vignette.

---

## What's Built

- Full B3C three-tier pipeline (TIER_1/2/3) with parallel execution and voting loops
- Direct agent routing (ZEUS PROTOCOL bypass + per-agent targeting)
- Mission queue with tier-based concurrency, priority system, Zeus review, and cancellation
- Queue slot released on `request_complete` event (not on pipeline promise settle)
- All four agents called via HTTP to OpenClaw completions — no SSH anywhere
- Smart tier classification: identity prefix stripped, 5 examples per tier, promotes up on uncertainty
- `callSafe` wrapper: every agent call emits `agent_start`/`agent_complete`/`agent_error`; never throws
- Partial-failure resilience: one agent failing doesn't kill parallel peers; synthesis notes gaps
- Zeus auto-diagnostic: any `agent_error` triggers Zeus diagnosis → `zeus_diagnostic` WS event
- Execution visibility: ASSIGNED / WORKING (live timer) / COMPLETE / FAILED with specific errors
- Phase timers on council nodes + speaker indicators from live `nodeStatus`
- Zeus Diagnostic gold panel — surfaces automatically on any agent failure
- React dashboard with real-time WS visualization and full mission state replay
- Node health monitoring via `/proxy/health` (CORS-safe, 10s polling)
- State rehydration on refresh + WS reconnect (`GET /queue` + stub mission entries)
- Exponential backoff WS reconnect (1s→30s max)
- Accidental close protection (`beforeunload` when missions active)
- PWA manifest + SVG favicon
- Mission history server-side persistence (`missions.json`), sidebar replay
- Mission delete: `DELETE /missions/:id`, optimistic UI
- Gaia standalone system — nightly retrospective, council communication, growth directives
- Gaia continuous conversation with full thread history
- Gaia conversation persistence (`gaia_conversations.json`)
- Gaia conversation cards (CARSON/TYLER/ALL tabs), click to load into chat
- Gaia OpenClaw WS poller (30s interval)
- Gaia mode — full palette takeover, Tree of Olympus, fruit ripeness, directives/retrospective feed
- Gaia COUNCIL mode — OLYMPUS CHANNEL two-sided thread (Gaia left/green, B3C right/gold), input routes to `/gaia/council`
- Gaia SSH CTRL domain orb pulses bright gold on `gaia_ssh_control` WS event (rapid sinusoidal pulse + expanding ring)
- Observer mesh — every B3C mission transcript posted to `/gaia/observe` after completion via direct `observeMission()` call
- Telegram bots (Zeus/Poseidon/Hades) with approved-user allowlist and War Room routing
- Two-path Telegram reply routing: pending map (primary) + channel-based fallback (survives restarts)
- Identity prefix injection for all incoming messages (Telegram + dashboard)
- Growth Grid Telegram integration (retrospectives + growth directive summaries)
- PM2 auto-restart + LaunchAgent plist

---

## What's Next

### 1. Phase 2 — DGX Spark Quorum
Add council nodes on NVIDIA DGX Spark hardware for GPU-accelerated local model inference.
Proposed members: Artemis (logic/strategy) and Apollo (creativity/art).
- Expands B3C from 3-member to 5-member quorum
- DGX Sparks run local models (Ollama or vLLM) instead of OpenClaw
- Quorum voting threshold needs updating (currently requires unanimity)
- Dashboard needs additional execution row nodes

### 2. Gaia Conversation Webhook
Rather than polling every 30s, Gaia pushes directly to `POST /gaia/message`.
Requires webhook configuration on Gaia's OpenClaw gateway.

### 3. Saxon and Sydney
Referenced in Tree of Olympus fruit definitions but not yet connected to any agent backend.
Their domains and invocation pattern TBD.
