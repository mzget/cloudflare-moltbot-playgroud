# Project: Retro 2D Pokemon Game Dashboard for Database Agent Tab

## Architecture
The application is a full-stack investment / database intelligence dashboard.
- **Backend**: Cloudflare Worker running in Node.js compatibility mode. Built with Hono framework, exposing endpoints like /database-chat, /chat, /api/test-market-stats, /api/crawl, etc., and interacting with Cloudflare D1 (SQLite) and R2 storage buckets.
- **Frontend**: Astro framework UI using React. The single-page application is styled using **MUI Joy UI** with **sx props** (strictly no Tailwind).
- **Tab Component**: rontend/src/components/features/agent/DatabaseChat.tsx will be refactored into the retro 2D Pokemon-style game dashboard, loading interactive assets (sprite sheets/PokeAPI sprites, Web Audio API synth, canvas map engine).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite | Build E2E test harness for the game components, backend mock, and UI interactions (Tiers 1-4) | none | IN_PROGRESS (Conv ID: a09b2577-9f22-4917-8a81-a4890aa5fcab) |
| 2 | Canvas Tilemap Engine & Movement | Implement the 2D HTML5 canvas, grid collision, movement, WASD/Arrow controls, mobile D-Pad, and Pokemon sprite rendering | none | IN_PROGRESS (Conv ID: 8e420c66-c809-4adc-9217-e24c9163589e) |
| 3 | NPC Dialogs & Chat Integration | Implement Professor Oak (Database Agent) and Sage (Oaktree Knowledge Agent) NPCs with typewriter text stream and bottom input panel | M2 | PLANNED |
| 4 | D1 wild encounters & SQL battles | Procedurally map D1 tables to wild Pokemon, trigger retro battle screen, FIGHT menu (run SQL), BAG (R2 list), RUN, and query HP damage | M2, M3 | PLANNED |
| 5 | Safari Zone (Jobs) & AI Lab | Implement fenced Safari Zone for the 8 Scheduled Jobs, hovering HUD, TRIGGER battle execution. AI Lab building with 3 NPCs | M2, M3 | PLANNED |
| 6 | Styling, Audio Synth & Final Polishing | Retro double borders, scanlines, Web Audio synth (mute toggle), SFX, chiptunes, and integration | M3, M4, M5 | PLANNED |
| 7 | Adversarial Hardening (Tier 5) | White-box coverage analysis, corner cases, and adversarial test case generation | M1, M6 | PLANNED |

## Interface Contracts
### Frontend ? Backend
- /database-chat: POST { message: string }, returns text stream.
- /chat: POST { message: string }, returns text stream.
- /api/test-market-stats & /api/...: GET/POST, returns job response.
- /api/query (or direct D1 execution): POST { sql: string }, returns D1 rows or error.

## Code Layout
- rontend/src/components/features/agent/DatabaseChat.tsx: Entrypoint for the Database Agent tab.
- rontend/src/components/features/agent/game/: Sub-folder for tilemap, collision, sprites, combat system, audio synthesizer.
- ackend/src/index.ts: Backend routing, D1/R2 bindings, Workers AI tasks.
