/**
 * comms-bridge.js — Supabase Realtime listener for Elvis + Six → MO
 *
 * Subscribes to mo_comms INSERT events on both Carson and Tyler Supabase
 * projects. Routes inbound messages through existing MO infrastructure
 * (OpenClaw agents via agentCalls.js, flywheel for forge channel).
 *
 * Shared channels (war_room, growth_grid) write results to BOTH projects
 * AND deliver to the corresponding Telegram group channel.
 */

import { createClient } from '@supabase/supabase-js';
import { callZeus, callPoseidon, callHades, callGaia } from './agentCalls.js';

const log = (...args) => console.log('[COMMS-BRIDGE]', new Date().toISOString(), ...args);

// ── Supabase clients ──────────────────────────────────────────────────────────

let carsonClient = null;
let tylerClient = null;

const FLYWHEEL_URL = 'http://127.0.0.1:18780/flywheel';
const REQUEST_URL  = 'http://127.0.0.1:18780/request';  // unified pipeline (Phase 7 cutover)

// ── Telegram group delivery ───────────────────────────────────────────────────

const TELEGRAM_GROUP_CHANNELS = {
  war_room:     { envKey: 'WAR_ROOM_CHAT_ID',     label: 'War Room' },
  growth_grid:  { envKey: 'GROWTH_GRID_CHAT_ID',   label: 'Growth Grid' },
};

async function sendTelegramGroup(channel, from_agent, result) {
  const groupCfg = TELEGRAM_GROUP_CHANNELS[channel];
  if (!groupCfg) return;

  const chatId = process.env[groupCfg.envKey];
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!chatId || !botToken) {
    log(`Telegram group delivery skipped — missing ${!chatId ? groupCfg.envKey : 'TELEGRAM_BOT_TOKEN'}`);
    return;
  }

  const prefix = `[${from_agent} → ${groupCfg.label}]`;
  const text = `${prefix}\n\n${result}`;

  // Telegram max message length is 4096 chars — chunk if needed
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.slice(i, i + 4000));
  }

  for (const chunk of chunks) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      });
      if (!resp.ok) {
        const err = await resp.text().catch(() => '');
        log(`Telegram group send error (${groupCfg.label}):`, resp.status, err.slice(0, 100));
      }
    } catch (err) {
      log(`Telegram group send failed (${groupCfg.label}):`, err.message);
    }
  }

  log(`Telegram delivered to ${groupCfg.label} group`);
}

// Channel → agent routing
const CHANNEL_ROUTES = {
  poseidon: { call: callPoseidon, label: 'Poseidon (192.168.1.12:18789)' },
  hades:    { call: callHades,    label: 'Hades (192.168.1.13:18789)' },
  gaia:     { call: callGaia,     label: 'Gaia (192.168.1.14:18789)' },
  zeus:     { call: callZeus,     label: 'Zeus (localhost:18789)' },
  // war_room routes to Zeus, growth_grid routes to Gaia — both are shared channels
  war_room:     { call: callZeus, label: 'Zeus (localhost:18789)', shared: true },
  growth_grid:  { call: callGaia, label: 'Gaia (192.168.1.14:18789)', shared: true },
};

// ── Agent context wrapper ─────────────────────────────────────────────────────
// Wraps the raw body with sender identity so agents know who is asking
// and that the message is authorized through the comms bridge.

function wrapWithContext(from_agent, channel, body) {
  return [
    `[Comms Bridge — Authorized message from ${from_agent}]`,
    `Channel: ${channel}`,
    `Sender: ${from_agent} (authorized agent, routed via MO comms bridge)`,
    '',
    body,
  ].join('\n');
}

// ── Supabase row helpers ──────────────────────────────────────────────────────

async function updateRow(client, id, updates) {
  const { error } = await client.from('mo_comms').update(updates).eq('id', id);
  if (error) log('updateRow error:', error.message);
}

// ── Forge channel — create flywheel job + wake Zeus ───────────────────────────
// NOTE: Forge does NOT pass chat_id to wake-zeus. The flywheel pipeline
// (zeus-handler.js) will skip Telegram delivery when chat_id is absent.
// This prevents duplicate delivery — the bridge writes the result to mo_comms
// and the flywheel handles its own delivery if chat_id was provided.

async function handleForge(client, projectLabel, row) {
  const { id, body, from_agent } = row;
  log(`Forge job from ${from_agent}: ${body.slice(0, 50)}`);

  try {
    // Mark processing
    await updateRow(client, id, { status: 'processing', picked_up_at: new Date().toISOString() });

    // Phase 7 cutover: forge channel routes to the unified pipeline (POST /request)
    // instead of legacy /flywheel/jobs. Zeus classifies T1 vs T2 and runs the
    // appropriate B3C flow. Result lands in framework mission store; Telegram
    // group delivery (if any) is handled by the unified pipeline itself.
    const reqResp = await fetch(REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:    body,
        channel: `forge · ${from_agent}`,
        target:  'zeus',
      }),
    });

    if (!reqResp.ok) {
      const errText = await reqResp.text();
      throw new Error(`create request ${reqResp.status}: ${errText}`);
    }

    const req = await reqResp.json();
    log('Forge request created:', req.id);

    // Mark delivered with request reference. The unified pipeline runs async;
    // result will be streamed to the dashboard via WebSocket and delivered to
    // the appropriate channel on completion.
    await updateRow(client, id, {
      status: 'delivered',
      result: `Unified-pipeline request created: ${req.id}`,
      delivered_at: new Date().toISOString(),
    });

  } catch (err) {
    log('Forge error:', err.message);
    await updateRow(client, id, { status: 'failed', error: err.message });
  }
}

// ── Main message handler ──────────────────────────────────────────────────────

async function handleMessage(client, projectLabel, row) {
  const { id, channel, body, from_agent } = row;

  log(`Incoming: ${from_agent} → ${channel}: ${body.slice(0, 50)}`);

  // Forge gets special handling
  if (channel === 'forge') {
    return handleForge(client, projectLabel, row);
  }

  const route = CHANNEL_ROUTES[channel];
  if (!route) {
    log(`Unknown channel: ${channel}`);
    await updateRow(client, id, { status: 'failed', error: `Unknown channel: ${channel}` });
    return;
  }

  try {
    // Mark processing
    await updateRow(client, id, { status: 'processing', picked_up_at: new Date().toISOString() });
    log(`Routed to ${route.label}`);

    // Call the agent with context-wrapped message
    const wrappedBody = wrapWithContext(from_agent, channel, body);
    const result = await route.call(wrappedBody);
    log(`Result from ${channel} (${result.length} chars)`);

    // Mark delivered on source project
    await updateRow(client, id, {
      status: 'delivered',
      result,
      delivered_at: new Date().toISOString(),
    });
    log(`Delivered result to ${projectLabel} project`);

    // Shared channel logic — write to OTHER project + deliver to Telegram group
    if (route.shared) {
      // Telegram group delivery
      await sendTelegramGroup(channel, from_agent, result);

      // Write to the other Supabase project
      const otherClient = client === carsonClient ? tylerClient : carsonClient;
      const otherLabel = client === carsonClient ? 'Tyler' : 'Carson';

      if (otherClient) {
        const { error } = await otherClient.from('mo_comms').insert({
          channel,
          direction: 'outbound',
          from_agent,
          body,
          result,
          thread_id: row.thread_id || null,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        });
        if (error) {
          log(`Shared write to ${otherLabel} failed:`, error.message);
        } else {
          log(`Shared result written to ${otherLabel} project`);
        }
      }
    }

  } catch (err) {
    log(`Error processing ${channel}:`, err.message);
    await updateRow(client, id, { status: 'failed', error: err.message });
  }
}

// ── Subscribe to a project's mo_comms ─────────────────────────────────────────

function subscribeToProject(client, projectLabel) {
  const channel = client
    .channel(`mo_comms_${projectLabel.toLowerCase()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mo_comms',
        filter: 'direction=eq.inbound',
      },
      (payload) => {
        const row = payload.new;
        if (row.status !== 'pending') return; // only process pending
        handleMessage(client, projectLabel, row).catch(err => {
          log(`Unhandled error (${projectLabel}):`, err.message);
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        log(`Connected to ${projectLabel} project`);
      } else if (status === 'CHANNEL_ERROR') {
        log(`Channel error on ${projectLabel} — will reconnect automatically`);
      } else if (status === 'TIMED_OUT') {
        log(`Subscription timed out on ${projectLabel} — retrying`);
      }
    });

  return channel;
}

// ── writeToComms — outbound from MO to agents ────────────────────────────────

export async function writeToComms(project, channel, body, threadId = null) {
  const client = project === 'tyler' ? tylerClient : carsonClient;
  if (!client) {
    log(`writeToComms: no client for project ${project}`);
    return null;
  }

  const { data, error } = await client.from('mo_comms').insert({
    channel,
    direction: 'outbound',
    from_agent: 'mount_olympus',
    body,
    thread_id: threadId,
    status: 'delivered',
    delivered_at: new Date().toISOString(),
  }).select('id').single();

  if (error) {
    log(`writeToComms error (${project}):`, error.message);
    return null;
  }

  log(`Outbound written to ${project}/${channel}: ${body.slice(0, 50)}`);
  return data.id;
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initCommsBridge() {
  const carsonUrl = process.env.COMMS_CARSON_SUPABASE_URL;
  const carsonKey = process.env.COMMS_CARSON_SUPABASE_KEY;
  const tylerUrl  = process.env.COMMS_TYLER_SUPABASE_URL;
  const tylerKey  = process.env.COMMS_TYLER_SUPABASE_KEY;

  if (!carsonUrl || !carsonKey) {
    log('Carson Supabase credentials missing — bridge disabled');
    return;
  }

  carsonClient = createClient(carsonUrl, carsonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  subscribeToProject(carsonClient, 'Carson');
  log('Carson subscription initialized');

  if (tylerUrl && tylerKey) {
    tylerClient = createClient(tylerUrl, tylerKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    subscribeToProject(tylerClient, 'Tyler');
    log('Tyler subscription initialized');
  } else {
    log('Tyler Supabase credentials missing — Tyler subscription disabled');
  }
}
