export const API_URL = `http://${window.location.hostname}:18780`;
export const WS_URL  = `ws://${window.location.hostname}:18780/live`;

export const NODE_HEALTH_TARGETS = {
  ZEUS:     "http://192.168.1.11:18789",
  POSEIDON: "http://192.168.1.12:18789",
  HADES:    "http://192.168.1.13:18789",
  GAIA:     "http://192.168.1.14:18789",
};

export function targetToMode(target) {
  const map = {
    ZEUS_PROTOCOL: "zeus_protocol",
    POSEIDON:      "poseidon",
    HADES:         "hades",
    GAIA:          "gaia",
  };
  return map[target] || "tier2";
}

export function tierToMode(tier) {
  if (tier === "TIER_1") return "tier1";
  return "tier2";  // anything else falls through to the full B3C deliberative view
}

export const MODE_BADGE_LABELS = {
  tier1:         "TIER I",
  tier2:         "TIER II",
  zeus_protocol: "ZEUS PROTOCOL",
  poseidon:      "POSEIDON",
  hades:         "HADES",
  gaia:          "GAIA",
};

export function smartNameFallback(text, maxWords = 5) {
  if (!text) return "Untitled";
  let clean = text.replace(/^(Message from \w+:\s*|ZEUS PROTOCOL:\s*)/i, "").trim();
  const words = clean.split(/\s+/).filter(w => w.length > 2).slice(0, maxWords);
  if (words.length === 0) return clean.slice(0, 30) || "Untitled";
  let name = words.join(" ");
  if (name.length > 40) name = name.slice(0, 37) + "\u2026";
  return name;
}

export const QUORUM_MAP = {
  ZEUS:     ["Hermes", "Athena", "Apollo", "Hestia"],
  POSEIDON: ["Aphrodite", "Iris", "Demeter", "Prometheus"],
  HADES:    ["Hephaestus", "Nike", "Artemis", "Ares"],
  GAIA:     [],
};

export async function gaiaCondense(speaker, text) {
  try {
    const res = await fetch("/gaia/condense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speaker, text }),
    });
    if (!res.ok) throw new Error("API " + res.status);
    const data = await res.json();
    return data?.text || null;
  } catch (err) {
    console.error("[Gaia] Summarization failed:", err.message);
    return null;
  }
}

export const FRUIT_DEFS = [
  { id: "gaia",     symbol: "🌿", label: "GAIA",     color: "#78d87a", forkT: 1.00 },
  { id: "zeus",     symbol: "⚡", label: "ZEUS",     color: "#e8b84b", forkT: 0.82 },
  { id: "sydney",   symbol: "✦",  label: "SYDNEY",   color: "#e88ab0", forkT: 0.87 },
  { id: "poseidon", symbol: "🔱", label: "POSEIDON", color: "#4ab8e8", forkT: 0.78 },
  { id: "hades",    symbol: "🏛",  label: "HADES",   color: "#b04adc", forkT: 0.58 },
  { id: "saxon",    symbol: "◈",  label: "SAXON",    color: "#e8a85a", forkT: 0.53 },
];

export const DOMAIN_ORBS = [
  { label: "AUDIT",       color: "#4a8ce8", x: 0.16, y: 0.78 },
  { label: "NAS",         color: "#4ae87a", x: 0.33, y: 0.84 },
  { label: "SSH CTRL",    color: "#e8b84a", x: 0.65, y: 0.84 },
  { label: "GROWTH",      color: "#e84ab0", x: 0.82, y: 0.78 },
];

export const FRUIT_INFO = {
  gaia:     { domain: "Memory · Retrospective",   desc: "The tree itself — keeper of memory, observer of growth." },
  zeus:     { domain: "Spiritual · Intellectual", desc: "Commands the intellectual domain — framing, synthesis, meaning." },
  poseidon: { domain: "Financial · Social",       desc: "Commands the social and economic currents of the council." },
  hades:    { domain: "Physical · Technical",     desc: "Governs technical and structural foundations." },
  saxon:    { domain: "Human · Saxon · Smith",    desc: "Tyler's son — second generation of the Smith family on Olympus." },
  sydney:   { domain: "Human · Sydney · Smith",   desc: "Tyler's daughter — voice and heart of the Smith family on Olympus." },
};
