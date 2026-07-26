# Repository Guidelines

> Source of truth for any AI assistant working in this repo. Keep aligned with `README.md` and actual `src/`.

## Project overview

**Common Ground — Phygital** (`phygital`): facilitated in-person boardroom game.

- **One session only** (`LIVE`) — no multi-room
- Physical boards + **one room QR** → table → role → seat board (place chips 🔴 $10M · 🔵 $5M · 🟢 $2M, $100M/table)
- **5 rounds** (`ROUND_COUNT=5`) · unlocks default **R2 · R3 · R5** · presenter **5 screens**
- Svelte 5 runes + Tailwind 4 · keep it simple
- fal: `FAL_API_KEY` (same as z-corenet `.env`)

Deploy: Cloudflare Worker via `@sveltejs/adapter-cloudflare`.

## Architecture

```
  +layout → useSession() → session.svelte.ts (global runes)
                                │ poll + mutations
                                ▼
                         /api/room/*  →  server store (single LIVE)
```

### Component architecture (Svelte 5)

| Kind | Extension | Holds |
|------|-----------|--------|
| **UI** | `.svelte` | Markup, styles, presentational only |
| **State** | `.svelte.ts` | Runes (`$state`) + actions |
| **Domain** | `.ts` | Pure logic (no DOM, no fetch) — `game/` |
| **Server** | `.ts` under `server/` | Store, fal, secrets |

```
src/lib/
  state/                 # global .svelte.ts  → import from '$lib/state'
    session.svelte.ts    # LIVE room + poll + mutations
    play.svelte.ts       # join table/role
    present.svelte.ts    # analysis deck screen
    host.svelte.ts       # host form fields
  components/
    present/
      FutureWorkspace.svelte
      future.svelte.ts   # co-located UI state for that screen
    phone/
      SeatBoard.svelte
  game/                  # pure .ts domain
  server/                # Worker-only
```

Import `session` / `play` / `present` / `host` from `$lib/state`.

### Round loop

1. `/` shows join QR (session auto-ensured in layout)
2. `/play/LIVE` → table → role → board
3. Host optional: `/host/LIVE`
4. Presenter `/present/LIVE` · Next through 4 dashboards

## Key paths

| Path | Purpose |
|------|---------|
| `src/lib/state/*.svelte.ts` | **Global runes state** |
| `src/lib/server/store.ts` | Single LIVE room mutations |
| `src/lib/server/ai/fal.ts` | fal.ai (ZyetaI) |
| `src/lib/game/*` | Domain: types, scoring, brief, money |
| `src/lib/components/phone/SeatBoard.svelte` | Per-role ± tokens |
| `src/lib/components/present/*` | Analysis screens + StageNav |
| `src/routes/play/` | Join + seat board |
| `src/routes/present/` | Analysis deck + QR print |
| `src/routes/table/[code]/[table]/` | SPOC board |
| `src/routes/api/ai/finale/` | Generate workspace image |

## Presenter screens (do not invent extra analytics)

1. **Room at a glance** — all tables · combined portrait  
2. **Priority evolution** — R2 · R3 · R5 + who broke the pattern  
3. **Winners & losers** — per function top vs weakest  
4. **Future workplace** — %-weighted brief (openable) + single room render  

## Commands

```bash
bun install
bun run dev
bun run check          # only quality gate — keep green
bun run build
wrangler deploy
wrangler secret put FAL_API_KEY
```

No test suite / CI in-repo. Smoke-test host → table → present after changes.

## Conventions

- Bun, not npm. Svelte **5 runes** only (`$props`, `$derived`, `$state`, `$effect`).
- Tabs, semicolons, single quotes. `$lib/...` imports; `import type` for types.
- Pure domain in `src/lib/game/*` — no fetch/IO.
- Store returns `RoomState | undefined` → handlers `error(404)` when missing.
- `boardDelta` is a silent no-op (still `200`) if phase ≠ `round`, table locked, or bad indices.

## Gotchas

1. **No vision.** Do not reintroduce capture/photo paths without an explicit product ask.
2. **Ephemeral store.** Rooms vanish on redeploy / multi-isolate drift.
3. **Phones show round number only** — scenario copy is host/presenter side.
4. **Render needs key.** Without `FAL_API_KEY` / `FAL_KEY`, finale returns `url: null`.
5. **History needs rounds.** Evolution R2/R3/R5 only populates after those rounds have board data and advances.

## Out of scope here

AI CEO voice, clap-o-meter, Act 2 notes, per-colour chip inventory enforcement (app tracks value only; physical chips enforce the 6/4/10 mix), multi-render gallery (single render is intentional v1).
