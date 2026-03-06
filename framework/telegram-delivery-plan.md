# Telegram Delivery Plan
**Branch:** `feature/telegram-delivery`
**Files changed:** `telegram.js`, `b3c.js`, `direct.js`, `gaia.js`, `queue.js`

---

## 1. Current State and What's Broken

### What works today
- **Telegram DM from Carson/Tyler → reply to their DM:** Working via Path 1 (pending map). When a Telegram bot receives a message, it calls `POST /request`, gets `{ ok, id }` back, and stores `pending.set(id, { chatId, bot })`. When `request_complete` fires, Path 1 finds the entry and delivers to the exact chatId. This works.
- **War Room group message → reply to War Room:** Also Path 1. `chatId` stored is the War Room group ID, so the reply goes back to the group. This works.
- **Growth Grid delivery (Gaia retrospectives, growth directives):** Working. Uses `sendToGrowthGrid()` independently of the routing system.

### What's broken

#### Bug 1: Dashboard missions never deliver to Telegram (critical)
`request_complete` events emitted by `b3c.js` and `direct.js` do **not** include `userId`:

```js
// b3c.js runTier1 — no userId
broadcast({ type: 'request_complete', id: requestId, elapsed, output: response, channel, tier: 'TIER_1' });

// direct.js — no userId
broadcast({ type: 'request_complete', id: requestId, elapsed, output, channel, direct: agentName });
```

Path 2 in `telegram.js` is the fallback for dashboard-originated missions. It checks:
```js
const userId = event.userId ? Number(event.userId) : null;
const userName = userId ? APPROVED_USERS.get(userId) : null;
if (!userName) return;  // ← always fires for dashboard missions
```

Because `userId` is never in the event, Path 2 always returns without delivering. **Dashboard missions (Carson active, Tyler active) never reach Telegram.** This is the primary bug.

The `userId` *is* available inside `runB3C()` and `runTier1/2/3()` — it's accepted as a parameter — but it's never forwarded into the `request_complete` broadcast.

Similarly, `runDirect()` in `direct.js` doesn't even accept `userId` as a parameter (it's not passed from `queue.js`).

And `runDirectGaia()` in `gaia.js` accepts `userId` but doesn't include it in the `request_complete` broadcast either.

#### Bug 2: Long messages silently fail or get rejected
Telegram's hard limit is **4096 characters** per message. B3C Tier 2 and Tier 3 responses (full synthesis from three agents) routinely exceed this — often 5,000–12,000+ characters. The current `sendReply` makes a single `bot.sendMessage()` call with the full text. Telegram will reject messages over 4096 chars with a `400 Bad Request: message is too long` error. The fallback (plain text retry) will also fail. The delivery silently drops.

#### Bug 3: `initTelegram` has no deduplication guard
If `initTelegram()` were called more than once (e.g., during a hot-reload or future refactor), it would re-add bots to `activeBots` (overwriting), leaving the old polling instances orphaned and running. There's currently no protection. While PM2 restarts the whole process (not just re-calling `initTelegram`), this is a correctness hazard worth hardening.

### What does NOT need changing
- **War Room path via pending map (Path 1):** Works correctly. `chatId` stored is the group ID; reply goes to the group. No DM to the individual sender is needed (and not requested).
- **Bot selection logic:** Bot chosen by `event.direct` field (poseidon → Poseidon bot, hades → Hades bot, otherwise Zeus bot). Correct.
- **server.js:** No changes needed. `userId` is already correctly passed through `/request` → `enqueue()` → `runB3C()`.
- **Dashboard delivery:** Already works — `request_complete` broadcast IS the dashboard delivery via WebSocket. The dashboard receives every event regardless.

---

## 2. Delivery Matrix — Target Behavior

| Origin | userId in /request | channel string | Expected Telegram delivery |
|---|---|---|---|
| Dashboard, Carson active | `"8150818650"` | `"dashboard"` | Carson's DM (8150818650) via appropriate bot |
| Dashboard, Tyler active | `"874345067"` | `"dashboard"` | Tyler's DM (874345067) via appropriate bot |
| Dashboard, no activeUser | `null`/`undefined` | `"dashboard"` | None (unknown user — cannot route) |
| Telegram DM, Carson → Zeus bot | `"8150818650"` | `"Telegram · Carson"` | Carson's DM via Zeus bot (Path 1) |
| Telegram DM, Carson → Poseidon bot | `"8150818650"` | `"Telegram · Carson"` | Carson's DM via Poseidon bot (Path 1) |
| Telegram DM, Carson → Hades bot | `"8150818650"` | `"Telegram · Carson"` | Carson's DM via Hades bot (Path 1) |
| Telegram DM, Tyler → any bot | `"874345067"` | `"Telegram · Tyler"` | Tyler's DM via matching bot (Path 1) |
| War Room, Carson | `"8150818650"` | `"War Room · Carson"` | War Room group (-1003880853076) via Zeus bot (Path 1) |
| War Room, Tyler | `"874345067"` | `"War Room · Tyler"` | War Room group (-1003880853076) via Zeus bot (Path 1) |

Every mission also delivers to dashboard (WS `request_complete` event) regardless of origin — this already works and needs no changes.

---

## 3. Proposed Implementation

### Change 1: `b3c.js` — Add `userId` to all `request_complete` broadcasts

Three locations need updating: `runTier1`, `runTier2`, `runTier3`. Each already receives `userId` as a function parameter. Add it to the broadcast with a guard for null:

```js
// runTier1 (currently line ~112)
broadcast({
  type: 'request_complete',
  id: requestId, elapsed, output: response, channel, tier: 'TIER_1',
  ...(userId != null ? { userId: String(userId) } : {}),
});

// runTier2 (currently line ~243)
broadcast({
  type: 'request_complete',
  id: requestId, elapsed: t2Elapsed, output: synthesis, channel, tier: 'TIER_2', councils: 2,
  ...(userId != null ? { userId: String(userId) } : {}),
});

// runTier3 (currently line ~565)
broadcast({
  type: 'request_complete',
  id: requestId, elapsed: t3Elapsed, output: finalOutput, channel, tier: 'TIER_3', councils: 2,
  ...(userId != null ? { userId: String(userId) } : {}),
});
```

### Change 2: `direct.js` — Accept and forward `userId`

`runDirect` currently has signature `(agentName, requestId, text, channel)`. Add `userId = null`:

```js
// Before
export async function runDirect(agentName, requestId, text, channel) {

// After
export async function runDirect(agentName, requestId, text, channel, userId = null) {
```

Add to the `request_complete` broadcast:
```js
broadcast({
  type:    'request_complete',
  id:      requestId,
  elapsed: Date.now() - start,
  output:  response,
  channel,
  direct:  agentName,
  ...(userId != null ? { userId: String(userId) } : {}),
});
```

### Change 3: `gaia.js` — Add `userId` to `request_complete` in `runDirectGaia`

`runDirectGaia` already accepts `userId`. Add it to the broadcast (currently line ~375):

```js
// Before
broadcast({ type: 'request_complete', id: requestId, elapsed, output: response, channel, direct: 'gaia' });

// After
broadcast({
  type: 'request_complete',
  id: requestId, elapsed, output: response, channel, direct: 'gaia',
  ...(userId != null ? { userId: String(userId) } : {}),
});
```

### Change 4: `queue.js` — Pass `userId` to `runDirect()` calls

Three `runDirect` calls in `startMission` currently omit `userId` (lines ~195–202):

```js
// Before
promise = runDirect('poseidon', id, text, channel);
promise = runDirect('hades', id, text, channel);
// ZEUS PROTOCOL:
promise = runDirect('zeus', id, stripped, channel);

// After
promise = runDirect('poseidon', id, text, channel, userId ?? null);
promise = runDirect('hades', id, text, channel, userId ?? null);
// ZEUS PROTOCOL:
promise = runDirect('zeus', id, stripped, channel, userId ?? null);
```

`userId` is already destructured from `mission` at the top of `startMission` — no new destructuring needed.

### Change 5: `telegram.js` — Message splitting, dedup guard

#### 5a. Add `splitMessage` helper

Telegram hard limit: 4096 chars. Use 4000 as the safe split point to leave margin for Markdown formatting overhead.

```js
const TG_LIMIT = 4096;
const TG_SAFE  = 4000;

function splitMessage(text) {
  if (text.length <= TG_LIMIT) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > TG_LIMIT) {
    let splitAt = remaining.lastIndexOf('\n\n', TG_SAFE);
    if (splitAt < 200) splitAt = remaining.lastIndexOf('\n', TG_SAFE);
    if (splitAt < 200) splitAt = TG_SAFE;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
```

Split logic priority:
1. Last `\n\n` (paragraph boundary) before position 4000 — cleanest break
2. Last `\n` (line boundary) before position 4000 — acceptable break
3. Hard split at 4000 — last resort for single very long lines

The `200` floor on `splitAt` prevents degenerate cases where the last newline is too early in the string.

#### 5b. Add `sendChunked` helper

```js
async function sendChunked(bot, chatId, text) {
  const chunks = splitMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 500));
    await sendReply(bot, chatId, chunks[i]);
  }
}
```

The 500ms delay between chunks respects Telegram's practical rate limit of ~1 message/second to the same chat. `sendReply` handles the Markdown → plain text fallback per chunk.

#### 5c. Update `routeComplete` to use `sendChunked`

Replace `sendReply(...)` calls in `routeComplete` with `sendChunked(...).catch(e => console.error(...))`. Both Path 1 and Path 2 need this.

```js
// Path 1
sendChunked(entry.bot, entry.chatId, output).catch(e =>
  console.error('[Telegram] Path 1 delivery failed:', e.message)
);

// Path 2 — DM
sendChunked(bot, userId, output).catch(e =>
  console.error('[Telegram] Path 2 DM delivery failed:', e.message)
);

// Path 2 — War Room
sendChunked(wrBot, warRoomId, output).catch(e =>
  console.error('[Telegram] Path 2 War Room delivery failed:', e.message)
);
```

`sendReply` stays unchanged — it's still used for short, known-safe messages (Growth Grid, error alerts, war room error fallback).

#### 5d. Add deduplication guard to `initTelegram`

```js
export function initTelegram() {
  if (activeBots.size > 0) {
    console.warn('[Telegram] initTelegram called again — already initialized, skipping');
    return;
  }
  // ... rest of existing code
}
```

---

## 4. Edge Cases

| Case | Handling |
|---|---|
| Single paragraph > 4096 chars | Hard split at 4000. Chunk may be mid-sentence. Acceptable — full content is preserved across chunks. |
| Response is empty string | `routeComplete` already checks `if (!output) return` at the top. No change needed. |
| Bot token not configured | `activeBots.get(botName)` returns undefined; fallback chain `?? activeBots.get('zeus') ?? [...activeBots.values()][0]` handles it. No change needed. |
| No userId in event (old dashboard without activeUser) | `userId` is null → `userName` lookup returns null → Path 2 returns early. Correct — no delivery if user unknown. |
| Dashboard sends userId as number vs string | `request_complete` stringifies userId with `String(userId)`. `routeComplete` converts back with `Number(event.userId)`. Consistent with existing behavior. |
| War Room message + framework restart | Path 1 is gone (pending map cleared). Path 2 fires: delivers to user DM AND War Room group (because `isWarRoom` is true). Delivers to both — more than required (req says War Room only), but acceptable as a restart-recovery fallback. |
| Chunk 2 of a long message fails | Each chunk is fire-and-forget inside `sendChunked`. If chunk 2 fails (e.g. rate limit), it logs and stops. Chunk 1 was already sent. Partial delivery is better than no delivery. |
| `sendChunked` called for Growth Grid | Not called. `sendToGrowthGrid` already truncates at 900 chars before calling `sendMessage`. No change needed there. |
| Gaia direct response via dashboard | Fixed by Change 3 (gaia.js). userId included → Path 2 delivers to user's DM. |
| ZEUS PROTOCOL from Telegram DM | Path 1 still handles it (pending map set in bot.on message handler). No change needed. |
| ZEUS PROTOCOL from dashboard | queue.js strips prefix and calls `runDirect('zeus', id, stripped, channel, userId)` → Change 4 ensures userId propagates. |

---

## 5. Files Changed Summary

| File | Change | Why |
|---|---|---|
| `framework/b3c.js` | Add `userId` to `request_complete` broadcast in `runTier1`, `runTier2`, `runTier3` | Enables Path 2 routing for dashboard missions |
| `framework/direct.js` | Add `userId = null` param to `runDirect`, add to `request_complete` | Enables Path 2 routing for direct (POSEIDON/HADES/ZEUS PROTOCOL) dashboard missions |
| `framework/gaia.js` | Add `userId` to `request_complete` in `runDirectGaia` | Enables Telegram delivery for Gaia responses from dashboard |
| `framework/queue.js` | Pass `userId` to all three `runDirect()` calls | Without this, direct.js Change 2 has no data to work with |
| `framework/telegram.js` | Add `splitMessage`, `sendChunked`; update `routeComplete`; add dedup guard | Fixes long-message failures; hardens against duplicate init |

---

## 6. What Is NOT Changed

- `server.js` — already passes `userId` from request body through `enqueue()`. No change.
- `olympus-ws.js` — no change. WS events are already broadcast correctly.
- `queue.js` enqueue logic — `userId` already flows into B3C correctly. Only the `runDirect` call sites need updating.
- Telegram bot message handler (`bot.on('message', ...)`) — Path 1 works correctly. No change.
- `resolveDestination()` — becomes effectively unused (Path 2 now uses direct userId lookup, not channel string parsing). Left in place for now — it does no harm, and removing it is a separate cleanup concern.
- `OlympusDashboard.jsx` — no changes. Dashboard already sends `userId` in the request body when `activeUser` is set.

---

## 7. Testing After Implementation

1. **Restart framework:** `pm2 restart olympus-framework`

2. **Dashboard → DM delivery:**
   - Open dashboard, set CARSON active user
   - Send a message (B3C, Tier 1 or 2)
   - Verify: response appears on dashboard AND in Carson's Zeus bot DM

3. **Dashboard → DM (direct agent):**
   - Set CARSON active user, target POSEIDON
   - Verify: response appears in Carson's Poseidon bot DM

4. **Telegram DM → DM reply:**
   - Send a message to Zeus bot from Carson's account
   - Verify: reply comes back via Zeus bot

5. **War Room → War Room reply:**
   - Send a message to War Room group
   - Verify: reply goes back to the group, NOT to Carson's DM

6. **Long message test:**
   - Send a complex TIER_3 request from dashboard (Carson active)
   - Verify: response arrives in multiple Telegram messages if > 4096 chars
   - Verify: each chunk is readable, no failed delivery in pm2 logs

7. **pm2 logs check:**
   - `pm2 logs olympus-framework --lines 50`
   - Should see: `[Telegram] Reply via pending map` or `[Telegram] Reply via userId`
   - Should NOT see: `Failed to send reply` or `message is too long`
