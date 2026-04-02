/**
 * olympus-ws.js
 * Drop this file into ~/olympus/framework/
 * Then in server.js: import { initWS, broadcast } from './olympus-ws.js';
 *
 * Call initWS(server) once after you create your HTTP server.
 * Call broadcast(eventObject) anywhere in the B3C pipeline to push events
 * to all connected dashboard clients.
 *
 * Event types the dashboard understands:
 *
 *  request_start    { id, text, channel, raw }
 *  stage_change     { stage }   -- one of: hermes | council_initial | execution | council_backend | done
 *  prompt_refined   { text }
 *  agent_thought    { agent, text }   -- agent: hermes | zeus | poseidon | hades
 *  council_message  { council, speaker, text, vote? }  -- council: initial | backend, vote: calling|aye|approve
 *  node_progress    { agent, value }  -- value 0-100
 *  task_assigned    { agent, task }
 *  request_complete { id, elapsed, tokens, councils }
 *  gaia_report      { timestamp, text }
 */

import { WebSocketServer } from 'ws';

let wss = null;
const subscribers = new Set();

// ── Ring buffer for replay on reconnect ──────────────────────────────────────
const RING_SIZE = 50;
const ringBuffer = [];

function ringPush(event) {
  ringBuffer.push(event);
  if (ringBuffer.length > RING_SIZE) ringBuffer.shift();
}

export function subscribe(fn)   { subscribers.add(fn); }
export function unsubscribe(fn) { subscribers.delete(fn); }

export function initWS(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Dashboard connected from ${ip}`);

    // Replay recent events so late-joining clients catch up
    for (const evt of ringBuffer) {
      try { ws.send(JSON.stringify(evt)); } catch {}
    }

    ws.on('close', () => {
      console.log(`[WS] Dashboard disconnected from ${ip}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error from ${ip}:`, err.message);
    });
  });

  console.log('[WS] Dashboard WebSocket server ready on /live');
}

export function broadcast(event) {
  // Send to WS clients FIRST — before internal subscribers fire.
  //
  // Why: internal subscribers (queue slot release) call releaseSlot → drainQueue
  // → startMission → broadcast(...) re-entrantly. Those nested broadcasts also
  // send to WS clients. If subscribers ran first, the outer event (e.g.
  // request_complete) would reach the dashboard AFTER the nested events from
  // the next mission (request_start, queue_update), causing ordering issues and
  // in some cases losing the outer event under buffer pressure.
  //
  // With WS delivery first: every event reaches the dashboard synchronously
  // before any downstream effects (slot release, new mission start) run.
  ringPush(event);
  if (wss) {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === 1) { // OPEN
        client.send(payload);
      }
    }
  }

  // Internal subscribers (Telegram routing, slot release) fire after WS delivery.
  for (const fn of subscribers) {
    try { fn(event); } catch (e) { console.error('[WS] subscriber error:', e.message); }
  }
}
