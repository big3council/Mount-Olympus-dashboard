# Dashboard — Source of Truth

**Canonical location:** `/Users/zeus/olympus/dashboard/` on **Zeus** (Tailscale IP `100.78.126.27`).

**Git remote:** `git@github.com:big3council/Mount-Olympus-dashboard.git`

All dashboard development happens here, on Zeus, in this directory. This is
the only machine where the dashboard is built, tested, and deployed.

## SSH access

```bash
ssh zeus
cd /Users/zeus/olympus/dashboard
```

## Build & run

```bash
npx vite build      # production bundle → dist/
npx vite --host     # dev server (port 3000)
```

The production dashboard runs under PM2 as `olympus-dashboard` on port 3000:

```bash
pm2 list
pm2 restart olympus-dashboard
pm2 logs olympus-dashboard
```

## Do NOT do development from a laptop checkout

Cloning this repo to a laptop and editing there is a trap. The cluster state
(PM2 processes, ports, node IPs, framework services) only exists on Zeus.
Edits made elsewhere drift from the running system and create divergence.

If you must read the source from somewhere else, use:

```bash
ssh zeus "cat /Users/zeus/olympus/dashboard/src/<file>"
```

Or SCP down, but treat it as read-only.

## Structure (post-decomposition)

```
src/
├── OlympusDashboard.jsx      — main component (~2,488 lines)
├── styles.js                  — extracted CSS
├── utils/
│   ├── constants.js           — API URLs, config, maps, gaiaCondense
│   └── treeHelpers.js         — bezier math, tree positioning
├── components/
│   ├── StarField.jsx
│   ├── VoteStamps.jsx
│   ├── CouncilThread.jsx      — with Gaia summarization
│   ├── SummarizedBlock.jsx
│   ├── CouncilTriangle.jsx
│   ├── GaiaTree.jsx           — canvas tree visualization
│   └── FruitDetailContent.jsx
├── CouncilChamber.jsx         — idle/classifying view
├── FlywheelView.jsx           — flywheel jobs dashboard
└── OlympusView.jsx            — olympus domains overview
```
