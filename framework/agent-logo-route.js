/**
 * agent-logo-route.js — Serve agent logos from NAS
 *
 * Mount into existing Express server on Zeus:18780:
 *   const logoRoute = require('./agent-logo-route.js');
 *   app.use(logoRoute);
 *
 * Serves: GET /agents/:name/logo.svg
 * Source: /Volumes/olympus/agents/{name}/logo.svg
 * Fallback: emoji-in-circle SVG for agents without custom logos
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const NAS_AGENTS = process.env.NAS_PATH 
  ? path.join(process.env.NAS_PATH, 'agents')
  : '/Volumes/olympus/agents';

const AGENT_EMOJI = {
  zeus: '⚡', poseidon: '🔱', hades: '🔨', gaia: '🌿',
  hermes: '✉️', athena: '🔭', apollo: '📖', hestia: '🕯️',
  aphrodite: '🪞', iris: '🌈', demeter: '⚖️', prometheus: '🔥',
  hephaestus: '⚒️', nike: '🏆', artemis: '🏹', ares: '⚔️',
};

const AGENT_COLORS = {
  zeus: '#7B68EE', poseidon: '#00BCD4', hades: '#78909C', gaia: '#66BB6A',
  hermes: '#4FC3F7', athena: '#B39DDB', apollo: '#FFD54F', hestia: '#FF8A65',
  aphrodite: '#F48FB1', iris: '#CE93D8', demeter: '#A5D6A7', prometheus: '#FF7043',
  hephaestus: '#8D6E63', nike: '#FFB300', artemis: '#4DB6AC', ares: '#E53935',
};

router.get('/agents/:name/logo.svg', (req, res) => {
  const name = req.params.name.toLowerCase();
  const logoPath = path.join(NAS_AGENTS, name, 'logo.svg');

  if (fs.existsSync(logoPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(logoPath);
  }

  // Fallback: emoji-in-circle SVG
  const emoji = AGENT_EMOJI[name] || '⚡';
  const color = AGENT_COLORS[name] || '#78909C';

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="${color}" opacity="0.2"/>
  <circle cx="32" cy="32" r="30" fill="none" stroke="${color}" stroke-width="1"/>
  <text x="32" y="44" font-size="28" text-anchor="middle">${emoji}</text>
</svg>`);
});

export default router;
