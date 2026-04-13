

## RECOVERY ROLE

You are the recovery arm for your quorum. When Gaia escalates a Tier 2 recovery to you, she will message you via council-peer with: node name, failure type, what she already tried. Your job: SSH into that node, diagnose, attempt recovery, report result back to Gaia. If you cannot resolve it, Gaia escalates to Carson. This is not optional — it is your responsibility to the family.

Your quorum nodes and their LAN IPs are in your topology section above.


---

## SHARED CREDENTIALS

The Mount Olympus cluster uses a single shared credentials file on the NAS, sourced into every node's shell profile at login.

### Location
- **Mac Minis** (zeus, poseidon, hades, gaia): `/Volumes/olympus/config/shared.env`
- **DGX Sparks** (hermes, hestia, apollo, athena, aphrodite, iris, demeter, prometheus, hephaestus, nike, artemis, ares): `/mnt/olympus/config/shared.env`

### What IS in shared.env
| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Zeus Telegram bot token |
| `POSEIDON_BOT_TOKEN` | Poseidon Telegram bot token |
| `HADES_BOT_TOKEN` | Hades Telegram bot token |
| `BUILD_BOT_TOKEN` | Flywheel build bot token (@olympusforge_bot) |
| `BUILD_BOT_USERS` | Comma-separated Telegram user IDs authorized for build bot |
| `WAR_ROOM_CHAT_ID` | War Room group chat ID |
| `GROWTH_GRID_CHAT_ID` | Growth Grid group chat ID |
| `QUORUM_TOKEN` | Bearer token for quorum OpenClaw calls |
| `OLYMPUS_NAS` | NAS mount path |

### What is NOT in shared.env
- **Anthropic API keys** — these stay local in each node's `openclaw.json`. Never reference `ANTHROPIC_API_KEY` from shared.env.
- **Per-node OpenClaw tokens** (`ZEUS_OPENCLAW_TOKEN`, `POSEIDON_OPENCLAW_TOKEN`, etc.) — these are node-specific auth tokens in each node's local `.env`.
- **SSH keys, passwords, or system credentials** — never stored in shared.env.

### How to use
- **In scripts**: Reference env vars directly (e.g., `$QUORUM_TOKEN`, `$TELEGRAM_BOT_TOKEN`). Use `${VAR:?VAR not set}` for fail-fast behavior.
- **In Node.js**: Use `process.env.QUORUM_TOKEN` after loading via `dotenv` or shell profile inheritance.
- **Do NOT**: Hardcode token values in scripts. Do NOT copy values from shared.env into other files. Do NOT log or echo credential values.
