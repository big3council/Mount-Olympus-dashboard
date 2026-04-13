/**
 * direct.js — Direct agent routing (no council)
 *
 * Used for:
 *   - ZEUS PROTOCOL prefix → Zeus only
 *   - Messages targeted at Poseidon or Hades directly
 *   (Gaia has her own standalone system in gaia.js)
 */

import { broadcast } from './olympus-ws.js';
import { callZeus, callPoseidon, callHades } from './gateway.js';

const AGENTS = {
  zeus:     { call: callZeus },
  poseidon: { call: callPoseidon },
  hades:    { call: callHades },
};

export async function runDirect(agentName, requestId, text, channel, userId = null) {
  const start = Date.now();
  console.log(`[Direct] ${agentName} → id=${requestId}`);

  broadcast({ type: 'agent_thought', id: requestId, agent: agentName, text: 'Processing...' });

  try {
    const agent = AGENTS[agentName];
    if (!agent) throw new Error(`Unknown agent: ${agentName}`);

    const response = await agent.call(text, requestId);

    broadcast({
      type:    'request_complete',
      id:      requestId,
      elapsed: Date.now() - start,
      output:  response,
      channel,
      direct:  agentName,
      ...(userId != null ? { userId: String(userId) } : {}),
    });

    console.log(`[Direct] ${agentName} complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return response;
  } catch (err) {
    console.error(`[Direct] ${agentName} error:`, err.message);
    throw err;
  }
}
