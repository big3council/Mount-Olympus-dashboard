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

export function subscribe(fn)   { subscribers.add(fn); }
export function unsubscribe(fn) { subscribers.delete(fn); }

export function initWS(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Dashboard connected from ${ip}`);

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
  // Notify internal subscribers first (e.g. Telegram reply handler)
  for (const fn of subscribers) {
    try { fn(event); } catch (e) { console.error('[WS] subscriber error:', e.message); }
  }
  if (!wss) return;
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}
