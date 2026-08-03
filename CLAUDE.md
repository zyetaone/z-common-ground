# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read [`AGENTS.md`](./AGENTS.md) first — it is the source of truth for AI assistants here** (architecture, conventions, gotchas, out-of-scope). [`README.md`](./README.md) covers the product/session flow and full route+API tables. This file is only the fast-start layer; don't duplicate those two.

## What this is

**Common Ground — Phygital**: a facilitated in-person boardroom game. Physical function boards + one room QR → players pick table → role → seat board where they place **chips** across a **7×7 matrix** (7 seats × 7 priorities). A presenter deck reveals the analysis screens. **One session only** (hard-coded code `LIVE`) — no multi-room, no host-a-session step; the home page *is* the join QR.

**Chip economy (Option D):** physical chips 🔴 $10M · 🔵 $5M · 🟢 $2M (6 red + 4 blue + 10 green = **$100M/table**, room = $700M). Board cells store **value in $M** (`TOKEN_VALUE_USD = $1M`, so a cell of 40 = $40M). The app does NOT track chips by colour — it tracks value; the physical chips enforce the colour mix. Selection is a chip tray (pick red/blue/green) + per-row `±` that place/remove the active chip's value.

## Commands (Bun, not npm)

```bash
bun install
bun run dev            # http://localhost:5173
bun run check          # svelte-kit sync + svelte-check — THE ONLY quality gate, keep green
bun run test           # vitest (only src/lib/game/rules/rules.test.ts exists today)
bun run build          # SvelteKit → .svelte-kit/cloudflare
wrangler deploy        # Cloudflare Worker
wrangler secret put FAL_API_KEY   # optional: enables the finale room render
```

No CI. After changes, run `bun run check` and smoke-test the flow: `/` → `/play/LIVE` (table→role→board) → `/present/LIVE`.

## Architecture in one breath

`+layout` calls `useSession()` → global runes in `src/lib/state/session.svelte.ts`, which **polls `/api/room/*` ~1s** (HTTP, not WebSockets) and issues mutations. The server keeps a **single in-memory `LIVE` room** (`src/lib/server/store.ts`) — ephemeral, so rooms vanish on redeploy or across isolates (documented gap; D1/Durable Object is the production upgrade path).

File-kind discipline is load-bearing — match it when adding code:

| Kind | Extension / location | Holds |
|------|----------------------|-------|
| UI | `.svelte` in `components/` | markup + styles, presentational only |
| State | `.svelte.ts` in `state/` (co-located when screen-specific) | `$state` runes + actions |
| Domain | plain `.ts` in `game/` | pure logic — **no DOM, no fetch** |
| Server | `.ts` in `server/` | store, fal/llama AI, secrets — Worker-only |

Import `session` / `play` / `present` / `host` from `$lib/state`.

## Things that will bite you

- **No vision/camera path.** Tokens are entered by hand on phones; do not reintroduce photo board-reading without an explicit product ask.
- **`boardDelta` fails silently** — returns `200` as a no-op if phase ≠ `round`, the table is locked, or indices are bad. Don't assume `200` means the token landed; read state back.
- **Render needs a key.** Without `FAL_API_KEY`/`FAL_KEY`, `POST /api/ai/room-concept` returns `url: null` by design — handle the empty state, don't treat it as an error.
- **Evolution screen needs history.** Presenter screen 2 (R2/R3/R5) only populates after those rounds have board data *and* the host has advanced past them.
- **Don't invent extra presenter analytics.** The deck is exactly 4 screens (see AGENTS.md); keep the derived-lens vocabulary (alignment · fault line · blind spot · surprise · Common Ground Index) stable.

## Sibling context

Scoring/analytics/fal patterns are shared with [`../poc`](../poc) (the full digital game). Product language lives in `../CORE-IDEA.md` and `../GAME-DESIGN.md`.
