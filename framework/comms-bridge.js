/**
 * comms-bridge.js — Supabase Realtime listener for Elvis + Six → MO
 *
 * Subscribes to mo_comms INSERT events on both Carson and Tyler Supabase
 * projects. Routes inbound messages through existing MO infrastructure
 * (OpenClaw agents via agentCalls.js, flywheel for forge channel).
 *
 * Shared channels (war_room, growth_grid) write results to BOTH projects.
 */

import { createClient } from '@supabase/supabase-js';
import { callZeus, callPoseidon, callHades, callGaia } from './agentCalls.js';

const log = (...args) => console.log('[COMMS-BRIDGE]', new Date().toISOString(), ...args);

// ── Supabase clients ──────────────────────────────────────────────────────────

let carsonClient = null;
let tylerClient = null;

const FLYWHEEL_URL = 'http://127.0.0.1:18780/flywheel';

// Channel → agent routing
const CHANNEL_ROUTES = {
  poseidon: { call: callPoseidon, label: 'Poseidon (192.168.1.12:18789)' },
  hades:    { call: callHades,    label: 'Hades (192.168.1.13:18789)' },
  gaia:     { call: callGaia,     label: 'Gaia (192.168.1.14:18789)' },
  zeus:     { call: callZeus,     label: 'Zeus (localhost:18789)' },
  // war_room routes to Zeus, growth_grid routes to Gaia
  war_room:     { call: callZeus, label: 'Zeus (localhost:18789)', shared: true },
  growth_grid:  { call: callGaia, label: 'Gaia (192.168.1.14:18789)', shared: true },
};

// ── Supabase row helpers ──────────────────────────────────────────────────────

async function updateRow(client, id, updates) {
  const { error } = await client.from('mo_comms').update(updates).eq('id', id);
  if (error) log('updateRow error:', error.message);
}

// ── Forge channel — create flywheel job + wake Zeus ───────────────────────────

async function handleForge(client, projectLabel, row) {
  const { id, body, from_agent } = row;
  log(`Forge job from ${from_agent}: ${body.slice(0, 50)}`);

  try {
    // Mark processing
    await updateRow(client, id, { status: 'processing', picked_up_at: new Date().toISOString() });

    // Create flywheel job
    const jobResp = await fetch(`${FLYWHEEL_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: body.split('\n')[0].slice(0, 80),
        description: body,
        submitter: from_agent,
        routing_class: 'pending_classification',
      }),
    });

    if (!jobResp.ok) {
      const errText = await jobResp.text();
      throw new Error(`create job ${jobResp.status}: ${errText}`);
    }

    const job = await jobResp.json();
    log('Forge job created:', job.id);

    // Wake Zeus — fire and forget (Zeus handles delivery)
    fetch(`${FLYWHEEL_URL}/wake-zeus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.id, prompt: body }),
    }).catch(err => log('wake-zeus error:', err.message));

    // Mark delivered with job reference
    await updateRow(client, id, {
      status: 'delivered',
      result: `Flywheel job created: ${job.id}`,
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

    // Call the agent
    const result = await route.call(body);
    log(`Result from ${channel} (${result.length} chars)`);

    // Mark delivered on source project
    await updateRow(client, id, {
      status: 'delivered',
      result,
      delivered_at: new Date().toISOString(),
    });
    log(`Delivered result to ${projectLabel} project`);

    // Shared channel logic — write to the OTHER project
    if (route.shared) {
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
