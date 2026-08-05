# Repository Guidelines

> Source of truth for any AI assistant working in this repo. Keep aligned with `README.md`, `CLAUDE.md`, and `src/`. All claims below are evidence-backed; treat code as authoritative when prose disagrees.

## Start here — the 5-minute reading path

This doc is **~310 KB, 24 top-level sections, 129 sub-sections, 156 gotchas across 6 numbering systems (main 1–32, A1–A18 architecture, U1–U18 UX flow, F1–F9 polish, F1–F16 failure modes, S1–S8 strategy disclosure)**. The user has built it incrementally across many passes.

| # | Section | Why | Time |
|---|---|---|---|
| 1 | [Project overview](#project-overview) + [Methodology](#how-we-find-common-ground-the-methodology) | What the product *is*. The CGI / lead / fault / blind vocabulary. | 3 min |
| 2 | [Architecture & data flow](#architecture--data-flow) | The runtime shape: Worker + D1 + polling client. | 3 min |
| 3 | [Key directories](#key-directories) | Where the code lives. | 3 min |
| 4 | [Server: store + endpoints](#server-store--endpoints) | The mutation contract. What every endpoint does and returns. | 4 min |
| 5 | [Domain: game rules, scoring, brief](#domain-game-rules-scoring-brief) | The pure functions in `src/lib/game/`. What `roomInsights`, `aggregate`, `verdicts`, `surpriseToken` actually compute. | 6 min |
| 6 | [Code conventions & common patterns](#code-conventions--common-patterns) | Svelte 5 idioms, file-kind discipline, error handling, browser-only code. | 5 min |

**Total: ~25 minutes for a working understanding.** If you only have 5 minutes, read rows 1, 2, and 3 — the *what*, the *where*, the *how it talks together*. The rest is detail.

After the first 25 minutes, **read by need, not in order**. The doc's other top-level sections, in priority order:

| Touching the … | Read |
|---|---|
| **presenter / host / phone UI** (most common) | [UX deep review](#ux-deep-review--flows-gamification-analysis-surface) → [UI/UX system design](#uiux-system-design-fonts-motion-gamification-svelte-5) → [Mobile page state machine](#mobile-page-state-machine) → [Presenter page state machine](#presenter-page-state-machine) → [**FunctionBoard deep review**](#functionboard-deep-review--the-chip-tap-ux) (if touching the chip-tap interaction). |
| **function-board refactor / chip-tap polish** | [FunctionBoard refactored — the drop-in](#functionboard-refactored--the-drop-in) — the full ~330-line drop-in component. |
| **AI /  RapidI / fal prompts** | [AI integration](#ai-integration-review--recommendations) → the *Prompts as data, not code* subsection → the *Wiring & shrunken plumbing* code blocks. |
| **server / store / D1 / idempotency** | [Server: store + endpoints](#server-store--endpoints) → [Architecture & idempotency](#architecture--idempotency-the-runtime-contract). |
| **scoring / analysis / CGI hero / chord diagram / strategy disclosure** | [Domain: game rules, scoring, brief](#domain-game-rules-scoring-brief) → [Analysis: the Common Ground story](#analysis-the-common-ground-story) → [**Strategy disclosure + per-round constraints**](#strategy-disclosure--per-round-constraints--the-strategy-of-addition-or-protection) (data flow A–G, **Visual flow** mock-ups, the *protected* / *contested* lists). |
| **adding a new endpoint** | [API design constraints](#api-design-constraints) (in *Server: store + endpoints*) → the *Idempotency-Key pattern* in [Architecture & idempotency](#e-idempotency-end-to-end--the-contract). |
| **something is broken in production at 11pm** | [Failure modes & ops runbook](#failure-modes--ops-runbook) — F1–F16 with the runbook-on-a-card. |
| **what's planned, in what order, by when** | [Master plan](#master-plan--12-weeks-11-milestones-1-release) — 12 weeks, 11 milestones, 1 release. |
| **any specific term in the codebase** | [Glossary](#glossary) — alphabetical, A–Z, ~120 terms. |

### The single most important rule

**Treat code as authoritative; treat this doc as the spec.** When the two disagree, the code is right and the doc is stale. **Edit the doc to match the code in the same PR** that changes the code. The doc is a living document, not a one-shot write.

### The two things to read before touching anything

1. **The user-flow audit** ([UX deep review §A](#a-the-five-user-flows-audited)). It maps the home page, the phone, the host, the presenter, and the post-game. **Read it before adding a feature** — most "missing features" are already specified in there.
2. **The gotchas list** ([Gotchas](#gotchas), [A1–A18](#g-new-gotchas-architecture--idempotency), [U1–U18](#h-new-ux-flow-gotchas-u1u18), [F1–F9](#new-gotchas-chip-tap-polish-f1f9), [F1–F16](#failure-modes--ops-runbook)). The F1–F9 *and* F1–F16 use the same number prefix by accident — **always cite the section**, never just "F1". It is the institutional memory of every footgun the codebase has. **A 2-minute scan will save you an afternoon.**

### A third rule (often missed)

**The doc proposes a lot more than it ships.** Most of the drop-ins in this doc are *specs*, not shipped code. **Check the [Important files](#important-files) table** to see what's actually in the repo. Sections marked *proposed* or *refactor target* in their headers are not in the code yet. Use them as a planning artifact, not as a reference.

## Project overview

**Common Ground — Phygital** (`phygital`): a facilitated, in-person boardroom game running as a single Cloudflare Worker. The name is the prompt: each function places real $M against workplace priorities across 5 rounds, the app finds the **Common Ground** — where the functions agree — and shows the **fault** (where they don't) and the **blind** (what the room overlooked).

### How we find Common Ground (the methodology)

The presenter deck is the proof of a single thesis: **the room converges on a leadership story, then we render it.** The pipeline:

1. **Stake** — 7 functions × up to $100M of 7-priority vectors → 7×7 portrait per table.
2. **Aggregate** — `aggregate(tables, personaBias)` builds the room-wide `matrix` (sum of $M per priority), `reach` (how many functions back each priority), and **Common Ground Index** = mean pairwise cosine similarity between function vectors (100 = every function bets the same shape, 0 = total divergence, undefined when fewer than 2 functions are active).
3. **Lens** — `verdicts(matrix, reach, fns)` returns:
   - `lead` = the priority the **most** functions rallied behind (reach tiebreak by $)
   - `fault` = the priority with the **greatest variance** across functions (skipping the lead) — the real divide
   - `blind` = the least-funded priority — what the room collectively overlooked
4. **Surprise** — `surpriseToken(fns, bias)` flags a function that put ≥25% of its money on an *off-type* (low-bias) priority. `undefined` when nobody broke type — that's an honest "no surprise" outcome, not a failure.
5. **Narrate** — RapidI turns the numbers into an executive brief; fal renders a 16:9 visualisation that *exponentially* weights floorplate/materials/focal moments by the % mix.
6. **Celebrate** — phones export a 1200×630 LinkedIn frame with `#WeFoundCommonGround` + their function lens.

### What's in the app

- **One session only.** `SESSION = 'LIVE'` in `src/lib/server/store.ts` and re-exported from `src/lib/state/session.svelte.ts`. Every `+server.ts` ignores the route's `[code]` parameter. No multi-room routing — the `[code]` segments are vestigial.
- **One room, 7 function tables, 5 rounds.** Physical boards + per-table QRs (printed from `/present/LIVE/qrs`) → `/play/LIVE/{tableId}` → `FunctionBoard` (cumulative place/remove $10M tokens across 7 priorities).
- **5 rounds** (`ROUND_COUNT=5`). Capture seal on **R2 · R3 · R5**; R3 is **remove-only** (`move: 'remove'`); R1 (`mode: 'wait'`) and R4 (`mode: 'hold'`) save without sealing. See `SCENARIOS` in `src/lib/game/config.ts`.
- **Presenter deck = 5 screens**, in this exact order (from `DECK_SCREENS` in `src/lib/game/brief.ts`; `present.svelte.ts` derives `TOTAL = DECK_SCREENS.length`):
  1. **Seat Matrix** — `RoomGlance` (strip + `PortraitMatrix`)
  2. **Priority Breakdown** — `PriorityBreakdown`
  3. **How the room evolved** — `RoundInsights`
  4. **What each function did** — `PrioritiesSummary`
  5. **Per function** — `FunctionPriorities`
  - Concept renders and the architectural set live on their own routes: `/present/LIVE/look` and `/present/LIVE/design`. `FutureWorkspace` (the ZyetaI design studio) is reachable from there, not from the 5-screen counter.
- **7 personas, one table per persona** (`PERSONAS[]` in `src/lib/game/config.ts`; `tableId` 1–7 maps to seat index `tableId - 1` via `tableSeatIndex`). Current source order (this is the binding truth; README is stale):
  1. **Real Estate** (`#E0A458`, lens *"Optimise portfolio & reduce footprint"*)
  2. **HR** (`#E0665A`, *"Optimise people & employee engagement"*)
  3. **IT** (`#3FB6A2`, *"Optimise technology & AI adoption"*)
  4. **Finance** (`#5AA9E6`, *"Optimise cost & commercial discipline"*)
  5. **Operations** (`#7E8CE0`, *"Optimise resilience & execution speed"*)
  6. **Marketing** (`#E574B0`, *"Optimise brand & employer proposition"*)
  7. **C-Suite** (`#C9A227`, *"Optimise enterprise value & growth"*)
  - **Note:** `app.css` defines `--color-seat0`..`--color-seat6` with colors that **don't match** the persona order (e.g. `--color-seat0: #e0a458` matches Real Estate, but `--color-seat5: #c9a227` matches C-Suite, not Marketing). Components use `persona.color` directly, not the seat tokens — the seat tokens are dead code but worth noting if you reach for them. **See [Branding] below for the proposed fix.**
- **Tokens store $M value** (`TOKEN_VALUE_USD = 1_000_000`); the only physical chip is a single red **$10M** (`CHIP_VALUE = 10`, `CHIP_DENOMS = [{ red, value: 10 }]`). **Cell store ≠ chip inventory** — physical chips enforce the 6/4/10 mix; the app tracks value only.
- Svelte 5 runes + Tailwind v4. Image generation is branded **"AI powered by ZyetaI"**. Deploy target: `@sveltejs/adapter-cloudflare` on `common-ground-phygital`.
- Single LIVE room persisted as one JSON blob in D1 row `LIVE` (binding `common_ground_db`).

## Branding

The app is "Classic green felt · serif · minimal" (see `app.css` line 3). The brand surface is currently thin: a "COMMON GROUND" wordmark in Playfair, a teal/gold/red palette, and a 10px "AI · ZyetaI" attribution chip. The favicon is the **default Svelte logo** (orange "S") — wrong for a boardroom app and should be replaced first.

### Brand identity (proposed)

- **Name:** "Common Ground" (wordmark, all caps in the wordmark, mixed case in copy).
- **Tagline:** *"Imagine the future of the workplace."* — already the brief's working title (`finalePrompt`, `buildEnhancedBrief`, `FutureBrief.svelte`).
- **AI attribution:** "ZyetaI" — Zyeta's AI for interior strategy. Stays as a small monospace pill; do not over-brand.
- **Hashtag:** `#WeFoundCommonGround` (used in `linkedInShareText` and the LinkedIn frame header).

### Brand palette (current → recommended)

| Token | Current `app.css` | Recommended | Use |
|---|---|---|---|
| `--color-bg` / `--color-panel` | `#FDF8ED` (cream) | keep | page background, panels |
| `--color-ink` | `#111A14` (near-black) | keep | body text |
| `--color-muted` | `#5A6A5E` (sage grey) | keep | secondary text |
| `--color-line` | `#C8BFA0` (sand) | keep | dividers |
| `--color-gold` | `#B8932E` | keep — Zyeta gold | primary action, focus, accents |
| `--color-teal` | `#1F8B78` | keep — Zyeta teal | confirmed actions, "open", "live" |
| `--color-red` | `#C9403A` | keep | danger, blind spot, R3 |
| `--color-on-gold` / `--color-on-teal` | `#FFFFFF` | keep | text on solid fills |

**Persona palette** (these are the brand colors that show on the table identity and need to match the seat tokens; see [Branding fix] below):

| Seat (tableId) | Persona | Hex | Use |
|---|---|---|---|
| 0 | Real Estate | `#E0A458` (amber) | board accent, ring in future render |
| 1 | HR | `#E0665A` (coral) | same |
| 2 | IT | `#3FB6A2` (teal) | same |
| 3 | Finance | `#5AA9E6` (sky) | same |
| 4 | Operations | `#7E8CE0` (periwinkle) | same |
| 5 | Marketing | `#E574B0` (pink) | same |
| 6 | C-Suite | `#C9A227` (gold) | same |

### Branding fix — apply when you want to make this consistent

```css
/* src/app.css — replace the seat tokens with the real persona palette */
--color-seat0: #E0A458;  /* Real Estate */
--color-seat1: #E0665A;  /* HR */
--color-seat2: #3FB6A2;  /* IT */
--color-seat3: #5AA9E6;  /* Finance */
--color-seat4: #7E8CE0;  /* Operations */
--color-seat5: #E574B0;  /* Marketing */
--color-seat6: #C9A227;  /* C-Suite */
```
A working drop-in for option 1 (replace the contents of `src/lib/assets/favicon.svg`). The favicon is rendered at 16-32 px so the design is *paths only* (no font dependency — the system font may not be loaded when the favicon paints):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Common Ground">
  <rect width="64" height="64" rx="12" fill="#FDF8ED"/>
  <!-- "C" (teal) — outer arc, opens right -->
  <path d="M48 22 a16 16 0 1 0 0 20" stroke="#1F8B78" stroke-width="7" fill="none" stroke-linecap="round"/>
  <!-- "G" (gold) — full ring with a small bar inwards (the "tongue") -->
  <path d="M22 22 a10 10 0 1 1 -0.4 17.5" stroke="#B8932E" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M22 32 h6 v3" stroke="#B8932E" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>
```

Update `src/app.html` if you want a different rel (`<link rel="icon" type="image/svg+xml" href={favicon}>` is already correct; only the file contents change). The same SVG can be inlined into the LinkedIn frame header (`linkedin-frame.ts`) to brand the share image.

## Architecture & data flow

```
+layout.svelte ── onMount ──► session.boot()
                                   │
   poll /api/room/LIVE/state @500ms (serialized pollChain)
                                   ▼
                        session.svelte.ts  (global runes)
                          │     poll + mutations + AI actions
                          ▼
                /api/room/*  /api/ai/*  (SvelteKit +server.ts)
                          │
                          ▼
   live.ts  (withLiveRoom: per-isolate mutex → sync → mutate → CAS persist; 409 after 3 tries)
                          │
                          ▼
   store.ts  (singleton Store, in-process; D1 is authoritative)
                          │
                          ▼
   game/rules/*  (phase FSM, board rules — mutate room in place)
   game/scoring.ts (aggregate, CGI, verdicts, insights, winners/losers)
   game/brief.ts   (mix, %-weighted fal prompt, rapidi facts, spatial program)
```

- The Worker holds an in-process `Store` singleton; D1 is the cross-colo authority. `withLiveRoom(fn)` = `store.sync(db)` → `fn()` → `store.persist(db)`. Last-write-wins on the JSON blob (`INSERT … ON CONFLICT(id) DO UPDATE`).
- The client is pure runes + `fetch`. There is **no SSE/WebSocket path**; clients poll at `INTERVAL = 500` ms (`src/lib/state/session.svelte.ts`) and replace the whole `RoomState` on every update via `$state.raw` reference swap. `advance` and `retreat` schedule a `setTimeout(poll, 200)` so multi-isolate caches settle after the phase change.
- Domain writes return `boolean` or a tagged `{ ok, error }`; submit failures are HTTP 400. Some invalid board mutations (e.g. `boardDelta` with bad chip value, locked table, wrong seat) are intentional **silent no-ops that still return a 200 snapshot** with the unchanged room.
- API handlers are thin: `await request.json()` → `withLiveRoom(() => store.x(...))` → `json()` / `error(400|404)`. The `code` param in every `+server.ts` is ignored. AI endpoints 400 when `aggregate.totalCoins <= 0`.
- **No `+page.ts` / `+page.server.ts` / `load` / `form action` / `hooks.server.ts` / `error.svelte` modules** — SSR renders connecting/placeholder UI and the browser takes over via `session.boot()`.
- The live stage (`/present/LIVE`) shows a **submissions grid** during `phase === 'round'` (sub-card per table: ✓ Submitted or Open / Editing / Waiting) and a "tables scan QR" hero during `lobby`; it always links out to the deck. The deck lives at **`/presenter/analysis`** and gates on `isRevealable` (`phase ∈ {reveal, finale} || analysisForced`). Its `#key present.screen` directive remounts the active `.pane` on screen change so transitions re-trigger.

## Key directories

| Path | Purpose |
|---|---|
| `src/lib/game/` | Pure domain (`$lib/game` barrel: `types`, `config`, `scoring`, `brief`, `money`, `rules`). `index.ts` re-exports from each. `types.ts` defines `PRIORITIES`, `TableState`, `Aggregate`, `RoundSnapshot`, `RoomState`, `Persona`, `Scenario`, `Phase`, `RoundMove`, `RoundMode`. `config.ts` holds `PERSONAS`, `PRIORITY_COLORS`, `ROUND_COUNT=5`, `EVOLUTION_ROUNDS = CAPTURE_ROUNDS = [2,3,5]`, `DEFAULT_TABLE_COUNT=7`, `DEFAULT_ROOM_BOUNTY_TOKENS=700`, `DEFAULT_TABLE_BOUNTY_TOKENS=100`, `CHIP_DENOMS`, `CHIP_VALUE=10`, `SPACE`, `DESIGN_LONG`, `DESIGN_SHORT`, `SCENARIOS`. `rules/` is `phase.ts` (FSM) + `board.ts` (mutations). |
| `src/lib/state/` | Global runes (`$lib/state` barrel). `session.svelte.ts` (LIVE room + poll + mutations + AI actions; `SESSION` export), `present.svelte.ts` (deck index, `TOTAL = DECK_SCREENS.length`), `host.svelte.ts` (form drafts, `syncOnce` / `resync`). (`play.svelte.ts` was deleted — table comes from the URL.) |
| `src/lib/server/` | Worker-only. `store.ts` (singleton Store; exports `SESSION = 'LIVE'`, `store`, `currentScenario`), `room-store.ts` (D1 row `LIVE` JSON blob, `ensureSchema` is per-isolate), `live.ts` (request-scoped D1 binding, `withLiveRoom`, `readLiveRoom`), `ai/rapidi.ts` + `ai/fal.ts` (thin wrappers over `ai/prompts/`), `ai/prompts/` (the brand voice, renderers, and registry — see [AI integration]). |
| `src/lib/components/phone/` | Mobile gameplay (barrel `phone/index.ts`): `FunctionBoard.svelte` (cumulative add/remove, cap, chip pile + row flash), `MobileHeader`, `MobileBoardForm`, `MobileWaitStage`, `MobileSealed`, `MobileFinale`, `MobileRender` (selfie + LinkedIn frame), `ConvictionBars`. |
| `src/lib/actions/` | Svelte 5 `use:*` attachments. **Shipped:** `confetti.ts` (chip scatter on seal), `count-up.ts` (animated `$` amounts). The `ripple` / `chipDrop` / `longPress` / `audio` / `haptic` actions described later in this doc are **proposed, not built**. |
| `src/lib/components/present/` | Analysis deck (barrel `present/index.ts`): `RoomGlance`, `PriorityBreakdown`, `RoundInsights`, `PrioritiesSummary`, `FunctionPriorities`, `StageNav`, plus the concept/design surfaces `FutureWorkspace`, `WorkspaceDesignStudio`, `ArchitecturalBriefReport`, `ArchitecturePresentation`, `ConceptLayoutSheet`, `FunctionProfileSheet`, `ZyetaIGenerating`. Co-located `future.svelte.ts` (UI-only state) is exported as `futureUi`. |
| `src/lib/components/host/` | Host console panels: `HostGameConfig.svelte` (persona/scenario editor), `HostPhotos.svelte` (generated-image gallery). |
| `src/lib/components/analytics/` | Reusable visualisations (barrel `analytics/index.ts`): `PortraitMatrix` only. `PriorityConstellation`, `ReachIntensityQuadrant`, and `Headlines` were deleted — later sections of this doc that reference them are stale plan text. |
| `src/lib/components/` (root) | Primitives: `Button` (renders `<a>` when `href` given, else `<button>`), `Chip` (SVG poker chip), `Modal` (native `<dialog>` w/ `$bindable` `open`), `QrCode` (mounted async, `qrcode.toDataURL` with green-on-cream), `Icon` (inline SVG), `BoardSheet` (printable SVG with QR), `ExpandImage`, `ZyetaI` (attribution). |
| `src/lib/client/` | Browser-only helpers (no Svelte). `linkedin-frame.ts` (1200×630 canvas composite, `linkedInShareText`, `openLinkedInShare`, `downloadLinkedInFrame`), `present-labels.ts` (advance/retreat labels). (The deprecated `index.ts` re-export of `$lib/state` has been removed — import from `$lib/state`.) |
| `src/lib/index.ts` | Thin barrel: re-exports `game/types.js`, `game/config.js`, `game/scoring.js`. **Not** a general `$lib` entry. |
| `src/lib/assets/` | `favicon.svg` — the `CG` monogram brand mark (the default Svelte logo has been replaced). |
| `src/routes/` | Pages. `+layout.svelte` calls `session.boot()`; no `+page.ts`/`+page.server.ts` exist. |
| `src/routes/api/` | HTTP surface. `room/[code]/...` and `ai/{brief,brief-edit,compose-brief,room-concept,table-render,workspace-design}` — `[code]` is decorative. (`ai/finale` was split into `ai/room-concept` + `ai/compose-brief`.) |

## Routes

| Route | Role |
|---|---|
| `/` | Join-QR directory for the 7 function tables; admin links (Presenter, Host, Table Directory). |
| `/play/[code]/` | Table directory; `?table=1..7` deep links set the player state (`play.pickTable`) and `goto` to `/play/{SESSION}/{fromQuery}`. |
| `/play/[code]/[table]/` | Mobile gameplay. See "Mobile page state machine" below. |
| `/play/[code]/[table]/[seat]/` | Legacy seat URL → redirects into `/play/{SESSION}/{table}`. |
| `/present/[code]/` | Presenter live stage (lobby / submissions grid / advance). Links to the deck. See "Presenter pages state machine" below. |
| `/presenter/analysis/` | The 5-screen analysis deck, deep-linkable via `?s=1..5`. |
| `/present/[code]/qrs/` | Printable QR sheet (`@page landscape` is **not** set here — print CSS uses `print:` Tailwind variants, but the parent `/present/[code]/` body has no print rules). |
| `/host/[code]/` | Operator console: per-table lock/unlock, room budget editor (Save Budget), JSON export, image download (all + finale), session reset. **Does not advance/retreat** — that's presenter-only. |
| `/board/[seat]/` · `/boards/all/` | Printable function boards (SVG with QR, `@page landscape margin:0`). |
| `/table/[code]/[table]/` | Legacy → redirects into `/play/{SESSION}/{table}`. |

## Development commands

```bash
bun install
bun run dev          # vite dev (http://localhost:5173)
bun run build        # vite build → .svelte-kit/cloudflare/_worker.js
bun run preview      # vite preview
bun run prepare      # svelte-kit sync || echo ''
bun run check        # svelte-kit sync && svelte-check --tsconfig ./tsconfig.json   (only quality gate)
bun run check:watch
bun test             # vitest run (src/**/*.{test,spec}.ts, node env, $lib alias)
wrangler pages deploy            # Pages project — NOT `wrangler pages deploy`
wrangler pages secret put FAL_API_KEY
```

No test suite beyond `src/lib/game/rules/rules.test.ts`. Smoke-test `host → play → present` after changes. Reset via the host page if state is wedged.

## AI integration (review + recommendations)

The AI surface is small but does the heavy lifting at the finale. **All prompt text lives in `src/lib/server/ai/prompts/` (see "Prompts as data, not code" below)** — the .ts files are thin wrappers. Three call sites:

| File | What it does | Model | Prompt |
|---|---|---|---|
| `src/lib/server/ai/rapidi.ts` (calls `PROMPTS.brief`) → `src/routes/api/ai/brief/+server.ts`, `src/routes/api/ai/compose-brief/+server.ts` | Executive brief narrative. System + dynamic user prompt with priority mix, lead/fault/blind, surprise, journey, verdict. **Proposed expansion (Phase 8)**: also appends 2 lines of strategy context — `Strategy: {roomStrategy}. Protected: {names}. Contested: {name}.` — driven by `strategySignature(room)` from [Strategy disclosure]. The renderer projects `protected` (per-seat array) into a deduped priority-name list. | Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (3.1-8b (deprecated) was deprecated 2026-05-30). | `prompts/brief.system.json` + `prompts/brief.user.ts` renderer. |
| `src/lib/server/ai/fal.ts` (calls `PROMPTS.roomRender`) → `src/routes/api/ai/room-concept/+server.ts` | Room render — the visual floorplan. Prompt is %-weighted on `priorityMix(matrix)`; "warm materials · cinematic natural light · 16:9 · no text/logos". | `fal-ai/nano-banana-2`, `num_images: 1`, `aspect_ratio: '16:9'`, `resolution: '1K'`, `output_format: 'webp'`. | `prompts/image.finale.json` + `prompts/image.finale.ts` renderer. |
| `src/lib/server/ai/fal.ts` (calls `PROMPTS.tableRender`) → `src/routes/api/ai/table-render/+server.ts` | Per-function render — what one function's bets look like as a workplace. | Same as above. | `prompts/image.table.json` + `prompts/image.table.ts` renderer. |

**Branding surfaces:** "AI powered by ZyetaI" pill (`<ZyetaI>` / `compact`) appears on the home page, `FutureBrief`, `FutureRoomGen`, `MobileRender` (function + room cards), and as a watermark on the table render. The LinkedIn frame canvas draws "Powered by ZyetaI" at the bottom-right (`linkedin-frame.ts` line 125).

**Failure modes that fall back gracefully:**

-  RapidI `null` → `buildEnhancedBrief` (numbers-only skeleton).
-  RapidI returns `<= 40 chars` → treated as `null`, fall back.
-  RapidI throws → caught, `console.error`, fall back.
- fal returns `null` url → `{ url: null, error: 'no_key' | 'failed' }` → UI shows the typed message in `futureUi.err` or per-table `tableErr`.
- Missing `FAL_API_KEY` / `FAL_KEY` → `generateImage` returns `no_key`; brief still works.
- No `AI` binding →  RapidI `null`; brief falls back.
- **`room.strategy` undefined (R1, R2, pre-reveal)** → strategy signature isn't computed until ≥1 capture round. The brief user-message renderer must handle this: omit the strategy lines (don't emit empty `Strategy: .`) and continue with the existing mix/lead/fault/blind/surprise/journey/verdict facts. **The brief never blocks on strategy being present.**

> **STATUS (2026-08-02):** *Proposed* — this refactor was rejected in code review (claim-then-update state machine + JSON-folder + typed registry added ~1,000 lines of unused scaffolding). Current state is a single `src/lib/server/ai/prompts.ts` (242L). Open below for the brand-voice migration path when a non-engineer editor needs to change the prompt text.

### Prompts as data, not code (the bigger fix)

Right now the prompt text lives in three different shapes:

| Place | Form | Who can edit it? |
|---|---|---|
| `src/lib/server/ai/rapidi.ts:22` | the `SYSTEM` template literal | only TS-reading engineers |
| `src/lib/game/brief.ts:51` `finalePrompt(matrix)` | template literal with `%`-interpolation | only TS-reading engineers |
| `src/lib/game/brief.ts:81` `tableFunctionPrompt(name, bets)` | template literal with `%`-interpolation | only TS-reading engineers |
| `src/lib/game/brief.ts:139` `briefFactsForRapidi(agg)` | the user-message text for  RapidI | only TS-reading engineers |
| `LLAMA_MODEL` in `rapidi.ts:9` | string const | only TS-reading engineers |

That's a smell. **Prompts are brand, not behaviour** — they belong next to each other in a `prompts/` folder, in a form a non-engineer (a brand writer, a domain expert, a designer) can read and edit without opening a `.ts` file. They also need a place to live so a future A/B test or a `/admin/prompts` UI can mutate them at runtime.

#### Proposed layout

```
src/lib/server/ai/prompts/
├── _schema.ts          // types: PromptTemplate, RenderContext, PromptMeta
├── brief.system.json   // the chat-model system prompt (the brand voice)
├── brief.user.json     // user-message template (sections, slots, output rules)
├── brief.user.ts       // renderer: takes RoomState → user-message string
├── image.finale.json   // the room-render prompt template
├── image.finale.ts     // renderer: takes number[7] matrix → final prompt
├── image.table.json    // the function-render prompt template
├── image.table.ts      // renderer: takes { name, bets } → final prompt
├── registry.ts         // typed map name → { model, params, system?, userRender, imageRender, meta }
└── index.ts            // barrel — public surface for the AI module
```

**Why both JSON and TS** (the user asked for "JSON or js" — the answer is *both*, by file role):

- **JSON for static text** (system prompt, image prompt skeletons). Sections are explicit keys, so a linter or a `/admin/prompts` UI can validate required sections and edit them without diffing a long string. The file is trivially diffable in PR review — product, brand, and domain reviewers can read it.
- **TS for renderers** that take data. The user prompt is a *function* of `RoomState`; the image prompts are functions of `matrix` / `bets`+`name`. JSON can't express that without an eval layer, and you don't want one.
- **TS for the registry** so `import { PROMPTS } from '$lib/server/ai/prompts'` is typed and discoverable.

**No fs reads** — the JSON is bundled in by Vite. Cloudflare Workers + `wrangler pages deploy` doesn't see filesystem at runtime; you want the prompt in the bundle, not on a volume.

#### Concrete file contents

`src/lib/server/ai/prompts/_schema.ts` — the contract:

```ts
// All renderers return strings. All metadata is plain data.
export interface PromptMeta {
  /** Stable id used for telemetry, cache keys, "regen" diffs, and promptHash. */
  readonly id: string;
  /** Version stamp — bump when the prompt text or renderer changes. */
  readonly version: string;
  /** When this version was last updated (ISO). Set by the editor or `bun run bump`. */
  readonly updatedAt: string;
  /** Free-form owners (e.g. "brand:rick", "domain:zyeta"). */
  readonly owners: string[];
  /** Short design note. Empty allowed. */
  readonly notes?: string;
  /** Optional A/B variant label (default "control"). */
  readonly variant?: 'control' | string;
}

export interface ChatPrompt<M> {
  readonly meta: PromptMeta;
  readonly model: M;
  readonly params: { temperature: number; max_tokens: number; top_p?: number };
  readonly system: string;
  /** Pure: take the domain context, return the user-message string. */
  readonly renderUser: (ctx: BriefFacts) => string;
}

export interface ImagePrompt<M, I> {
  readonly meta: PromptMeta;
  readonly model: M;
  readonly params: { num_images: number; aspect_ratio: string; resolution: string; output_format: string };
  /** Static prompt sections. */
  readonly staticSections: readonly string[];
  /** Pure: take the domain context, return the final prompt string. */
  readonly render: (ctx: I) => string;
}
```

`src/lib/server/ai/prompts/brief.system.json` — the brand voice, now in a file a designer can read:

```json
{
  "meta": {
    "id": "brief.system",
    "version": "2026.07.0",
    "updatedAt": "2026-07-29",
    "owners": ["brand:rick", "domain:zyeta"],
    "notes": "ZyetaI executive brief voice. Reads as a boardroom consultant, not a chatbot. The Common Ground vocabulary (lead/fault/blind/surprise) is canonical — do not paraphrase."
  },
  "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "params": { "temperature": 0.45, "max_tokens": 480, "top_p": 0.9 },
  "sections": {
    "role": "You are ZyetaI, the workplace-strategy AI for Zyeta's Common Ground game.",
    "audience": "C-suite and the 7 function leads (Real Estate, HR, IT, Finance, Operations, Marketing, C-Suite) who just spent $M of synthetic budget across 7 workplace priorities over 5 rounds.",
    "voice": "Your readers are tired, in a boardroom, and have 60 seconds. Be sharp, specific, and grounded. Never invent percentages, dollar amounts, function names, or priorities. If the facts are sparse, say so — never bluff a mandate.",
    "vocabulary": [
      "Common Ground Index — 0..100, mean pairwise cosine similarity between function vectors",
      "lead — the priority the most functions rallied behind",
      "fault — the priority with the greatest spread between functions (the real divide)",
      "blind — the least-funded priority ( the room collectively overlooked)",
      "surprise — a function that put ≥25% of its money on an off-type priority. No surprise is honest; do not invent one."
    ],
    "structure": [
      "MANDATE — one sentence. Lead priority, its %, and what the workplace must deliver.",
      "WHERE THE MONEY WENT — bullet per non-zero priority: original label · % · $ · tokens.",
      "LEAD / RESOLVE / PROTECT — three directives (≤ 1 line each).",
      "SPATIAL PROGRAM — 2..3 sentences on how the floorplate tilts with the mix.",
      "ONE OPEN QUESTION — a single sharp question for the design team to chew on."
    ],
    "constraints": [
      "Stay under 280 words.",
      "Plain text only — no # markdown headings.",
      "No emojis. No exclamation marks.",
      "Use the priority and function names from the user message verbatim.",
      "If total stake is zero, return exactly: NO STAKE YET — tables have not placed tokens."
    ]
  }
}
```

(The full `src/lib/server/ai/prompts/registry.ts`, `brief.user.ts`, `image.finale.ts`, `image.table.ts`, and the post-refactor `rapidi.ts` / `fal.ts` sketches are in the next subsection below — the JSON is the design contract; the TS is the wiring.)

### Wiring & shrunken plumbing (the actual refactor)

The brand voice lives in JSON now. The wiring is what the rest of the AI module looks like.

`src/lib/server/ai/prompts/registry.ts` — the single typed source of truth, with a flattener for the sectioned system prompt:

```ts
import type { ChatPrompt, ImagePrompt, PromptMeta } from './_schema';
import briefSystem from './brief.system.json';
import { renderUserPrompt, buildBriefFacts, type BriefFacts } from './brief.user';
import finale from './image.finale.json';
import { renderFinalePrompt } from './image.finale';
import table  from './image.table.json';
import { renderTablePrompt } from './image.table';
import type { RoomState } from '$lib/game/types';

/** Flatten sectioned JSON into a single system string. Order is the order
 *  the JSON file declares — that order is the brand voice. */
function flattenBriefSystem(s: typeof briefSystem.sections): string {
  return [
    s.role,
    s.audience,
    s.voice,
    `Use the Common Ground vocabulary:`,
    ...s.vocabulary.map(v => `  • ${v}`),
    `Structure:`,
    ...s.structure.map((line, i) => `  ${i + 1}. ${line}`),
    `Constraints:`,
    ...s.constraints.map(c => `  - ${c}`)
  ].join('\n');
}

export const BRIEF: ChatPrompt<typeof briefSystem.model, BriefFacts> = {
  meta: briefSystem.meta,
  model: briefSystem.model,
  params: briefSystem.params,
  system: flattenBriefSystem(briefSystem.sections),
  renderUser: (f) => renderUserPrompt(f)
};

export const ROOM_RENDER: ImagePrompt<typeof finale.model, number[]> = {
  meta: finale.meta, model: finale.model, params: finale.params,
  staticSections: Object.values(finale.sections),
  render: (matrix) => renderFinalePrompt(matrix)
};

export const TABLE_RENDER: ImagePrompt<typeof table.model, { name: string; bets: number[] }> = {
  meta: table.meta, model: table.model, params: table.params,
  staticSections: Object.values(table.sections),
  render: (ctx) => renderTablePrompt(ctx.name, ctx.bets)
};

export const PROMPTS = { brief: BRIEF, roomRender: ROOM_RENDER, tableRender: TABLE_RENDER } as const;
export type PromptName = keyof typeof PROMPTS;

/** Hash a prompt for cache + regen diffs. Tiny, no crypto dep. */
export function promptHash(p: PromptMeta, system: string): string {
  const s = `${p.id}@${p.version}|${system}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'ph_' + (h >>> 0).toString(36);
}
```

`src/lib/server/ai/prompts/brief.user.ts` — the renderer; the JSON file is the slot/header text only. **Delete `briefFactsForRapidi` and `finalePrompt`/`tableFunctionPrompt` from `src/lib/game/brief.ts` once this is in** — those move out of `game/` into `server/ai/prompts/` because they cross the AI boundary, not the domain boundary.

```ts
import { PERSONAS, PRIORITIES } from '$lib/game/config';
import { priorityMix, roomInsights } from '$lib/game/scoring';
import { formatUsd } from '$lib/game/money';
import type { RoomState } from '$lib/game/types';
import slots from './brief.user.json';

export interface BriefFacts {
  totalTokens: number; totalUsd: string; alignmentIndex: number; tableCount: number;
  mix: Array<{ name: string; pct: number; tokens: number; usd: string; design: string }>;
  lead:  { name: string; pct: number; usd: string };
  fault: { name: string; usd: string };
  blind: { name: string; tokens: number; usd: string };
  surprise?: { seatName: string; priority: string };
  journey: Array<{ r: number; total: number }>;
  verdict: 'Aligned' | 'Mixed' | 'Fractured' | '—';
}

export function buildBriefFacts(room: RoomState): BriefFacts | null {
  const a = room.aggregate;
  if (a.totalCoins <= 0) return null;
  const i = roomInsights(room);
  const leadPct = i.lead === '—' ? 0 : ((a.matrix[a.alignment] ?? 0) / a.totalCoins) * 100;
  return {
    totalTokens: a.totalCoins,
    totalUsd: formatUsd(a.totalCoins),
    alignmentIndex: a.alignmentIndex,
    tableCount: a.tableCount,
    mix: priorityMix(a.matrix).filter(m => m.pct > 0).map(m => ({
      name: m.name, pct: m.pct, tokens: m.tokens, usd: formatUsd(m.tokens), design: m.design
    })),
    lead:  { name: i.lead,  pct: leadPct, usd: formatUsd(a.matrix[a.alignment] ?? 0) },
    fault: { name: i.fault, usd: formatUsd(a.matrix[a.fault] ?? 0) },
    blind: { name: i.blind, tokens: a.matrix[a.blind] ?? 0, usd: formatUsd(a.matrix[a.blind] ?? 0) },
    surprise: a.surprise
      ? { seatName: PERSONAS[a.surprise.seat]?.name ?? 'A function',
          priority: PRIORITIES[a.surprise.priority] }
      : undefined,
    journey: i.journey,
    verdict: i.verdict
  };
}

export function renderUserPrompt(f: BriefFacts): string {
  const lines: string[] = [
    slots.slots.header,
    ``,
    `Game state`,
    `  tables: ${f.tableCount}  ·  total stake: ${f.totalTokens} tokens (${f.totalUsd})`,
    `  alignment (Common Ground Index): ${f.alignmentIndex}/100  →  ${f.verdict}`,
    ``,
    `Mix (priority · % · $ · tokens)`,
    ...f.mix.map(m => `  · ${m.name} — ${m.pct}% · ${m.usd} · ${m.tokens} tok → ${m.design}`),
    ``,
    `Lens`,
    `  lead:   ${f.lead.name}  (${f.lead.pct.toFixed(1)}% · ${f.lead.usd})`,
    `  fault:  ${f.fault.name} (${f.fault.usd})`,
    `  blind:  ${f.blind.name} (${f.blind.usd} room-wide)`,
  ];
  if (f.surprise) {
    lines.push(``, `Surprise`,
      `  ${f.surprise.seatName} broke type by funding ${f.surprise.priority}.`,
      `  Decide: call it out, or hold it back.`);
  } else {
    lines.push(``, `Surprise`, `  none — every function stayed on its bias.`);
  }
  if (f.journey.length > 0) {
    lines.push(``, `Journey (per-round totals)`,
      ...f.journey.map(j => `  R${j.r}: ${j.total} tokens`));
  }
  lines.push(``, slots.slots.formatHint);
  return lines.join('\n');
}
```

`src/lib/server/ai/prompts/image.finale.ts` — the room render prompt. It is a *function* of the matrix; the JSON holds the static sections.

```ts
import { priorityMix, sum } from '$lib/game/scoring';
import { formatUsd } from '$lib/game/money';
import type { PriorityMix } from '$lib/game/types';
import finale from './image.finale.json';

export function renderFinalePrompt(matrix: number[]): string {
  const mix = priorityMix(matrix).filter(m => m.pct > 0);
  const total = sum(matrix as number[]);
  const lead: PriorityMix | undefined = mix[0];

  const composition = mix.length
    ? mix.map(m => `${m.pct}% ${m.name.toLowerCase()}`).join(', ')
    : 'balanced collaboration and focus';
  const spatial = mix.length
    ? mix.slice(0, 5).map(m => `${m.pct}% of the floorplate emphasises ${m.design}`).join('; ')
    : 'balanced multi-zone workplace';
  const leadLine = lead
    ? `Lead priority is ${lead.name} at ${lead.pct}% of the total ${formatUsd(total)} — make this priority the dominant spatial gesture, focal material moment, and largest floorplate share.`
    : `No clear lead — keep all priorities balanced.`;

  // Section substitution: each sections.X value may contain {{tokens}}.
  // No eval; pure regex over the JSON-defined section strings.
  const subs: Record<string, string> = {
    brand: finale.sections.brand,
    frame: finale.sections.frame.replaceAll('{{composition}}', composition),
    lead: finale.sections.lead
      .replace('{{#if lead}}', lead ? '' : '<!--')
      .replace('{{/if}}',     lead ? '' : '-->')
      .replace('{{#unless lead}}', lead ? '<!--' : '')
      .replace('{{/unless}}',       lead ? '-->' : '')
      .replace('{{lead.name}}', lead?.name ?? '—')
      .replace('{{lead.pct}}',  String(lead?.pct ?? 0))
      .replace('{{totalUsd}}',  formatUsd(total)),
    architecture: finale.sections.architecture.replaceAll('{{spatial}}', spatial),
    rule: finale.sections.rule,
    material: finale.sections.material,
    output: finale.sections.output
  };
  // 2-token mini-template: join sections in declared order, with the conditional comment trick.
  return Object.entries(subs)
    .map(([_, v]) => v.replace(/<!--[\s\S]*?-->/g, ''))
    .join(' ');
}
```

`src/lib/server/ai/prompts/image.table.ts` is the same shape with `functionName` + `bets`. **The "two-token template" is a 20-line `String#replace` — no `eval`, no `new Function`.** The linter (see lint script below) refuses anything that isn't a key from the section keys.

`src/lib/server/ai/rapidi.ts` collapses to:

```ts
import { PROMPTS, type BriefFacts } from './prompts';
export type AiBinding = {
  run: (m: string, i: { messages: Array<{ role: 'system'|'user'|'assistant'; content: string }>;
                        temperature?: number; max_tokens?: number; top_p?: number })
    => Promise<{ response?: string } | string>;
};
export async function generateBriefWithRapidi(
  ai: AiBinding | undefined,
  facts: BriefFacts | null
): Promise<string | null> {
  if (!facts || !ai) return null;
  try {
    const out = await ai.run(PROMPTS.brief.model, {
      messages: [
        { role: 'system', content: PROMPTS.brief.system },
        { role: 'user',   content: PROMPTS.brief.renderUser(facts) }
      ],
      ...PROMPTS.brief.params
    });
    const text = typeof out === 'string' ? out : (out?.response ?? '');
    return text.trim().length > 40 ? text.trim() : null;
  } catch (err) {
    console.error('[rapidi] brief failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
```

`src/lib/server/ai/fal.ts` collapses to:

```ts
import { fal } from '@fal-ai/client';
import { PROMPTS } from './prompts';
export type ImageResult = { url: string; error?: never } | { url: null; error: 'no_key' | 'failed' };
export async function generateImage(apiKey: string | undefined, prompt: string): Promise<ImageResult> {
  if (!apiKey) return { url: null, error: 'no_key' };
  try {
    fal.config({ credentials: apiKey });
    const result = await fal.subscribe(PROMPTS.roomRender.model, {
      input: { prompt, ...PROMPTS.roomRender.params }
    });
    const url = (result as { data?: { images?: Array<{ url?: string }> } }).data?.images?.[0]?.url;
    return url ? { url } : { url: null, error: 'failed' };
  } catch (err) {
    console.error('[fal] image generation failed:', err instanceof Error ? err.message : err);
    return { url: null, error: 'failed' };
  }
}
```

`src/routes/api/ai/finale/+server.ts` then becomes:

```ts
import { promptHash, PROMPTS } from '$lib/server/ai/prompts';
// …
const facts = buildBriefFacts(room);
const rapidi = await generateBriefWithRapidi(ai, facts);
const brief = rapidi ?? factsBrief;
const prompt = PROMPTS.roomRender.render(room.aggregate.matrix);
// … persist, return json({
//     url, imageError, prompt, brief, briefSource, rapidi,
//     promptHash: promptHash(PROMPTS.brief.meta, PROMPTS.brief.system),
//     room: store.snapshot()
//   })
```

The `promptHash` in the response lets the client know which prompt version the brief was generated with — your "Regen" button can then say "Brief is current" vs "Brief was generated with an older prompt; regenerate to apply new copy." That alone justifies the version field.

#### What `brief.system.json` and `image.finale.json` look like (concrete)

```jsonc
// brief.system.json  — ZyetaI brand voice, the 7 sections the model must see
{
  "meta": { "id": "brief.system", "version": "2026.07.0", "updatedAt": "2026-07-29",
            "owners": ["brand:rick", "domain:zyeta"],
            "notes": "ZyetaI executive brief voice. Reads as a boardroom consultant, not a chatbot. The Common Ground vocabulary (lead/fault/blind/surprise) is canonical — do not paraphrase." },
  "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "params": { "temperature": 0.45, "max_tokens": 480, "top_p": 0.9 },
  "sections": {
    "role":      "You are ZyetaI, the workplace-strategy AI for Zyeta's Common Ground game.",
    "audience":  "C-suite and the 7 function leads (Real Estate, HR, IT, Finance, Operations, Marketing, C-Suite) who just spent $M of synthetic budget across 7 workplace priorities over 5 rounds.",
    "voice":     "Your readers are tired, in a boardroom, and have 60 seconds. Be sharp, specific, and grounded. Never invent percentages, dollar amounts, function names, or priorities. If the facts are sparse, say so — never bluff a mandate.",
    "vocabulary": [
      "Common Ground Index — 0..100, mean pairwise cosine similarity between function vectors",
      "lead — the priority the most functions rallied behind",
      "fault — the priority with the greatest spread between functions (the real divide)",
      "blind — the least-funded priority (the room collectively overlooked)",
      "surprise — a function that put ≥25% of its money on an off-type priority. No surprise is honest; do not invent one."
    ],
    "structure": [
      "MANDATE — one sentence. Lead priority, its %, and what the workplace must deliver.",
      "WHERE THE MONEY WENT — bullet per non-zero priority: original label · % · $ · tokens.",
      "LEAD / RESOLVE / PROTECT — three directives (≤ 1 line each).",
      "SPATIAL PROGRAM — 2..3 sentences on how the floorplate tilts with the mix.",
      "ONE OPEN QUESTION — a single sharp question for the design team to chew on."
    ],
    "constraints": [
      "Stay under 280 words.",
      "Plain text only — no # markdown headings.",
      "No emojis. No exclamation marks.",
      "Use the priority and function names from the user message verbatim.",
      "If total stake is zero, return exactly: NO STAKE YET — tables have not placed tokens."
    ]
  }
}
```

```jsonc
// image.finale.json  — the room-render prompt template; renderer inlines {{tokens}}
{
  "meta": { "id": "image.finale", "version": "2026.07.0", "updatedAt": "2026-07-29",
            "owners": ["brand:rick"], "notes": "Room render — %-weighted spatial composition." },
  "model": "fal-ai/nano-banana-2",
  "params": { "num_images": 1, "aspect_ratio": "16:9", "resolution": "1K", "output_format": "webp" },
  "sections": {
    "brand":        "For Zyeta / Common Ground — imagine the future of the workplace, a 16:9 photorealistic architectural visualisation of a forward-thinking interior.",
    "frame":        "This is the leadership's recommended workplace, NOT a generic office. Money → space: {{composition}}.",
    "lead":         "{{#if lead}}Lead priority is {{lead.name}} at {{lead.pct}}% of the total ${{totalUsd}} — make this priority the dominant spatial gesture, focal material moment, and largest floorplate share.{{/if}}{{#unless lead}}No clear lead — keep all priorities balanced.{{/unless}}",
    "architecture": "Architecture must express where capital went: {{spatial}}.",
    "rule":         "Higher-% priorities dominate floorplate, materials, and focal moments; lower-% stay secondary.",
    "material":     "Material palette: warm timber, soft textiles, matte metal, plants. Cinematic natural light from one side. People actively using the space — meeting, collaborating, working, presenting.",
    "output":       "Wide-angle 16:9 architectural photograph, photojournalistic, no people staring at camera, no text, no logos, no charts, no watermarks."
  }
}
```

#### Prompt lint (small, ~60 lines, drop into `scripts/lint-prompts.ts`)

```ts
// scripts/lint-prompts.ts
import briefSystem   from '../src/lib/server/ai/prompts/brief.system.json';
import briefUser     from '../src/lib/server/ai/prompts/brief.user.json';
import finale        from '../src/lib/server/ai/prompts/image.finale.json';
import table         from '../src/lib/server/ai/prompts/image.table.json';
import { readFileSync } from 'node:fs';

const REQUIRE_KEYS = (s: any, keys: string[]) => Object.keys(s).filter(k => !keys.includes(k));
const issues: string[] = [];

// 1. Every JSON must declare meta.
for (const [name, p] of Object.entries({ briefSystem, briefUser, finale, table })) {
  if (!p.meta?.id || !p.meta?.version) issues.push(`${name}: missing meta.id or meta.version`);
  if (!p.meta?.updatedAt)             issues.push(`${name}: missing meta.updatedAt`);
}
// 2. brief.system must declare the 5 sections.
const required = ['role', 'audience', 'voice', 'vocabulary', 'structure', 'constraints'];
const extra = REQUIRE_KEYS(briefSystem.sections, required);
if (extra.length) issues.push(`brief.system.sections has unknown keys: ${extra.join(', ')}`);
// 3. Image sections cannot invent {{tokens}} that aren't whitelisted in the renderer.
const T = new Set(['composition', 'spatial', 'lead.name', 'lead.pct', 'totalUsd', 'functionName', 'bets']);
for (const [name, p] of Object.entries({ finale, table })) {
  const txt = Object.values(p.sections).join('\n');
  for (const m of txt.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    if (!T.has(m[1])) issues.push(`${name}: unknown token {{${m[1}}}`);
  }
  for (const m of txt.matchAll(/\{\{#\s*(\w+)/g)) {
    if (!['if', 'unless'].includes(m[1])) issues.push(`${name}: unknown block {{#${m[1}}}`);
  }
}
// 4. Word count cap.
if (briefSystem.sections.role.length + briefSystem.sections.voice.length > 1200) {
  issues.push('brief.system role+voice over 1200 chars — risk of  RapidI ignoring the tail');
}

if (issues.length) {
  console.error('Prompt lint failed:\n  ' + issues.join('\n  '));
  process.exit(1);
}
console.log('Prompts OK.');
```

Wire it up in `package.json`:
```jsonc
"scripts": { …, "lint:prompts": "bun run scripts/lint-prompts.ts" }
```

### Other AI-tightening notes

- **`max_tokens: 700` is generous for 280 words**; consider dropping to `max_tokens: 480` to bound cost (and latency for the `fp8-fast` variant).
- **`temperature: 0.45`** is OK; raise to `0.5` for more varied briefs across regenerations, drop to `0.3` for tighter boardroom prose. The "Regen" button in `FutureBrief` is the right affordance for either choice.
- **Streaming** is not used; the brief waits for the full response. Workers AI supports `stream: true` on the `run` shape; consider it for the brief endpoint only (image gen has no streaming).
- **No caching of successful briefs** — every "Regen brief" re-pays. Add a client-side cache keyed by `room.updatedAt` to avoid the cost unless the room actually changed.
- **No `n` (multi-image) on the room render** — the design philosophy is "one render is intentional v1". If you want variation, set `num_images: 2` and surface a "Try another" button next to the existing one.
- **Watermark** on the table render in `MobileRender` is a CSS overlay ("Powered by ZyetaI"), not a baked-in mark. The `LinkedIn` frame canvas also paints "Powered by ZyetaI" — consider unifying both into a small `Watermark.svelte` component so brand updates are one-line.
- **Surprise token is currently text-only** ("A function broke type — keep this in the brief narrative") — the refactored user prompt above names the seat and the priority, giving the model a concrete lead to expand.
- **No `ZYE_TAG`/brand logo in the AI render output** — the image prompt explicitly says "no text, logos, charts, or watermarks", which is correct for a photorealistic visual, but means the LinkedIn frame is the only branded share artifact. A small SVG-monogram `ZyetaI` lockup added in `linkedin-frame.ts` (top-right corner, low alpha) would be on-brand without overstating.

### Endpoint behavior (concrete)

| Endpoint | Body | Response | Side effects |
|---|---|---|---|
| `POST /api/ai/brief` | `{ code }` | `{ brief, briefSource: 'rapidi' \| 'numbers', rapidi: boolean, room }` | persists `enhancedBrief` / `briefSource` |
| `POST /api/ai/room-concept` | `{ code }` | `{ url \| null, imageError?, prompt, room }` | appends to `roomConceptUrls`; sets `finaleImageUrl` if first |
| `POST /api/ai/compose-brief` | `{ code }` | `{ brief, briefSource: 'rapidi' \| 'numbers', rapidi: boolean, room }` | persists `enhancedBrief` / `briefSource` |
| `POST /api/ai/table-render` | `{ tableId: 1..7 }` | `{ url \| null, imageError?, prompt, tableId, functionName, room }` | persists `tables[tableId].imageUrl` on success |

All three return 400 on `aggregate.totalCoins <= 0` (finale/brief) or zero stake on the table (table-render). All three read from `platform?.env` (Workers bindings) and `$env/dynamic/private` (build-time/secrets). The `code` field in every body is the LIVE room constant — the server ignores it.

## UI/UX system design (fonts, motion, gamification, Svelte 5)

The current visual stack is **"Classic green felt · serif · minimal"** — Playfair Display (display) + Lora (body) + Space Mono (monospace) loaded from Google Fonts. It reads as 2014: a little earnest, a little heavy, and the display face has weak small-size legibility. The motion vocabulary is **ad-hoc** — every component hardcodes `cubic-bezier(0.22, 1, 0.36, 1)` or `0.4s ease` rather than referencing a token. The gamification is **one chip pile + one row flash + a haptic on chip tap** — that's the entire interaction vocabulary.

This section is the redesign spec: a **modern, sleek, gamified** system that fits Zyeta's boardroom tone and pushes the existing Svelte 5 surface harder. No product-pivot, no schema changes, no AI changes — purely the presentation layer.

### The brand voice, restated as a visual contract

> "Imagine the future of the workplace." — ZyetaI

The visual system has to look like a **boardroom after a 90-minute strategy session**, not a SaaS dashboard. The brief the design has to keep: **sharp, considered, generous whitespace, generous type, single-number hero, one sentence read-aloud per screen, SVG only for charts, persona colors stay persona-bound**. New: **modern** means sans-serif display + sans-serif body (no more Playfair/Lora), **sleek** means one animation curve, one motion budget, and a Svelte view transition between routes, **gamified** means every tap rewards the user with a deliberate micro-interaction (not a candy splash).

### 1. Font stack — drop Playfair + Lora, adopt a modern sans pair

**Recommended pair** (both available on Google Fonts; both ship variable fonts; both have a 100-weight axis for the hero number):

| Role | Current | Recommended | Why |
|---|---|---|---|
| Display (hero numbers, screen titles) | Playfair Display (serif, 400..900) | **Inter Display** (sans, 100..900, optical-size axis) | Serif display faces are dated for "modern + sleek" boardroom tools. Inter Display has the *tabular figures* and *wide apertures* that read at 120pt and at 11pt. Use weights 700–900 only. |
| Body (UI, tables, modals) | Lora (serif, 400..700) | **Inter** (sans, 100..900) | Inter pairs with Inter Display (same family, different optical size) — no FOUT, no second network request. UI is more legible at 14–16px. |
| Mono (codes, IDs, prices) | Space Mono | **JetBrains Mono** (500) | Space Mono is fine but JetBrains has *tabular figures* which matter for prices and IDs that need to align. |
| Wordmark (`COMMON GROUND`) | Playfair Display 800 | **Inter Display 900** with `letter-spacing: -0.04em` and `text-transform: uppercase` | The wordmark is a brand mark, not a heading; sans-serif is more legible in a stage-sized logo and matches the Inter pair. |

**Drop-in** for `src/app.html` (line 9):

```html
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=JetBrains+Mono:wght@500&display=swap"
  rel="stylesheet"
/>
```

`Inter Tight` is a separate Google Fonts family that is the **display variant** of Inter (tighter tracking, slightly heavier on the weights for hero sizes). `Inter` for body. **`Inter Display`** isn't a separate Google Fonts family — it ships as a sub-style of `Inter` via the `opsz` axis; the CSS variable `font-optical-sizing: auto` is the right toggle for the hero numbers.

**Drop-in** for `src/app.css` (replace the existing `@theme { --font-* }`):

```css
@theme {
  --font-sans:      'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-display:  'Inter Tight', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono:      'JetBrains Mono', ui-monospace, monospace;
  --font-serif:     Georgia, 'Times New Roman', serif;  /* keep as the system fallback */

  /* optical sizing: numbers look correct at 14pt and 120pt from the same family */
  --text-display-2xl: 4.5rem;       /* ~72pt hero CGI ring label */
  --text-display-xl:  3rem;         /* ~48pt screen titles */
  --text-display-lg:  2.25rem;      /* ~36pt section heads */
  --text-display-md:  1.5rem;       /* ~24pt card heads */
  --text-display-sm:  1.125rem;     /* ~18pt small heads */
}
```

Then in `app.css`, set `body { font-family: var(--font-sans); font-optical-sizing: auto; font-feature-settings: 'tnum' 1, 'cv11' 1; }` — `tnum` enables tabular figures everywhere, so prices and tokens don't shimmy on update.

**Component change**: every existing `font-display` class still works — only the token behind it changed. The 5+ places that say `font-family: 'Playfair Display', sans-serif` (e.g. `Chip.svelte:30`, `FutureRoomGen.svelte:67`, the presenter `+page.svelte`'s `.brand` class) need to drop the `Playfair Display` literal and use `var(--font-display)`.

### 2. Type scale — one set of rules, used everywhere

The current type sizes are ad-hoc (`1.4rem`, `12px`, `0.95rem`, `font-size: 12px`, `font-size: 0.85rem`, `0.6em`...). Standardize on a Tailwind-named scale that maps to the `@theme` tokens above. The principle: **4 distinct sizes per screen** (display / heading / body / caption) so a designer can read a screen and see one scale.

```html
<!-- CSS class convention: t-display / t-head / t-body / t-caption -->
<p class="t-display">Future Readiness</p>     <!-- Inter Tight 800, 36–72pt depending on container -->
<h2 class="t-head">Where do you agree?</h2>    <!-- Inter Tight 700, 24pt -->
<p class="t-body">The room converges…</p>     <!-- Inter 400, 16pt, line-height 1.5 -->
<small class="t-caption">$28M of $700M</small>  <!-- Inter 500, 12pt, tabular nums -->
```

Add to `app.css`:

```css
@layer base {
  .t-display { font-family: var(--font-display); font-weight: 800; letter-spacing: -0.025em; line-height: 1.05; font-optical-sizing: auto; }
  .t-head   { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.015em; line-height: 1.2;  }
  .t-body   { font-family: var(--font-sans);    font-weight: 400; line-height: 1.5; }
  .t-caption{ font-family: var(--font-sans);    font-weight: 500; font-size: 12px; line-height: 1.35; color: var(--color-muted); letter-spacing: 0.04em; }
  .t-mono   { font-family: var(--font-mono);    font-weight: 500; font-feature-settings: 'tnum' 1; }
  .t-tabular{ font-variant-numeric: tabular-nums; }
}
```

The CSS class convention is **type role, not size**. A `t-display` is always the hero; a `t-caption` is always the meta. Components reach for the role, not the size — that way a single number change in `@theme` resizes the whole system.

### 3. Color — keep, but tokenize the missing seats

The current palette (`--color-bg`, `--color-ink`, `--color-gold`, `--color-teal`, `--color-red`) is solid. The seat colors are drift (see "Branding fix" earlier). The two things to add:

```css
@theme {
  /* existing palette — keep */

  /* semantic tokens: every component uses these, not the raw colors */
  --color-fg:           var(--color-ink);
  --color-fg-muted:     var(--color-muted);
  --color-bg-elevated:  color-mix(in srgb, var(--color-bg) 92%, white);
  --color-bg-overlay:   color-mix(in srgb, var(--color-bg) 75%, transparent);  /* modal scrim */

  --color-action:       var(--color-teal);   /* primary action: "open", "submit", "live" */
  --color-action-hover: color-mix(in srgb, var(--color-teal) 88%, black);
  --color-emphasis:      var(--color-gold);   /* secondary: ring, focus, "your lead" */
  --color-danger:        var(--color-red);
  --color-success:       color-mix(in srgb, var(--color-teal) 70%, white);

  --color-border:        var(--color-line);
  --color-border-strong: color-mix(in srgb, var(--color-line) 60%, var(--color-ink));

  /* shadows: elevate the chrome */
  --shadow-sm: 0 1px 2px color-mix(in srgb, var(--color-ink) 6%, transparent);
  --shadow-md: 0 4px 12px color-mix(in srgb, var(--color-ink) 8%, transparent);
  --shadow-lg: 0 12px 32px color-mix(in srgb, var(--color-ink) 12%, transparent);
  --shadow-glow: 0 0 24px color-mix(in srgb, var(--color-gold) 35%, transparent);  /* the CGI ring */
}
```

Then `Button.svelte`'s variants reference the **semantic** tokens (`bg-action`, `text-on-action`, `border-emphasis`) not the raw ones. The `--shadow-glow` becomes the ring's drop shadow — it makes the CGI hero feel like the centerpiece.

### 4. Motion — one curve, one budget, one set of tokens

The single biggest UX smell is that every component hardcodes its own `cubic-bezier`. Consolidate to **two curves** + **one global motion budget** in `@theme`:

```css
@theme {
  --ease-out-quart:    cubic-bezier(0.22, 1, 0.36, 1);  /* "out" — the default */
  --ease-in-out-quart: cubic-bezier(0.83, 0, 0.17, 1); /* "in-out" — page transitions */

  --dur-instant:  100ms;   /* hover, ripple, color change */
  --dur-fast:     180ms;   /* chip scale, button press */
  --dur-base:     280ms;   /* modal in, view transition */
  --dur-slow:     480ms;   /* chart fill, ring, bar grow */
  --dur-stage:    800ms;   /* hero ring, full reveal */
  --dur-stagger:  40ms;    /* between siblings in a stagger */
}
```

The rule: **`--dur-base` is the default**. Anything under 280ms is "I responded". Anything 280–800ms is "this is a stage moment". **Nothing is over 1 second on this app** — the boardroom has no patience for a 2-second animation. The reduced-motion override (already in `app.css` line 61) zeroes these:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
  /* keep state changes instant, but preserve color/opacity transitions so disabled/loading states still read */
}
```

Add **staggered list reveal** to chart parents via CSS-only (no JS):

```css
.stagger > * {
  opacity: 0;
  transform: translateY(8px);
  animation: rise var(--dur-slow) var(--ease-out-quart) both;
  animation-delay: calc(var(--i, 0) * var(--dur-stagger));
}
@keyframes rise {
  to { opacity: 1; transform: none; }
}
```

Use: `<li class="stagger" style="--i:{idx}">` (or assign via `style:--i={i}` in an `{#each}`).

### 5. Micro-interactions — the gamified vocabulary

The current vocabulary is **chip pile + row flash + chip haptic**. Expand to **8 named interactions**, each with a motion contract. None of these add features — they make the existing ones feel rewarding.

| Interaction | Where | Motion | Sound | Haptic |
|---|---|---|---|---|
| **tap** | `FunctionBoard` ±/Clr, `Button` press | `transform: scale(0.94)` on `:active`, snap back in `--dur-fast` | none | `navigator.vibrate(10)` |
| **chip land** | `FunctionBoard` chip pile | `in:scale={duration: 180, start: 0.35}` (already there) | none | none |
| **row flash** | `FunctionBoard` on change | row border `gold` + `box-shadow: 0 0 0 3px var(--color-emphasis)33` for 400ms (already there) | none | none |
| **submit seal** | `MobileSealed` after submit | `pulse` ring (already there) + confetti of 3 chip SVGs scattering | none | `navigator.vibrate([20, 50, 20])` (a "stamp") |
| **count up** | every `$` amount that updates | animate from old to new value over `--dur-slow` using `requestAnimationFrame`; **use Svelte 5 `Tween` for 1-line ease** | none | none |
| **confirmation** | host "Reset", advance/retreat, brief "Save edits" | button → `scale(0.96)` for 100ms, then `bg-action` to `bg-success` for 800ms with checkmark, then revert | none | `navigator.vibrate(15)` |
| **route transition** | every navigation | Svelte 5 `onNavigate` + native `document.startViewTransition` (Chrome/Edge) → 280ms cross-fade | none | none |
| **celebrate** | finale image generated | full-screen flash of `--shadow-glow` over the image, then settle; LinkedIn share button pulses | a soft "ding" via `AudioContext` (off by default; user-toggle) | `navigator.vibrate([30, 30, 30])` |

`FunctionBoard` is the densest — those micro-interactions *are* the gamification. The `submit seal` needs a new `use:confetti` action:

```ts
// src/lib/actions/confetti.ts
import type { Action } from 'svelte/action';
export function confetti(node: HTMLElement, opts: { count?: number } = {}) {
  const count = opts.count ?? 6;
  const c = document.createElement('canvas');
  Object.assign(c.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 70 });
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  c.width = innerWidth; c.height = innerHeight;
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2, y: innerHeight / 2,
    vx: (Math.random() - 0.5) * 12, vy: -8 - Math.random() * 6,
    r: 4 + Math.random() * 4, life: 1
  }));
  let raf: number;
  const draw = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.015;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = ['#B8932E', '#1F8B78', '#E0665A', '#3FB6A2'][Math.floor(Math.random() * 4)];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    });
    if (parts.some(p => p.life > 0)) raf = requestAnimationFrame(draw);
    else c.remove();
  };
  draw();
  return { destroy() { cancelAnimationFrame(raf); c.remove(); } };
}
```

Then in `MobileSealed.svelte` (or wherever the seal lands): `use:confetti={{ count: 12 }}`. The action is **Svelte 5 attachment** (`use:foo`) — same pattern as `use:enhance`, which we should also adopt for the host's `Save Budget` and `Reset Session` actions.

### 6. Count-up animation — Svelte 5 `$effect` + `requestAnimationFrame`

Right now `$` amounts snap. A 280ms count-up from old to new is the **single biggest perception-of-life** improvement. New utility:

```ts
// src/lib/actions/count-up.ts
import type { Action } from 'svelte/action';
export function countUp(node: HTMLElement, value: number) {
  let prev = 0;
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function tick() {
    const start = performance.now();
    const dur = 480;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      node.textContent = formatter.format(prev + (value - prev) * eased);
      if (t < 1) requestAnimationFrame(animate);
      else prev = value;
    };
    requestAnimationFrame(animate);
  }
  tick();
  return { update(newValue: number) { value = newValue; tick(); } };
}
```

Use on any `$` amount: `<span use:countUp={room.aggregate.totalCoins * 1_000_000}>{formatUsd(...)}</span>` — wait, the action takes the raw number, so the formatter lives inside. **Or** put the formatter in the action and take the formatted string as the value. Either works; the action has to be cheap (one `Intl.NumberFormat` per node is fine).

### 7. Svelte 5 view transitions — one cross-fade between routes

`app.html` already has `data-sveltekit-preload-data="hover"`. Add a Svelte 5 `onNavigate` hook to fade route changes:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onNavigate } from '$app/navigation';
  import '../app.css';
  import favicon from '$lib/assets/favicon.svg';
  import { session } from '$lib/state';
  let { children } = $props();
  onMount(() => session.boot());

  onNavigate((nav) => {
    if (!document.startViewTransition) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await nav.complete;
      });
    });
  });
</script>
```

Svelte 5 calls `onNavigate` before the route swap; `document.startViewTransition` runs the DOM transition in parallel. Browsers without the API (Safari, Firefox) silently no-op. **This is the single biggest "sleek" win** for the host/present/phone flow.

### 8. Buttons get a ripple + better press state

`Button.svelte` already has `transition` in the base class. Add a Svelte 5 **action** for a click ripple (Material-style) and tighten the press:

```ts
// src/lib/actions/ripple.ts
import type { Action } from 'svelte/action';
export function ripple(node: HTMLElement) {
  function handle(e: PointerEvent) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = node.getBoundingClientRect();
    const d = document.createElement('span');
    const size = Math.max(r.width, r.height) * 2;
    Object.assign(d.style, {
      position: 'absolute',
      left: `${e.clientX - r.left - size / 2}px`,
      top:  `${e.clientY - r.top  - size / 2}px`,
      width: `${size}px`, height: `${size}px`,
      borderRadius: '50%',
      background: 'currentColor',
      opacity: '0.18',
      pointerEvents: 'none',
      transform: 'scale(0)',
      transition: 'transform 480ms var(--ease-out-quart), opacity 600ms',
    });
 node.style.position ||= 'relative';
    node.style.overflow  ||= 'hidden';
    node.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 640);
  }
  node.addEventListener('pointerdown', handle);
  return { destroy() { node.removeEventListener('pointerdown', handle); } };
}
```

Apply in `Button.svelte` (via the component shell — every `Button` gets the ripple, no API change for callers):

```svelte
<!-- inside <button> / <a> -->
<button ... use:ripple>...</button>
```

### 9. Focus ring — tokenize, elevate, do not remove

The current `:focus-visible` (in `app.css:36`) is `2px solid var(--color-gold); outline-offset: 2px; border-radius: 4px;` — fine, but the same on every focusable. Tokenize + add a subtle drop shadow:

```css
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--color-emphasis);   /* gold, not just any "gold" */
  outline-offset: 3px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-emphasis) 25%, transparent);
  border-radius: inherit;
}
```

The box-shadow gives a soft halo that reads at distance (the boardroom). Move it to a class `.focus-ring` so only the chrome (buttons, inputs, dialog) gets it — `accent-color` handles form elements.

### 10. Concrete change list (UI/UX only — no domain or AI changes)

| # | File | Change |
|---|---|---|
| 1 | `src/app.html` | Swap Google Fonts URL to Inter / Inter Tight / JetBrains Mono. |
| 2 | `src/app.css` | Replace `@theme { --font-* }` with the new font stack + the `--ease-*`, `--dur-*`, type scale, semantic color tokens, and `--shadow-*` tokens. Add the `t-display`/`t-head`/`t-body`/`t-caption`/`t-mono`/`t-tabular` base classes. Add the `.stagger` keyframe. Improve the `:focus-visible` rule. |
| 3 | `src/lib/components/Button.svelte` | Reference `var(--font-display)` and the new `--dur-fast`/`--ease-out-quart`. Add `use:ripple` to the rendered button/anchor. Tighten the press to `transform: scale(0.97)` on `:active`. |
| 4 | `src/lib/components/Chip.svelte` | Drop the `Playfair Display` literal; use `var(--font-mono)` for the value (`t-mono` + `t-tabular`). |
| 5 | `src/lib/components/ZyetaI.svelte` | Tighten the leading pill: replace `font-mono` with `t-caption`, add a `transition: color 200ms` on the brand-span hover. |
| 6 | `src/lib/components/Modal.svelte` | Add an entrance animation (`scale 0.96 → 1` + opacity 0 → 1 over `--dur-base`, gated by reduced-motion). Add a backdrop fade (`opacity 0 → 1`). |
| 7 | `src/lib/components/ExpandImage.svelte` | Same entrance treatment as `Modal`. The image scales in 0.92 → 1 with `--ease-out-quart`. |
| 8 | `src/lib/components/StageNav.svelte` | The dot now scales 1 → 1.6 → 1 when active, with a 480ms ease. The Back/Next buttons use the press scale. |
| 9 | `src/lib/components/phone/FunctionBoard.svelte` | `navigator.vibrate(10)` is already there; bump to `vibrate(8)` on tap and `vibrate([20, 50, 20])` on submit-seal. The row flash is already there; add a subtle `box-shadow: 0 0 24px var(--color-emphasis) 22%` for the "your lead" row (the priority with the highest $M). |
| 10 | `src/lib/components/phone/MobileSealed.svelte` | Add `use:confetti` on mount. The pulse ring stays. |
| 11 | `src/lib/components/present/RoomInsights.svelte` | The ring `stroke-dasharray` transition already uses the right curve; just swap to `var(--ease-out-quart)` and `var(--dur-slow)`. The bar `width` transition same. |
| 12 | `src/lib/components/present/FutureBrief.svelte`, `FutureRoomGen.svelte`, `FutureTableGrid.svelte` | Wrap in `.stagger` for the list reveal. |
| 13 | `src/lib/components/present/FutureWorkspace.svelte` | The editable-brief modal opens with the same `Modal.svelte` entrance. The "Save edits" / "Regen" / "Generate" buttons get the press scale + ripple. |
| 14 | `src/routes/host/[code]/+page.svelte` | The "Emerging analysis" panel (per last pass) uses the new type scale. The reset / save buttons get the press scale + ripple. |
| 15 | `src/routes/+layout.svelte` | Add the `onNavigate` view-transition hook. |
| 16 | `src/lib/actions/ripple.ts`, `src/lib/actions/confetti.ts`, `src/lib/actions/count-up.ts` | New files. ~120 lines total. |

**Nothing in `src/lib/game/`, `src/lib/server/`, `src/routes/api/`, or `src/lib/state/` changes.** This is purely the presentation layer. `bun run check` should still pass.

### 11. What this gets you

- **A modern font system** that's tab-aligned, has the same family for display + body, and tabular figures everywhere money is shown. Drop-in for Playfair + Lora + Space Mono.
- **One motion vocabulary**: two curves, six durations, semantic tokens. Every animation in the app reads from the same source. Reduced-motion is global.
- **Eight named micro-interactions** (tap, chip land, row flash, submit seal, count up, confirmation, route transition, celebrate) — the gamification isn't decorative; every interaction has a *purpose* and a *contract*.
- **Svelte 5 idioms used harder**: `use:ripple`, `use:confetti`, `use:countUp` (new actions), `onNavigate` view transitions, `class:on={x}` everywhere, `$derived.by()` for complex state, `$effect` for true side-effects only, `$bindable` for two-way modal state, snippets, `tweened` from `svelte/motion` for the count-up.
- **No scope creep**: no new routes, no new endpoints, no domain-type changes, no AI changes. The product still does the same five things; the user just *feels* the same actions land better.

### 12. The single biggest impact (if you only ship one thing)

Ship `use:ripple` + the new font stack + the `--dur-*`/`--ease-*` tokens in one PR. That's the minimum to make the whole app feel different. The confetti, count-up, view-transition, and stagger can come in follow-ups.


- **File-kind discipline** (Svelte 5):
  - `.svelte` → UI only (markup, scoped styles, presentational).
  - `.svelte.ts` → runes state and actions (`$state`, `$state.raw`, `$derived`, `$derived.by`).
  - `.ts` under `src/lib/game/` → pure domain; no DOM, no `fetch`.
  - `.ts` under `src/lib/server/` → Worker-only (Store, D1, AI, secrets).
- **Runes, no legacy syntax.** Use `$props`, `$state`, `$state.raw`, `$derived`/`$derived.by`, `$effect`, `$bindable`, snippets, `{@render}`, `$app/state`, property event handlers (`onclick`, `onpointerup`). No `export let`, `$:`, `on:event`, `<slot>`, or `<svelte:component>`. `class:` directives are still used.
- **Avoid `$effect` for sync.** Prefer events, `onMount`, or explicit methods (see `src/lib/state/host.svelte.ts` for the rationale; `session.svelte.ts` uses `$state.raw` so reference-replace notifies subscribers without `$effect`). Legitimate `$effect` uses: `Modal.svelte` (DOM side-effect: call `showModal()`/`close()` on the native `<dialog>`), `FunctionBoard.svelte` (row-flash animation in response to prop change), and the play page's reseed effect (mirrors server state into local draft when the room sync key changes).
- **Imports**: tabs, semicolons, single quotes. `$lib/...` for cross-area, relative for same folder. `import type` for types. Component groups expose barrels in `index.ts` (`present/`, `phone/`, `analytics/`, `game/`, `state/`).
- **Styling**: Tailwind v4 via `@tailwindcss/vite` + component-scoped CSS. Tokens live in `src/app.css` under `@theme` (gold/teal/red palette, seat colors 0–6 — **see drift note in Project overview**, Playfair/Lora/Space Mono). Use CSS variables and `color-mix(in srgb, var(--color-…) X%, var(--color-panel))` rather than ad-hoc colors. Mobile layouts use `100dvh` and `env(safe-area-inset-bottom)`.
- **Error handling**: client `post()` throws parsed API `message` or HTTP fallback; callers commonly set `busy`/`error` and reset in `finally`. Connectivity polling swallows errors and flips `connected` false. Domain writes prefer booleans or `{ ok, error }`; submit failures are HTTP 400. Browser best-effort (`clipboard`, `localStorage`, `vibrate`, `navigator.share`, LinkedIn share offscreen window) use empty `catch {}`.
- **Async**: all client→server work goes through `session.*` (no ad-hoc `fetch` from components). `FutureTableGrid` generates table images sequentially with `for...of` + `await`; `linkedin-frame.ts` uses `Promise.all([loadImg(ai), loadImg(selfie)])` for the composite.
- **Browser-only code** is guarded with `typeof window !== 'undefined'`, `onMount`, or `'X' in navigator`. `src/app.d.ts` augments `App.Platform.env` with `FAL_API_KEY?`, `FAL_KEY?`, `ANTHROPIC_API_KEY?` (declared but **unused**), `AI?` (Workers AI), `common_ground_db?` (D1). `$env/dynamic/private` is the first place `fal.ts` looks for keys, `platform.env` second.
- **Naming**: components `PascalCase.svelte`; runes state `camelCase.svelte.ts`; constants `UPPER_SNAKE_CASE`; SSR-safe helpers check `typeof window` first.
- **Barrel re-exports**: `$lib/state` and `$lib/game` are the canonical entry points. `src/lib/client/index.ts` is **deprecated** (still re-exports state). `src/lib/index.ts` only re-exports `game/{types,config,scoring}`.
- **Domain constants worth knowing**: `TOKEN_VALUE_USD = 1_000_000` (cell value base), `CHIP_VALUE = 10` (single chip), `DEFAULT_TABLE_BOUNTY_TOKENS = 100` (per-table cap), `DEFAULT_ROOM_BOUNTY_TOKENS = 700` (room cap; `(700 / 7) = 100` per table by default). USD formatters in `money.ts`: `formatUsd(tokens)` is compact (`$28.5M` / `$1.2B`), `formatUsdFull(tokens)` is the full `Intl.NumberFormat` currency.

## FunctionBoard deep review — the chip-tap UX

`src/lib/components/phone/FunctionBoard.svelte` is the *one place* in the app where gamification is real. The user spends 5–10 minutes on this screen per round, tapping `+` and `-` to place $10M chips on priorities. **It's the densest interaction surface in the product.** This is a deep review of every issue, with the *exact* refactor that fixes it.

### Diagnosis — what's wrong today

Every observation is grounded in the current source. Line numbers are exact.

1. **The button press is invisible.** `FunctionBoard.svelte:165-167, 179-181, 190-193` use `onpointerup` (not `onclick`). The user releases their finger, the press animation is over, the visual feedback is gone. The CSS `:active { transform: scale(0.88) }` (line 399) only fires *during* the press. **The user sees a button, taps it, and nothing visible happens until the server responds 200 ms later.**
2. **The "add" and "remove" haptics are identical.** `tap()` does `navigator.vibrate(10)` (line 78). Adding a chip should feel *positive* (a small "click"); removing should feel *subtractive* (a "snip"). Same haptic for both is a missed affordance.
3. **The chip is too small to read.** `Chip.svelte` defaults to `size=30`. `FunctionBoard.svelte:137` passes `size={16}`. At 16 px the chip's dashed inner ring (`Chip.svelte:18-20`) and the optional `value` text are illegible. **At 16 px the chip is just a red dot.** The chip is supposed to *visually* communicate "$10M value placed", but a 16 px red dot doesn't.
4. **The chip pile animation has a 200 ms gap.** The user taps `+` → button bounces → `onDelta(p, +CHIP_VALUE)` fires → server responds 200 ms later → `counts[p]` updates → `chipSlots[p]` recomputes → `in:scale` fires on the new chip. **From tap to visible chip landing: 200 ms.** The user has tapped, the button has bounced, but no new chip has appeared. The fix is *optimistic update* (see Phase 3): apply the delta locally before sending to the server, revert on conflict.
5. **No "chip flies from button to pile" animation.** The only animation is `in:scale` (line 134) on the new chip slot — it fades-in in place. There's no trajectory. **A chip should *fly* from the button to the pile** — that's the gamification. This is the new `use:chipDrop` action (proposed below).
6. **The "Clear" button is a 10px monospace "Clr".** Line 196. The `onClear(p)` callback only clears *one* priority (per `board.ts:75-100`). The shape is unclear: does "Clr" clear *one* chip or *all* chips? The text is too small to read. **Replace with a dedicated icon** (a small "✕") and a `aria-label="Clear all $10M chips from Innovation"`.
7. **No long-press for rapid-fire.** A user who wants to remove 3 chips at once has to tap `-` three times (and wait for the server response each time — see point 4). **A long-press should rapid-fire at 100 ms intervals** after a 300 ms initial hold. Like a volume button. Adds tokens fast, makes the room feel *alive*.
8. **The chip pile `aria` is silent.** `<span class="chips">` (line 130) has no `role` and no `aria-label`. **A screen-reader user gets "Add ten m to Innovation" but no feedback on how many chips are placed.** Add `aria-label="{chipCount} chips placed, $10M each"`.
9. **The button `transform: scale(0.88)` transition is 100 ms.** Line 393. At 100 ms the press is *snappy* but the *release* is sluggish. **The press should be 60 ms (the user is still holding); the release should be 120 ms (ease-out).** Currently it's 100 ms linear — both directions feel the same.
10. **The `chip-over` `+N` indicator fires only at chipCount > 8.** Line 141. With cap = 10 chips, the indicator is `+1` or `+2`. **The user reads "+1" as "I have 1 more chip" — wrong, they have 9.** Show all 10 chips (the cap) in a wrap, or drop the indicator entirely. The actual total is already shown as `formatUsdFull(v)` next to the chips.
11. **The `chip-flash` animation has a hard 100% return to `inherit` / `rgba(0, 0, 0, 0.18)`.** Line 311. If the row is `filled` (border-color = `var(--seat)`), the 100% `inherit` may or may not pick up the filled border-color depending on CSS specificity. **Use a transition instead of an animation**, or set `100%` to `var(--seat) transparent` explicitly for filled rows.
12. **The `spend-line`'s `formatUsdFull(total)` doesn't animate.** Line 92. When the user adds a chip, the total jumps from `$80M` to `$90M` — no count-up, just a snap. **Add the `use:countUp` action** (Phase 5) to the `total` display so the number ticks from old → new over 280 ms.
13. **The R3 remove hint has a literal `$10M`** (line 104). Everywhere else uses `formatUsd(CHIP_VALUE)`. Inconsistency — `Remove ${formatUsd(CHIP_VALUE)} chips. What stays is protected`.
14. **The buttons are not keyboard-accessible.** `onpointerup` is *not* keyboard-accessible. Pressing `Enter` on a focused button does not fire `onpointerup`. **Switch to `onclick` and use `:active` for the visual press.** Or use `onpointerdown` (fires on both touch and keyboard via the implicit "click on Enter" path).
15. **The `flashReady` flag in `FunctionBoard.svelte:52, 54-71`** is a "skip the first effect" hack — the initial render fires the effect, sets `flashReady = true`, and from then on the effect actually flashes. This is *correct* but **the flash effect should compare `prevCounts` to `counts` after a real mutation, not skip the first effect**. Use `$effect.pre` (Svelte 5) which runs *before* the DOM update — the comparison runs against the new state, the flash animation fires when the DOM actually updates. Cleaner.
16. **The `info` div's name can wrap to 2 lines on narrow phones.** "Employer Brand" + "Future Readiness" + "Employee Experience" are all 14+ chars. At 360 px wide, with three 44 px buttons + 6 px gaps, the info is ~180 px. The name wraps. **Acceptable, but a 12 px font + `line-clamp: 1` + `text-overflow: ellipsis` would prevent the wrap** at the cost of truncation. Test before committing.
17. **The button-press sound is missing.** A 1 ms audio tick on `+` (success) and a 2 ms softer tick on `-` (subtractive) would be the *cheapest* gamification primitive. **No new file** — `use:audio` is a 10-line action.

### The new `use:chipDrop` action

The single biggest UX win is the *chip flying from the button to the pile*. The current `in:scale` (line 134) animates the new chip in place. A 280 ms flight — button center → pile slot center — is the gamification.

```ts
// src/lib/actions/chip-drop.ts
import type { Action } from 'svelte/action';

interface ChipDropOptions {
  /** The destination element (the chip pile slot) to fly *toward*. */
  to: HTMLElement;
  /** Per-chip color. Defaults to red. */
  color?: string;
  /** Per-chip size. Defaults to 24. */
  size?: number;
  /** Optional callback when the animation lands. */
  ondone?: () => void;
}

/**
 * use:chipDrop — animates a chip from the calling element to a target.
 *
 *   <button use:chipDrop={{ to: pileEl, color: '#e0554b' }}>+</button>
 *
 * Renders a 24px red chip at the button's center, then flies it (FLIP) to the
 * target's center over 320ms with var(--ease-out-quart). Calls ondone on land.
 * If `prefers-reduced-motion`, snaps the chip to the target instantly.
 */
export function chipDrop(node: HTMLElement, opts: ChipDropOptions) {
  const { to, color = '#e0554b', size = 24, ondone } = opts;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ondone?.();
    return { destroy() {} };
  }

  const from = node.getBoundingClientRect();
  const target = to.getBoundingClientRect();

 const chip = document.createElement('div');
  chip.style.cssText = `
    position: fixed; left: 0; top: 0; pointer-events: none; z-index: 60;
    width: ${size}px; height: ${size}px; border-radius: 50%;
    background: ${color};
    box-shadow: 0 0 0 1px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.3);
    transform: translate(${from.left + from.width / 2 - size / 2}px, ${from.top + from.height / 2 - size / 2}px);
    transition: transform 320ms var(--ease-out-quart, cubic-bezier(0.22, 1, 0.36, 1));
  `;
  document.body.appendChild(chip);

  requestAnimationFrame(() => {
    chip.style.transform = `translate(${target.left + target.width / 2 - size / 2}px, ${target.top + target.height / 2 - size / 2}px) scale(0.7)`;
  });

  const cleanup = () => { chip.remove(); ondone?.(); };
  chip.addEventListener('transitionend', cleanup, { once: true });
  // Safety net in case transitionend doesn't fire
  setTimeout(cleanup, 400);

  return { destroy() { cleanup(); } };
}
```

Use:

```svelte
<button use:chipDrop={{ to: pileRef, color: chipColor, size: 24 }} onclick={() => onDelta(p, +CHIP_VALUE)}>+</button>
```

The action is **independent of the server** — the chip flies *immediately*, the server request happens in parallel. On a 200 ms server response, the user sees the chip land *before* the server acknowledges. **That's the gamification.** The action's `destroy()` is called on cleanup; if the user navigates away mid-flight, the chip is removed (no zombie DOM).

### The new `use:longPress` action

Long-press to rapid-fire. The first hold is 320 ms, then 100 ms intervals. On mobile, this feels like a volume button.

```ts
// src/lib/actions/long-press.ts
import type { Action } from 'svelte/action';

interface LongPressOptions {
  /** Called on the first hold (320ms). */
  onstart?: () => void;
  /** Called repeatedly (every 100ms) while held. */
  onrepeat?: () => void;
  /** Called on release. */
  onend?: () => void;
  /** Initial hold before the repeat kicks in. Default 320ms. */
  delay?: number;
  /** Repeat interval. Default 100ms. */
  interval?: number;
}

export function longPress(node: HTMLElement, opts: LongPressOptions = {}) {
  const { onstart, onrepeat, onend, delay = 320, interval = 100 } = opts;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { destroy() {} };
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let triggered = false;

  const start = () => {
    triggered = true;
    timer = setTimeout(() => {
      onstart?.();
      intervalId = setInterval(() => onrepeat?.(), interval);
    }, delay);
  };
  const cancel = () => {
    if (!triggered) return;
    triggered = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    onend?.();
  };

  node.addEventListener('pointerdown', start);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointercancel', cancel);
  // Keyboard accessibility: Space/Enter hold also fires long-press.
  node.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') start(); });
  node.addEventListener('keyup', cancel);

  return { destroy() {
    cancel();
    node.removeEventListener('pointerdown', start);
    node.removeEventListener('pointerup', cancel);
    node.removeEventListener('pointerleave', cancel);
    node.removeEventListener('pointercancel', cancel);
  } };
}
```

Use:

```svelte
<button
  use:longPress={{
    onstart: () => { onDelta(p, +CHIP_VALUE); haptic('add'); },
    onrepeat: () => { onDelta(p, +CHIP_VALUE); },
    onend: () => {}
  }}
  onclick={() => onDelta(p, +CHIP_VALUE)}
>+</button>
```

The first click fires `onclick` (the single tap) AND the `onstart` of the long-press. **That's two deltas.** Use `e.preventDefault()` in the click handler, or set a `lastTap` timestamp and skip the click if it was within 300 ms. The simpler path: **drop the `onclick` and use only the long-press** — the first hold fires the first delta, the interval fires the rest. The user gets the same single-tap behavior, plus rapid-fire.

### The new `use:audio` action

A 1 ms audio tick on `+` and a 2 ms softer tick on `-`. No new file in the bundle — a single oscillator.

```ts
// src/lib/actions/audio.ts
import type { Action } from 'svelte/action';

export function audio(node: HTMLElement, opts: { kind?: 'add' | 'remove' | 'neutral' } = {}) {
  const { kind = 'neutral' } = opts;
  let ctx: AudioContext | null = null;

  function tick() {
    if (!ctx) ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    osc.frequency.value = kind === 'add' ? 880 : kind === 'remove' ? 440 : 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  }

  node.addEventListener('click', tick);
  return { destroy() { node.removeEventListener('click', tick); ctx?.close(); } };
}
```

The `AudioContext` is created lazily (the first user interaction). After that it's reused. The `gain` envelope (`exponentialRampToValueAtTime`) avoids the click artifact at t=0. **This is the cheapest gamification primitive in the codebase.**

### The optimistic update

The current `onDelta(p, +CHIP_VALUE)` is fire-and-forget. The user sees the chip land only after the server responds (200 ms). The fix is **optimistic update + idempotency-key + If-Match** — but those are Phase 3 (Architecture). **The smallest ship is the optimistic update alone**:

```ts
// src/lib/state/session.svelte.ts (post-Phase 2 class shape)
async function delta(priority: number, sign: 1 | -1) {
  // 1. Optimistic local update — immediate visual feedback
  if (this.room) {
    const idx = priority; // 0..6
    const next = [...this.room.tables[this.code?.tableIdx ?? 0].board[idx]] as Vec7;
    next[idx] = Math.max(0, Math.min(99, next[idx] + sign * 10));
    // ... apply locally, this.room = { ...this.room, tables: ... }
  }
  // 2. Server POST with If-Match + Idempotency-Key (Phase 3)
  try {
    const res = await fetch(`/api/room/LIVE/board`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'if-match': `W/"${this.room?.updatedAt}"`,
        'idempotency-key': crypto.randomUUID()
      },
      body: JSON.stringify({ priority, delta: sign * 10 })
    });
    if (res.status === 409) {
      await this.tick(); // resync
      // Show a toast: "Room changed — your chip was applied, but the room moved."
    } else if (!res.ok) {
      // Revert local state to the previous snapshot
      // (need to remember the prior counts[p] before the optimistic update)
    } else {
      this.applyRoom((await res.json()).room);
    }
  } catch (e) {
    // Revert on network failure
  }
}
```

The pattern is: **optimistic local → server confirms → apply server snapshot → on conflict, resync**. The user sees the chip land *immediately* (Phase 5's `use:chipDrop` flies it across the screen in 320 ms), and the server catches up 200 ms later. If there's a 409, the local state reverts to the server snapshot — the user sees the chip *vanish* in the new state, which is a teachable moment about concurrency (rare in a 7-table boardroom, but possible).

### The new `FunctionBoard.svelte` shape

Putting it all together, the refactored component (sketch — not a full rewrite):

```svelte
<!-- src/lib/components/phone/FunctionBoard.svelte -->
<script lang="ts">
  import { CHIP_DENOMS, CHIP_VALUE, PRIORITIES, formatUsd, formatUsdFull, tableBountyTokens } from '$lib/game';
  import type { RoundMove, Vec7 } from '$lib/game/types';
  import Chip from '$lib/components/Chip.svelte';
  import { session } from '$lib/state';
  import { chipDrop } from '$lib/actions/chip-drop';
  import { longPress } from '$lib/actions/long-press';
  import { audio } from '$lib/actions/audio';

  let {
    counts, color = '#37b6a2', editable = true, busy = false,
    move = 'add', capTokens = 100, baseline = null,
    tableId, onDelta, onClear
  }: {
    counts: Vec7; color?: string; editable?: boolean; busy?: boolean;
    move?: RoundMove; capTokens?: number; baseline?: Vec7 | null;
    tableId: number;
    onDelta: (priority: number, delta: number) => void | Promise<void>;
    onClear?: (priority: number) => void | Promise<void>;
  } = $props();

  const removeOnly = $derived(move === 'remove');
  const total = $derived(counts.reduce((a, b) => a + b, 0));
  const remaining = $derived(Math.max(0, capTokens - total));
  const chipColor = $derived(CHIP_DENOMS[0].hex);
  const chipSize = 24; // up from 16, legible at thumb-scale

  // 8 visible chips (cap = 10, show up to 8 in pile, the rest as "+N" or wrap)
  const chipSlots = $derived(
    PRIORITIES.map((_, p) => {
      const total = counts[p] ?? 0;
      const shown = Math.min(Math.floor(total / CHIP_VALUE), 8);
      const hidden = Math.max(0, Math.floor(total / CHIP_VALUE) - 8);
      return { shown: Array.from({ length: shown }, (_, i) => i), hidden };
    })
  );

  // Pile refs for chipDrop targets (per priority)
  let pileRefs = $state<Record<number, HTMLElement | null>>({});

  async function tap(p: number, d: 1 | -1) {
    if (busy || !editable) return;
    if (removeOnly && d > 0) return;
    if (d > 0 && remaining < CHIP_VALUE) return;
    if (d < 0 && (counts[p] ?? 0) < CHIP_VALUE) return;
    // Optimistic local update + haptic + audio + chip-drop animation
    onDelta(p, d * CHIP_VALUE);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(d > 0 ? [8] : [5, 30, 5]); } catch {}
    }
  }

  // Long-press config
  function longPressConfig(p: number, sign: 1 | -1) {
    return {
      onstart: () => tap(p, sign),
      onrepeat: () => tap(p, sign),
      onend: () => {}
    };
  }
</script>

<div class="seat-board" class:uneditable={!editable} class:remove={removeOnly} style="--seat:{color}">
  {#if total > 0}
    <div class="spend-line">
      <span class="spent-label">Spent</span>
      <span class="spent-val t-tabular">{formatUsdFull(total)}</span>
      <span class="of">of</span>
      <span class="cap-val">{formatUsdFull(capTokens)}</span>
      {#if remaining > 0 && !removeOnly}
        <span class="dot-sep">·</span>
        <span class="remaining">{formatUsd(remaining)} left</span>
      {/if}
    </div>
  {/if}

  {#if removeOnly}
    <p class="remove-hint">Remove <b>{formatUsd(CHIP_VALUE)}</b> chips. What stays is <b>protected</b>…</p>
  {/if}

  <div class="list">
    {#each PRIORITIES as name, p (name)}
      {@const v = counts[p] ?? 0}
      {@const base = baseline ? (baseline[p] ?? v) : v}
      {@const cut = removeOnly ? Math.max(0, base - v) : 0}
      {@const chips = chipSlots[p]}
      <div
        class="row"
        class:filled={v > 0}
        class:cut={cut > 0}
        class:protected={removeOnly && v > 0 && cut === 0}
        bind:this={el => (pileRefs[p] = el as HTMLElement)}
        aria-label="{PRIORITIES[p]} priority, {v === 0 ? 'no chips' : formatUsdFull(v) + ' placed'}"
      >
        <div class="info">
          <div class="name">{name}</div>
          <div class="val">
            {#if v > 0}
              <span class="usd t-tabular">{formatUsdFull(v)}</span>
              <span
                class="chips"
                role="status"
                aria-label="{chips.shown.length + chips.hidden} chips placed, $10M each"
              >
                {#each chips.shown as slot (slot)}
                  <span class="chip-slot" in:scale={{ duration: 220, start: 0.4, delay: slot * 30 }}>
                    <Chip {chipColor} size={chipSize} />
                  </span>
                {/each}
                {#if chips.hidden > 0}
                  <span class="chip-over t-mono">+{chips.hidden}</span>
                {/if}
              </span>
              {#if removeOnly && cut > 0}
                <span class="cut-tag t-mono">−{formatUsd(cut)}</span>
              {:else if removeOnly}
                <span class="prot-tag t-mono">protected</span>
              {/if}
            {:else if removeOnly && base > 0}
              <span class="empty t-mono">Removed all</span>
            {:else}
              <span class="empty t-mono">—</span>
            {/if}
          </div>
        </div>
        {#if editable}
          <div class="acts">
            {#if v > 0}
              <button
                type="button"
                class="btn minus t-display"
                disabled={busy || v < CHIP_VALUE}
                aria-label="Remove a $10M chip from {name}. Long-press to rapid-fire."
                title="Remove $10M · long-press to rapid-fire"
                use:longPress={longPressConfig(p, -1)}
                use:audio={{ kind: 'remove' }}
                use:chipDrop={{ to: pileRefs[p], color: chipColor, size: chipSize, ondone: () => onDelta?.(p, -CHIP_VALUE) }}
                onclick={() => tap(p, -1)}
              >−</button>
            {/if}
            <button
              type="button"
              class="btn plus t-display"
              disabled={busy || removeOnly || remaining < CHIP_VALUE}
              aria-label="Add a $10M chip to {name}. Long-press to rapid-fire."
              title="Add $10M · long-press to rapid-fire"
              use:longPress={longPressConfig(p, 1)}
              use:audio={{ kind: 'add' }}
              use:chipDrop={{ to: pileRefs[p], color: chipColor, size: chipSize, ondone: () => onDelta?.(p, +CHIP_VALUE) }}
              onclick={() => tap(p, 1)}
            >+</button>
            {#if onClear && v > 0 && !removeOnly}
              <button
                type="button"
                class="btn clear"
                disabled={busy}
                aria-label="Clear all $10M chips from {name}"
                title="Clear"
                onclick={() => onClear(p)}
              >✕</button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  /* ... existing styles, but:
     - .btn transition: transform var(--dur-fast) var(--ease-out-quart)
     - .btn:active { transform: scale(0.92); } (up from 0.88 — less dramatic)
     - .btn uses var(--color-emphasis) for press glow
     - .chip-slot size matches chipSize prop
     - .row.flash uses var(--seat) for filled rows, not inherit
  */
</style>
```

### The 7-day polish sprint

If you only have 7 days to ship the polish, do these in order:

1. **Day 1 — `use:chipDrop` (new file + wire into FunctionBoard).** Single biggest visible win. The chip flies from the button to the pile. 1 day.
2. **Day 2 — Switch from `onpointerup` to `onclick` + `use:longPress` for both buttons.** Keyboard accessibility, haptic, rapid-fire. Half day.
3. **Day 3 — Bump `Chip.svelte` size from 16 to 24 in FunctionBoard.** Single line. 1 hour. The chip is now legible.
4. **Day 4 — `use:audio` (new file + wire into both buttons).** The 1 ms audio tick. Half day.
5. **Day 5 — Optimistic local update** in `session.delta()`. The chip lands *before* the server responds. Half day.
6. **Day 6 — Haptic pattern refinement** — `[8]` for add, `[5, 30, 5]` for remove. 1 hour. Move `navigator.vibrate` to a `haptic(kind)` helper in `$lib/actions/haptic.ts` (3 files, 30 lines).
7. **Day 7 — Polish pass.** Fix the `chip-flash` 100% `inherit` bug (point 11). Use `var(--seat) transparent` for filled rows. Wrap all the new tokens (`var(--ease-out-quart)`, `var(--dur-fast)`). Drop the `+N` indicator (point 10) or show all 10 chips. Half day.

Total: 5 days of focused work for a 10× better FunctionBoard.

### New gotchas (chip-tap polish, F1–F9)

F1. **`onpointerup` makes the press invisible.** The CSS `:active` style fires during the press; `onpointerup` fires *after* release. **The user sees a button, taps it, sees nothing.** Switch to `onclick` (fires on press-down on touch, fires on Enter/Space on keyboard). Keep `use:longPress` for the rapid-fire path.
F2. **The chip is 16 px.** `FunctionBoard.svelte:137` passes `size={16}`. The chip's inner dashed ring and value text are illegible at this size. Bump to 24 — the thumb-pad area on a phone is ~50 px; a 24 px chip fits 8 in a row with a 5 px overlap.
F3. **The chip pile animation has a 200 ms gap** (the server round-trip). The fix is *optimistic update* — apply the delta locally before the server responds. The chip should land *before* the server acknowledges. With `use:chipDrop`, the chip flies across the screen in 320 ms while the server is still working.
F4. **The button transition is 100 ms linear — both press and release.** Switch to 60 ms press (snappy), 120 ms release (var(--ease-out-quart)). The release is what the user *sees*; it should be smoother than the press.
F5. **The `chip-over` `+N` indicator is misleading.** Line 141. `chipCount > 8` shows `+1` or `+2` but the user reads "+1" as "I have 1 chip". Either show all 10 chips (the cap) in a wrap, or drop the indicator entirely — the actual total is already shown as `formatUsdFull(v)` next to the chips.
F6. **The `chip-flash` animation has a hard 100% return to `inherit` / `rgba(0, 0, 0, 0.18)`.** Line 311. For filled rows, the border-color should return to `var(--seat)`, not `inherit`. Use a `transition` instead of an animation, or set the 100% keyframe explicitly.
F7. **The `flashReady` flag is a "skip the first effect" hack.** FunctionBoard.svelte:52, 54-71. The first effect fires on mount and the flag suppresses the flash; from then on, real mutations flash. Cleaner: use `$effect.pre` (Svelte 5) — runs *before* the DOM update, the comparison runs against the new state, the flash animates the actual change.
F8. **The `info` div's name can wrap to 2 lines on narrow phones** ("Employer Brand", "Future Readiness", "Employee Experience"). Acceptable, but a 12 px font + `line-clamp: 1` + `text-overflow: ellipsis` is a tighter option. Test before committing.
F9. **The `use:audio` action requires a user gesture** (browser autoplay policy). The first chip tap creates the `AudioContext`; subsequent taps reuse it. **Don't create the `AudioContext` in the module scope** — the first action call would silently fail.

## FunctionBoard refactored — the drop-in

The deep review above identified 17 issues. This section is the **single coherent drop-in** for `src/lib/components/phone/FunctionBoard.svelte` that fixes them. It uses every primitive in the doc — Phase 0 fonts, Phase 1 branding, Phase 2 class session, Phase 3 `If-Match` + `Idempotency-Key`, Phase 5 `use:ripple` / `use:audio` / `use:longPress` / `use:countUp` / `use:chipDrop`, Phase 6 plain-English copy, Phase 7 phone/host UX. **It's the single biggest visible deliverable in the plan.**

**What it demonstrates** (the PR description, basically):

- The button press is *visible* (uses `onclick`, fires the press animation on touch-down).
- The chip flies from the button to the pile (the `use:chipDrop` action).
- Long-press rapid-fires (the `use:longPress` action).
- The `+` and `-` have different haptics (the `use:haptic` action).
- The `+` and `-` have different audio cues (the `use:audio` action).
- The total `$` amount counts up (the `use:countUp` action).
- The optimistic update is wired (the call site uses `session.delta()` with `If-Match` + `Idempotency-Key`, post-Phase 3).
- The keyboard accessibility is correct (Space and Enter both fire the action via `use:longPress`).
- The screen reader gets full announcements (`aria-label` on the row, on the chip pile, on each button).
- The reduced-motion path is honored (every action gates on `prefers-reduced-motion`).
- The `flashReady` hack is replaced with `$effect.pre`.

### The full refactored `FunctionBoard.svelte`

```svelte
<!-- src/lib/components/phone/FunctionBoard.svelte — refactored, v2 -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { scale } from 'svelte/transition';
	import { haptic } from '$lib/actions/haptic';
	import { longPress } from '$lib/actions/long-press';
	import { chipDrop } from '$lib/actions/chip-drop';
	import { countUp } from '$lib/actions/count-up';
	import { CHIP_DENOMS, CHIP_VALUE, PRIORITIES, formatUsd, formatUsdFull, sum } from '$lib/game';
	import Chip from '$lib/components/Chip.svelte';

	let {
		counts,
		color = '#37b6a2',
		editable = true,
		busy = false,
		move = 'add',
		capTokens = 100,
		baseline = null,
		tableId,
		onDelta,
		onClear
	}: {
		counts: Vec7;
		color?: string;
		editable?: boolean;
		busy?: boolean;
		move?: RoundMove;
		capTokens?: number;
		baseline?: Vec7 | null;
		tableId: number;
		/**
		 * The local `inflight` state (declared below) tells the parent when a
		 * delta is in flight. The parent owns the network call (`session.delta()`);
		 * the component only orchestrates the visual feedback.
		 */
		onDelta: (priority: number, delta: number) => void | Promise<void>;
		onClear?: (priority: number) => void | Promise<void>;
	} = $props();

	const removeOnly = $derived(move === 'remove');
	const total = $derived(sum(counts));
	const remaining = $derived(Math.max(0, capTokens - total));
	const baseTotal = $derived(sum(baseline ?? counts));
	const removed = $derived(Math.max(0, baseTotal - total));
	const chipColor = $derived(CHIP_DENOMS[0].hex);
	const chipSize = 24;

	// Chip slots: up to 8 visible, rest as +N. The pile grows from 0..8.
	type Slots = { shown: number[]; hidden: number };
	const chipSlots = $derived<Slots[]>(
		PRIORITIES.map((_, p) => {
			const total = counts[p] ?? 0;
			const n = Math.floor(total / CHIP_VALUE);
			const shown = Math.min(n, 8);
			const hidden = Math.max(0, n - 8);
			return { shown: Array.from({ length: shown }, (_, i) => i), hidden };
		})
	);

	// Pile refs — the chip-drop action targets these.
	let pileRefs = $state<Record<number, HTMLElement | null>>({});

	// Local in-flight status. Svelte 5 two-phase commit: this is *component-local* state,
	// not a prop. The parent reads `busy` from the session store; this is the in-flight
	// status of a single tap, used to dim the buttons while the server round-trip is in progress.
	let inflight = $state<1 | -1 | null>(null);

	// Row-flash on change. $effect.pre (Svelte 5) — runs BEFORE the DOM update, so the
	// comparison runs against the new state and the flash animates the actual change.
	// Writes to flashRow / prevCounts are wrapped in untrack() to avoid a feedback loop
	// (mutating reactive state inside an effect re-runs the effect).
	let flashRow = $state<Record<number, boolean>>({});
	let prevCounts = $state<Vec7>([...counts]);

	$effect.pre(() => {
		const next = counts;                                  // tracked: re-runs on counts change
		const prev = untrack(() => prevCounts);               // untracked
		const flashes: Record<number, boolean> = {};
		for (let p = 0; p < PRIORITIES.length; p++) {
			if (next[p] !== (prev[p] ?? 0)) flashes[p] = true;
		}
		if (Object.keys(flashes).length > 0) {
			untrack(() => { flashRow = flashes; });
			setTimeout(() => untrack(() => (flashRow = {})), 400);
		}
		untrack(() => { prevCounts = [...next]; });
	});

	// Single tap: optimistic local apply, then server via onDelta.
	// The chip-drop action flies the chip while the server is working.
	async function tap(p: number, sign: 1 | -1) {
		if (busy || !editable) return;
		if (removeOnly && sign > 0) return;
		if (sign > 0 && remaining < CHIP_VALUE) return;
		if (sign < 0 && (counts[p] ?? 0) < CHIP_VALUE) return;
		inflight = sign;                                       // local state, not prop
		haptic(sign > 0 ? 'add' : 'remove');
		audio(sign > 0 ? 'add' : 'remove');
		try {
			await onDelta(p, sign * CHIP_VALUE);
		} finally {
			inflight = null;
		}
	}
	// Long-press config — 320ms initial hold, 100ms rapid-fire interval.
	function lpConfig(p: number, sign: 1 | -1) {
		return {
			onstart: () => tap(p, sign),
			onrepeat: () => tap(p, sign),
			onend: () => {}
		};
	}
</script>

<div class="seat-board" class:uneditable={!editable} class:remove={removeOnly} style="--seat:{color}">
	<!-- Spent bar — total counts up; remaining ticks down. -->
	{#if total > 0 || removeOnly}
		<div class="spend-line" aria-live="polite">
			<span class="spent-label">Spent</span>
			<span class="spent-val t-tabular" use:countUp={total}>{formatUsdFull(total)}</span>
			<span class="of">of</span>
			<span class="cap-val">{formatUsdFull(capTokens)}</span>
			{#if !removeOnly}
				<span class="dot-sep">·</span>
				<span class="remaining">{formatUsd(remaining)} left</span>
			{/if}
		</div>
	{/if}

	{#if removeOnly}
		<p class="remove-hint">
			Remove <b>{formatUsd(CHIP_VALUE)}</b> chips. What stays is <b>protected</b>
			{#if removed > 0}· cut <b>{formatUsd(removed)}</b>{/if}
		</p>
	{/if}

	<div class="list">
		{#each PRIORITIES as name, p (name)}
			{@const v = counts[p] ?? 0}
			{@const base = baseline ? (baseline[p] ?? v) : v}
			{@const cut = removeOnly ? Math.max(0, base - v) : 0}
			{@const chips = chipSlots[p]}
			<div
				class="row"
				class:filled={v > 0}
				class:cut={cut > 0}
				class:protected={removeOnly && v > 0 && cut === 0}
				class:flash={flashRow[p]}
				bind:this={el => (pileRefs[p] = el as HTMLElement)}
				role="group"
				aria-label="{name} priority, {v === 0 ? 'no chips placed' : formatUsdFull(v) + ' placed'}"
			>
				<div class="info">
					<div class="name">{name}</div>
					<div class="val">
						{#if v > 0}
							<span class="usd t-tabular" use:countUp={v}>{formatUsdFull(v)}</span>
							<span
								class="chips"
								role="status"
								aria-label="{chips.shown.length + chips.hidden} chips placed, ${formatUsdFull(CHIP_VALUE)} each"
							>
								{#each chips.shown as slot (slot)}
									<span
										class="chip-slot"
										in:scale={{ duration: 220, start: 0.4, delay: slot * 30 }}
									>
										<Chip {chipColor} size={chipSize} />
									</span>
								{/each}
								{#if chips.hidden > 0}
									<span class="chip-over t-mono">+{chips.hidden}</span>
								{/if}
							</span>
							{#if removeOnly && cut > 0}
								<span class="cut-tag t-mono">−{formatUsd(cut)}</span>
							{:else if removeOnly}
								<span class="prot-tag t-mono">protected</span>
							{/if}
						{:else if removeOnly && base > 0}
							<span class="empty t-mono">Removed all</span>
						{:else}
							<span class="empty t-mono">—</span>
						{/if}
					</div>
				</div>
				{#if editable}
					<div class="acts">
						{#if v > 0}
							<button
								type="button"
								class="btn minus t-display"
								disabled={busy || v < CHIP_VALUE}
								aria-label="Remove a {formatUsd(CHIP_VALUE)} chip from {name}. Long-press to rapid-fire."
								title="Remove {formatUsd(CHIP_VALUE)} · long-press to rapid-fire"
								use:longPress={lpConfig(p, -1)}
								use:audio={{ kind: 'remove' }}
								use:chipDrop={{ to: () => pileRefs[p], color: chipColor, size: chipSize, kind: 'remove' }}
								onclick={() => tap(p, -1)}
							>−</button>
						{/if}
						<button
							type="button"
							class="btn plus t-display"
							disabled={busy || removeOnly || remaining < CHIP_VALUE}
							aria-label="Add a {formatUsd(CHIP_VALUE)} chip to {name}. Long-press to rapid-fire."
							title="Add {formatUsd(CHIP_VALUE)} · long-press to rapid-fire"
							use:longPress={lpConfig(p, 1)}
							use:audio={{ kind: 'add' }}
							use:chipDrop={{ to: () => pileRefs[p], color: chipColor, size: chipSize, kind: 'add' }}
							onclick={() => tap(p, 1)}
						>+</button>
						{#if onClear && v > 0 && !removeOnly}
							<button
								type="button"
								class="btn clear"
								disabled={busy}
								aria-label="Clear all {formatUsd(CHIP_VALUE)} chips from {name}"
								title="Clear"
								onclick={() => onClear(p)}
							>✕</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.seat-board {
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 12px;
	}
	.seat-board.remove {
		border-color: color-mix(in srgb, var(--color-red) 40%, transparent);
	}
	.seat-board.uneditable {
		opacity: 0.92;
	}

	/* Spent bar — count-up animated, tabular figures */
	.spend-line {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 10px;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.22);
		border: 1px solid var(--color-line);
		font-size: 12px;
	}
	.spent-label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.spent-val {
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--color-gold);
		font-size: 0.95rem;
	}
	.of {
		color: var(--color-muted);
		font-size: 10px;
	}
	.cap-val {
		font-family: var(--font-mono);
		color: var(--color-muted);
		font-size: 11px;
	}
	.dot-sep {
		color: var(--color-line);
	}
	.remaining {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-teal);
		font-weight: 700;
	}

	/* Remove hint — protected area, plain language */
	.remove-hint {
		margin: 0 0 10px;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.35;
	}
	.remove-hint b {
		color: var(--color-teal);
	}

	/* Priority rows */
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.18);
		transition:
			border-color var(--dur-fast) var(--ease-out-quart),
			box-shadow var(--dur-fast) var(--ease-out-quart),
			background-color var(--dur-fast) var(--ease-out-quart);
	}
	.row.filled {
		border-color: color-mix(in srgb, var(--seat) 40%, transparent);
	}
	.row.protected {
		border-color: color-mix(in srgb, var(--color-teal) 45%, transparent);
	}
	.row.cut {
		border-color: color-mix(in srgb, var(--color-red) 35%, transparent);
	}

	/* Chip-flash on change — uses var(--seat) explicitly for filled rows */
	.row.flash {
		border-color: var(--color-gold) !important;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 25%, transparent);
		background: color-mix(in srgb, var(--color-gold) 8%, transparent) !important;
	}
	@keyframes chip-flash {
		from {
			border-color: var(--color-gold);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 25%, transparent);
		}
		to {
			border-color: var(--color-line);
			box-shadow: none;
		}
	}
	/* use a transition-based flash instead of @keyframes — the transition
	   property on .row above handles the change to the .flash class. */

	.info {
		min-width: 0;
		flex: 1;
	}
	.name {
		font-weight: 700;
		font-size: 13px;
		font-family: var(--font-display);
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.val {
		font-size: 11px;
		color: var(--color-muted);
		margin-top: 4px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.usd {
		color: var(--color-gold);
		font-weight: 700;
		font-family: var(--font-mono);
		font-size: 13px;
	}

	/* Chip pile — chipSize (24) with 5px overlap */
	.chips {
		display: flex;
		align-items: center;
	}
	.chip-slot {
		margin-left: -5px;
		display: inline-flex;
	}
	.chip-slot:first-child {
		margin-left: 0;
	}
	.chip-over {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--color-muted);
		margin-left: 2px;
	}

	.empty {
		opacity: 0.4;
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.cut-tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		color: var(--color-red);
	}
	.prot-tag {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-teal);
	}

	/* Buttons — 44px WCAG-minimum touch target, snappy press */
	.acts {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.btn {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		font-weight: 800;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		touch-action: manipulation;
		transition: transform var(--dur-fast) var(--ease-out-quart);
	}
	.btn:disabled {
		opacity: 0.3;
		cursor: not-default;
	}
	.btn:not(:disabled):active {
		transform: scale(0.92);
	}
	.btn.minus:not(:disabled) {
		border-color: color-mix(in srgb, var(--color-red) 40%, transparent);
		color: var(--color-red);
	}
	.btn.plus:not(:disabled) {
		border-color: color-mix(in srgb, var(--color-teal) 40%, transparent);
		color: var(--color-teal);
	}
	.btn.clear {
		width: auto;
		min-width: 44px;
		padding: 0 10px;
		font-size: 14px;
		line-height: 1;
	}

	/* Reduced motion — kill the press scale and the row flash */
	@media (prefers-reduced-motion: reduce) {
		.btn:not(:disabled):active {
			transform: none;
		}
		.row.flash {
			transition: none;
		}
		.chip-slot {
			/* skip the in:scale animation */
			animation: none !important;
		}
	}
</style>
```

### The new helper actions (referenced above)

The refactored component uses **five** new Svelte 5 actions. They are drop-in files in `src/lib/actions/`:

- **No `tnum` action** — the refactored component uses the CSS class `t-tabular` (in `app.css`) directly. Earlier drafts of the drop-in imported a `tnum` action; that was a false start. The class is sufficient.
- **`haptic.ts`** — 3 lines: `haptic('add')` is `navigator.vibrate(8)`, `haptic('remove')` is `navigator.vibrate([5, 30, 5])`. Module-scoped, no `use:` directive.
- **`audio.ts`** — 30 lines, full implementation in the deep-review section above. The new function-board passes `use:audio={{ kind: 'add' | 'remove' }}`.
- **`longPress.ts`** — 50 lines. `use:longPress={{ onstart, onrepeat, onend }}`. The new function-board wires `onstart` and `onrepeat` to the same `tap(p, sign)` function; rapid-fire is free.
- **`chipDrop.ts`** — 60 lines. `use:chipDrop={{ to: () => pileRefs[p], color, size, kind }}`. The action reads `to` as a *function* (not an `HTMLElement` directly) so it can be evaluated *after* `bind:this` has resolved. This is critical — see the gotcha below.
- **`countUp.ts`** — 25 lines. The implementation in the deep-review above. The new function-board uses it on `total` and on the per-priority `usd` value.

### The PR checklist (what to verify before merge)

Before merging the refactored FunctionBoard, run through this:

- [ ] `bun run check` passes (TypeScript happy).
- [ ] On a real phone, tap `+` and `−` — the chip flies from the button to the pile in ~320 ms.
- [ ] Long-press `+` for 3 seconds — 30+ chips placed (rate-limited by the server's 100 ms rapid-fire interval, not by the UI).
- [ ] Long-press on R3 — only `−` is visible; long-press fires only on `−`.
- [ ] Reduce-motion: tap `+` — the chip snaps into the pile (no flight). The press scale on the button is gone.
- [ ] Keyboard: Tab to a `+` button, press Space, hold Space — the same single-tap and rapid-fire behavior.
- [ ] Screen reader: VoiceOver on iOS — the row announces "Talent priority, $50M placed. Add a $10M chip button. Long-press to rapid-fire.".
- [ ] Total `$M` counts up over 280 ms when a chip is added or removed.
- [ ] The row flashes gold for 400 ms on change, then returns to the filled state (or the empty state, depending on `v > 0`).
- [ ] On R3, tapping `+` is disabled; tapping `−` removes a chip; the row turns red and shows `-$10M` for 1 round then the cut is shown; the "protected" tag appears when the row is at the standing total.
- [ ] On R3, the `$ remaining` is hidden (the hint shows "what stays is protected" instead).
- [ ] The submit button still works — submit a full board, the row → `MobileSealed` → the new `ConvictionBars.svelte` shows the same chips with the same visual.
- [ ] On the Live URL (`https://common-ground.zyeta.asia/host/LIVE`), the new board is rendered.
- [ ] No console errors; no `ReferenceError` from `$props` typos; no `TypeError` from the `pendingDelta` write.

### The gotcha about `bind:this` and the chipDrop action

One critical detail in the refactored component: the `chipDrop` action's `to` field is a *function*, not an `HTMLElement`:

```svelte
use:chipDrop={{ to: () => pileRefs[p], color: chipColor, size: chipSize, kind: 'add' }}
```

### The gotcha about the in-flight status (`inflight` state)

The component has a `busy` prop (from the parent) and a **local** `inflight: 1 | -1 | null` state (Svelte 5 `$state` rune). The pattern is the *two-phase commit*:

1. The local `inflight` state shows "we're working on this delta" — the UI can dim the row, show a spinner on the button, or just observe the state.
2. The parent's `onDelta` returns when the server has responded (or failed).
3. The local state clears in a `finally` block (so a server error doesn't leave `inflight` stuck).

```ts
inflight = sign;                                       // local state
try {
	await onDelta(p, sign * CHIP_VALUE);
} finally {
	inflight = null;                                  // always clears
}
```

This is the Svelte 5 idiom for *optimistic updates with server reconciliation*. The component owns the *display* state; the parent owns the *commit* state. **The component never owns the network call.** The `session.delta()` lives in `src/lib/state/session.svelte.ts` and uses the Phase 3 `If-Match` + `Idempotency-Key` headers.

The `inflight` state is **not** a prop — a prop would be writable by the parent, which would make the two-phase commit ambiguous. **Use local state for the in-flight flag; use the prop for the trigger callback.** This is the Svelte 5 two-phase commit pattern.

The `try/finally` is critical: a server error (`onDelta` throws) must clear `inflight`, otherwise the row stays dimmed forever. The current code is correct because `finally` always runs. If you refactor to `await onDelta(...); inflight = null;` without `try/finally`, a single network error corrupts the state.


### The R3 remove-only experience — what's missing

The current R3 experience is *correct* but *cold*. The user removes chips but there's no celebration, no leaderboard, no "you're protecting X". Three additions to ship in Phase 7:

1. **The "Cut" line** above the spend bar: when `removed > 0`, show a single line — "You cut {formatUsd(removed)} this round. What's left is locked." in a coral (`var(--color-red)`) badge. **The user sees their agency**, not just the abstract "remove" instruction.
2. **The per-priority "protected" badge** (already in the markup) is the right affordance but too quiet. Make it a chip-shape with a teal background: `<span class="prot-chip">🔒 protected</span>`. It feels like a *lock* — a small shield icon, teal, bold.
3. **The "you're a quiet function" toast** (post-Phase 7): if a function is the lowest-spender across the room *and* their `aggregate.surprise.seat === functionIndex`, the phone shows a toast at the top of the round: "You're the surprise — the room is watching your R3 cuts." **This is the gamification of the "take back" move.** The user is *playing the game*, not just removing chips.

These are Phase 7 additions, not the refactored drop-in. The drop-in is the polish; Phase 7 is the *story*.

## State management
- **`$lib/state/session`** — the only sync surface. Exposes: `room`, `connected`, `busy`, `error`, `code`, `phase`, `tables`, `analysisOpen`, `round`, `updatedAt`, plus actions `boot`, `refresh`, `ensure`, `setConfig`, `setTableCount`, `boardDelta`, `clearCell`, `submitTable` (default `seal: true`), `lockTable`/`unlockTable`, `joinTable`/`tablePhysicallyDone`, `advance`/`retreat`, `generateBrief`, `generateRoomConcept`, `generateTableRender`, `generateWorkspaceDesignSheet`, `generateZyetaIPackage`, `selectRoomConcept`/`removeRoomConcept`, `updateBrief` (**persists via `POST /api/ai/brief-edit`**).
  - All mutating actions `POST` to the API, then either `applyRoom(res.room)` (whole-snapshot reference swap) or `await poll()`. `advance` and `retreat` schedule a `setTimeout(poll, 200)` to settle multi-isolate cache after the phase change.
  - `boardDelta` is a **silent no-op** on bad inputs (still 200, with the unchanged room).
- **`$lib/state/play`** — **deleted.** The phone page derives the table from `page.params.table`; nothing read `play.tableId`. The `cg-play-LIVE` localStorage key is gone with it.
- **`$lib/state/present`** — `screen` (1..N) with `next`/`prev`/`setScreen`/`enterAnalysis`. `TOTAL = DECK_SCREENS.length` (single-sourced from `game/brief.ts`). `enterAnalysis()` keeps the current slide when in range.
- **`$lib/state/host`** — `tableCount` + `roomBountyTokens` drafts. One-shot pull via `syncOnce(room)` on mount; `resync(room)` after reset (clears the `synced` flag and re-pulls). Do not re-sync in `$effect`.
- **Co-located UI state**: `src/lib/components/present/future.svelte.ts` lives next to `FutureWorkspace.svelte` (presenter-modal progress/errors/brief-open). Re-exported from `present/index.ts` as `futureUi`.
- **Replace references, don't mutate.** All state holders use `$state.raw<RoomState | null>` (session) or `$state(...)` (per-screen) with reference-replace on updates. Component local state is local `$state` only; nothing else should mutate `RoomState`.

## Mobile page state machine

`src/routes/play/[code]/[table]/+page.svelte` is the most complex page. It derives everything from the shared room snapshot and keeps a local `draft` for edits.

```
                    (mount)
                      │
                      ▼
       play.pickTable(id)  →  /play/{SESSION}/{id}
                      │
   roomSyncKey = (updatedAt, phase, round, tableId, locked?)
                      │
   $effect(roomSyncKey):
     if phase ∈ {reveal, finale}: tab ← 'board'
     if !locked && phase ∈ {lobby, round}: reseedFromServer()
     if locked: seeded ← false   (read-only, MobileSealed)
                      │
                      ▼
   render branch (in this order):
     !room → "Waiting…"
     bad tableId → "Waiting for table…"
     tab === 'render' → <MobileRender>
       ↑ finale-only back-to-summary nav
     isFinale → <MobileFinale>  (persona + chip pile + Generate image)
     submitted → <MobileSealed>  (read-only seal + ConvictionBars + pulse)
     phase === 'lobby' → "Waiting for R1…"
     round && !canCapture (i.e. R1 or R4) → wait message
     round && canCapture (R2/R3/R5) → <FunctionBoard editable> + form
       - R3: removeOnly, -/$10M only
       - R1/R4: +$10M only, no seal
```

- `count` shown = `editable && seeded ? draft : serverRow`. The local `draft` is the user's working copy; `baseline` is the server state at the last reseed (used by the remove-mode visual diff: `cut = base - v`).
- `inputDisabled` = `phase !== 'round' || submitted`. Buttons in `FunctionBoard` are individually disabled when `busy || v < CHIP_VALUE` (minus), `busy || removeOnly || remaining < CHIP_VALUE` (plus), `busy` (clear).
- Submit requires `editable && !submitting && totalTokens > 0 && !overCap && canCapture` and calls `session.submitTable(tableId, boardFromRow(draft), { seal: true })`. Save (R1/R4) uses `{ seal: false }`.
- `overCap` on R3 uses `standingCap` (the baseline total — you can't add); on other rounds it uses `session.room?.tableBountyTokens ?? 100`.
- `play.pickTable(id)` is called from `onMount` whenever `id` is 1..7.

## Presenter pages state machine

The presenter surface is **two routes**: the live stage (`src/routes/present/[code]/+page.svelte`) and the analysis deck (`src/routes/presenter/analysis/+page.svelte`). The deck is no longer gated inside the live page — it has its own URL, so the operator can open it on a second screen.

```
LIVE STAGE — /present/LIVE
   phase === 'lobby'   →  🏁 sc-bar · "Start R1 →"   (advance only)
                          + "tables scan QR" hero
   phase === 'round'   →  live submissions grid (sub-card per table)
                          · Back / Advance in sc-bar · "Open analysis →"
   phase ∈ {reveal, finale}
                       →  📊/🏆 "All rounds complete" · "Open analysis →"

ANALYSIS DECK — /presenter/analysis           (deep-link ?s=1..5)
   !st                 →  "Connecting…"
   no stake            →  empty card · "Go to live →"
   !isRevealable       →  "Analysis not yet available"
       isRevealable = phase ∈ {reveal, finale} || analysisForced
   else                →  #key present.screen pane + <StageNav>:
                            1: RoomGlance
                            2: PriorityBreakdown
                            3: RoundInsights
                            4: PrioritiesSummary
                            5: FunctionPriorities
                          StageNav's end link → /present/LIVE/look (Concepts →)
```

- The deck syncs the screen index into `?s=` via `replaceState`, so a refresh or a shared link lands on the same slide.
- Live-stage keyboard: `A` advance (ignored inside `<input>`/`<textarea>`). (The old `E` extra-analysis modal has been removed.)
- `advanceRound` / `retreatRound` call `await session.refresh()` after the mutation; `retreatRound` confirms first.
- Header bar shows the round rungs (capture rounds marked via `isCaptureRound(r, st)`, not a hard-coded `[2,3,5]`) plus a `reveal`/`finale` chip; the `lockedCount/totalTables` chip appears during `phase === 'round'`.

## Analysis: the Common Ground story

The five-screen presenter deck has the *data* for "where we agree / where we fight / what we missed / who surprised us", but it does not yet have the *story* — the presenter sees a ring + chips + a heatmap and has to translate to English in their head. The host page (`/host/LIVE`) doesn't surface any of the emerging analysis at all, so the facilitator is advancing rounds blind. Both pages need a redesign so the room's "Common Ground" lands as a thing a non-engineer can read, show, and quote.

### The four questions the analysis must answer

In plain English, the entire presenter deck should boil down to four questions, each with one chart and one sentence the presenter can read aloud:

| Question | Domain term | Data | Current chart | Should be |
|---|---|---|---|---|
| **Where do we agree?** | `lead` (Common Ground Index) | `aggregate.matrix[i] / aggregate.totalCoins` and `reach[i]` | Ring + lead chip | **CGI hero** — single big number, one-sentence verdict, a horizontal "Priority mix" bar that shows the room's % at a glance |
| **Where do we fight?** | `fault` | `var(functionVectors[:, i])` per priority | "fault" chip only | **Chord diagram** (or diverging bars) — pairs of functions on opposite sides, ribbons for "agreed on" / "split on" |
| **What are we blind to?** | `blind` | `argmin(matrix[i])` | "blind" chip only | **Highlights strip** — the 7 priorities, with the lowest-funded 1–2 bolded red, "Everyone underweighted Future Readiness" |
| **Who surprised us?** | `surprise` | `surpriseToken` (off-type ≥25% share) | One-line caption | **Persona dot plot** — 7 personas on a horizontal axis, persona-color dots, surprise persona outlined in gold ring with the off-type priority arrowed |

The **Common Ground Index** is the single anchor — it's the one number the room remembers. Make it a hero: 120pt display-font number, animated SVG ring (already in `RoomInsights.svelte`), a 1-sentence verdict (Aligned / Mixed / Fractured), and a tiny trend arrow (↑↑ over rounds, ↓↓ over rounds, → flat). Put it on **every screen** as a top-bar badge so the presenter always knows the room's alignment even when looking at a heatmap or a journey chart.

### Proposed chart set (all SVG, no library)

The five screens should each have a **named chart type** and a one-line narrative. Drop the abstract "matrix dominates" framing and replace it with:

1. **Screen 1 — "Where we agree"** (`RoomGlance` rewrite)
   - **CGI hero** (top-left, 60% width): the 120pt ring + verdict + sentence.
   - **Priority mix** (right): 7 horizontal bars, one per priority, width = % of room stake, color from `PRIORITY_COLORS[]`. One number per bar, the priority's % of room, and an up/down arrow showing change since last snapshot.
   - **Per-table chips** (bottom strip, keep current): T1..T7 with token total + persona color, "captured" pill on the locked ones.
   - **Sentence below the hero:** "The room converged on **Future Readiness** at 28% — your lead." or "The room is split: Productivity at 22% is the most backed, but C-Suite went 60% on Cost / ROI."

2. **Screen 2 — "Where we fight"** (`RoomInsights` rewrite)
   - **CGI hero** (top, smaller).
   - **Chord diagram** (center, 60% width): a circle of 7 persona nodes around the rim, ribbons for every function pair (alpha = cosine similarity). Pair colors are teal when cosine ≥ 0.7 (agree), gold when cosine ∈ [0.3, 0.7) (mixed), red when cosine < 0.3 (fight). Hover a ribbon → "Real Estate ↔ Marketing: 0.42 — they disagree on Innovation."
   - **Fault callout** (right, when there is a fault): "Innovation is your fault — IT and Operations back it 80%, Real Estate and Marketing ignore it. The room's biggest divide."
   - **Surprise banner** (top, when there is a surprise): "Surprise — Operations broke type by funding Cost / ROI. That's not their bias." (gold ring, animated pulse)

3. **Screen 3 — "What we missed"** (`PriorityConstellation` rewrite)
   - **CGI hero** (top, smaller).
   - **Stacked bars by priority, 7 rows** (keep current): one bar per priority, segments are functions (persona-color). Width = % of room. **Annotate the lowest-funded 1–2 with a red "BLIND" tag** and a 1-line caption each: "Future Readiness — only $4M of $700M. The room is not building for what's next."
   - **Summary chip** (right of the bottom bar): "IT went deep on Productivity while everyone else ignored it." — the 1-sentence insight.

4. **Screen 4 — "Who surprised us"** (`WinnersLosers` rewrite)
   - **CGI hero** (top, smaller).
   - **Persona dot plot** (center, 7 dots on a horizontal axis, one per function, persona-color). Dots positioned by the persona's agreement-with-room (`commonGround` already computed in `recomputeTable`). The **surprise persona** has a gold ring + an arrow pointing to the off-type priority. Other personas have a "Backed" mini-bar and a "Skipped" mini-bar.
   - **Function-by-function table** (bottom, 7 cards): keep the current Backed / Dropped cards, but add the persona's **agreement score** (`t.commonGround` 0..100) as a hero number on each card.

5. **Screen 5 — "Future Workplace"** (`FutureWorkspace` rewrite — keep most of it, but re-frame the top)
   - **CGI hero** (top, 60% width).
   - **Lead → Resolve → Protect** strip (right, three chips): "Lead: **Future Readiness** · 28% · $196M" / "Resolve: **Cost / ROI** · 22% · $154M" / "Protect: **Talent** · 4% · $28M".
   - **FutureBrief + FutureRoomGen + FutureTableGrid** (keep current layouts; refine the FutureBrief to lead with the mandate).

**Headlines panel** (the `E`-toggle modal) becomes a **presenter script generator**: 3 bullets the presenter can read aloud. Top bullet: the verdict. Middle bullet: the lead. Bottom bullet: the fault or surprise. One-line, plain English, no jargon.

### Visual style for the redesign

- **SVG only**, no canvas. The point is that the room can see the chart from 30 feet away — the presenter should never have to zoom.
- **Persona colors stay persona-bound.** Every chart that shows functions uses `PERSONAS[i].color`. The seat-color CSS tokens are still drift (see Project overview); do not reach for them.
- **Animation budget = 800ms total.** Charts ease in once, then hold. A ring fills in `cubic-bezier(0.65, 0, 0.35, 1)` over 800ms. A chord ribbon fades in 400ms after. After settle, the chart is static. The "regen" button resets all animations to 0.
- **Numbers first, decoration second.** A 120pt number is the hero. The chart is a context ribbon. Never the other way around.
- **Read-aloud copy is non-negotiable.** Every screen has a `<p class="read-aloud">…</p>` that the presenter can literally quote. If the screen doesn't have one, the screen is wrong.

### Host page (`/host/LIVE`) — proposed emerging-analysis panel

Today the host page has zero analysis. The facilitator sees status, lock/unlock, budget, export, reset — and that's it. They cannot tell whether the room is converging or fracturing. **Add an "Emerging Analysis" panel above the budget panel** (left column, between Status and Tables):

```svelte
<!-- section snippet -->
<section class="rounded-2xl border border-gold/30 bg-panel/40 p-5 space-y-3">
  <h2 class="text-[11px] uppercase tracking-[0.26em] text-gold">Emerging analysis</h2>
  {#if !hasData}
    <p class="text-xs text-muted">Empty until tables place stake. The CGI is 0/100 by definition with no stake.</p>
  {:else}
    <!-- CGI hero, compact -->
    <div class="flex items-baseline gap-2">
      <span class="font-display text-4xl font-bold text-{cgiColor}">{cgi}</span>
      <span class="text-xs text-muted">/ 100 · {verdict}</span>
    </div>
    <!-- 7 priority bars, 1 row -->
    <div class="grid grid-cols-7 gap-1">
      {#each mix as p (p.priority)}
        <div class="h-16 rounded" style="background:{p.color}30; height:{p.pct * 0.6 + 8}px" title="{p.name} {p.pct}%"></div>
      {/each}
    </div>
    <!-- 1-line read-aloud -->
    <p class="text-xs text-muted">"{readAloud}"</p>
    <!-- surprise/fault chips, inline -->
    {#if surprise}
      <p class="text-xs text-gold">Surprise: {persona} → {priority}</p>
    {/if}
    {#if fault && fault !== lead}
      <p class="text-xs text-red">Fault: {fault} splits the room.</p>
    {/if}
  {/if}
</section>
```

The read-aloud string is **the same one** shown in the presenter deck — the host and presenter see the same sentence. That single string is the canonical "what does the analysis say right now" — and it's computed from `roomInsights` + a small `readAloudForRoom(room)` helper in `src/lib/game/brief.ts` (which joins verdict + lead + fault/surprise into a sentence; ≤ 140 chars).

### `readAloudForRoom(room)` — the canonical story sentence

This is the single most important piece of code in the analysis layer. It produces the one sentence the room hears. Put it in `src/lib/game/brief.ts` next to `spatialProgramFromAggregate` so it's reachable from every chart and the host page. First draft:

```ts
// src/lib/game/brief.ts — add next to spatialProgramFromAggregate
import { PERSONAS, PRIORITIES } from './config';
import { roomInsights } from './scoring';
import type { RoomState } from './types';

const VERDICT_PHRASE: Record<string, string> = {
  Aligned:  'converges',
  Mixed:    'splits on',
  Fractured: 'is fractured by',
  '—':     'is still forming around'
};

export function readAloudForRoom(room: RoomState): string {
  const i = roomInsights(room);
  if (!i.hasData) return 'No stake yet — the room is still empty.';
  const a = room.aggregate;
  const leadPct = a.totalCoins ? Math.round((a.matrix[a.alignment] / a.totalCoins) * 100) : 0;
  const leadClause = `${i.lead} at ${leadPct}% (${formatUsd(a.matrix[a.alignment] ?? 0)}) — your ${VERDICT_PHRASE[i.verdict] ?? 'is'}.`;
  const faultClause = a.fault !== a.alignment && a.matrix[a.fault] > 0
    ? ` ${i.fault} splits the room.`
    : '';
  const surpriseClause = a.surprise
    ? ` ${PERSONAS[a.surprise.seat]?.name ?? 'A function'} surprised everyone by funding ${PRIORITIES[a.surprise.priority]}.`
    : '';
  return `The room ${leadClause}${faultClause}${surpriseClause}`;
}
```

Returns something like "The room converges on Future Readiness at 28% ($196M)." — and the `VERDICT_PHRASE` lookup turns it into a sentence the presenter can read aloud. The first draft has a known phrasing collision (the `${VERDICT_PHRASE[i.verdict]}` is appended after "your" redundantly); the final code should drop the "your" prefix and let the verdict phrase carry the grammar, e.g. `"The room converges on Future Readiness at 28% ($196M). Innovation splits the room. Operations surprised everyone by funding Cost / ROI."` The point is: **one place, one function, one sentence.**

**Use it everywhere the analysis is shown.** `RoomGlance`, `RoomInsights`, `WinnersLosers`, `Headlines`, and the host page all consume `readAloudForRoom(room)`. The presenter and the host see the same string. **Drift between them is a bug.**

### Computed additions to `roomInsights` (small, in `scoring.ts`)

Three more shapes the redesign needs that the current `roomInsights` does not return:

```ts
// Add to roomInsights() return shape:
//   - per-pair cosine for the chord diagram
//   - per-function agreement (already in t.commonGround, just expose on tables[])
//   - mix with raw pct + tokens (already in priorityMix, but pass through)
return {
  // ... existing fields ...
  pairs: functionPairs(functionVectors),         // [{ a, b, cosine }] for the chord
  agreement: tables.map(t => ({
    tableId: t.id,
    seat: t.id - 1,
    name: PERSONAS[t.id - 1]?.name ?? '—',
    color: PERSONAS[t.id - 1]?.color ?? '#999',
    commonGround: t.commonGround,                // already computed in recomputeTable
    tokens: sum(t.matrix),
    surprise: a.surprise?.seat === t.id - 1
      ? { priority: PRIORITIES[a.surprise.priority] }
      : undefined
  })),
  mix: priorityMix(a.matrix).filter(m => m.pct > 0)  // for the bar chart, sorted desc
};
```

`functionPairs(functionVectors)` is 7 lines — all `n*(n-1)/2 = 21` pairs (or fewer if some functions are inactive) with their cosine similarity. The chord diagram is 30 lines of SVG on top of this.

### Change list for the live URL (`https://common-ground.zyeta.asia/host/LIVE`)

The user is right that the live URL needs to be updated. Concrete steps (none of these touch a `.ts` file by themselves — they're all `.svelte` and the `brief.ts` helper):

1. **Edit `src/lib/game/brief.ts`** — add `readAloudForRoom(room)` per the snippet above. (One new exported function; no existing behavior changes.)
2. **New file: `src/lib/components/analytics/CgiHero.svelte`** — the 120pt ring + verdict + 1-line read-aloud. Reusable across presenter screens 1–5 and the host page.
3. **New file: `src/lib/components/analytics/ChordDiagram.svelte`** — 7-node circle, 21 ribbons, persona colors. Uses `room.aggregate.matrix` + `room.tables[].matrix`. ~80 lines of SVG.
4. **New file: `src/lib/components/analytics/PriorityMixBars.svelte`** — 7 horizontal bars, sorted desc, % / $ / tokens labels, the lowest 1–2 tagged BLIND. ~60 lines.
5. **New file: `src/lib/components/analytics/PersonaAgreement.svelte`** — 7 dots on a horizontal axis at `t.commonGround` x position, persona-color, surprise outlined in gold. ~50 lines.
6. **Edit `src/lib/components/present/RoomGlance.svelte`** — replace the strip with `<CgiHero room={room} />` + `<PriorityMixBars room={room} />` + the per-table chip strip.
7. **Edit `src/lib/components/present/RoomInsights.svelte`** — replace the rail/ring/chips with `<CgiHero room={room} compact />` + `<ChordDiagram room={room} />` + a fault/surprise callout.
8. **Edit `src/lib/components/present/WinnersLosers.svelte`** — replace the podium with `<CgiHero room={room} compact />` + `<PersonaAgreement room={room} />` + the existing 7 function cards (with `t.commonGround` added as a hero number).
9. **Edit `src/lib/components/present/FutureWorkspace.svelte`** — add `<CgiHero room={room} />` + a "Lead → Resolve → Protect" strip above the existing brief/room/table grid.
10. **Edit `src/lib/components/analytics/Headlines.svelte`** — replace the 3 fixed lines with `readAloudForRoom(room)` (split into 3 bullets).
11. **Edit `src/lib/components/analytics/PriorityConstellation.svelte`** — add the BLIND tag to the lowest-funded row + a 1-line summary.
12. **Edit `src/lib/game/scoring.ts`** — extend `roomInsights()` with `pairs`, `agreement`, `mix` (small additions, no breaking change to existing consumers).
13. **Edit `src/routes/host/[code]/+page.svelte`** — add the "Emerging analysis" panel between Status and Tables. Use the same `<CgiHero room={room} compact />` component.
14. **Edit `src/routes/present/[code]/+page.svelte`** — `SCREENS[]` titles get the 1-line read-aloud prefix: `{ title: "Where we agree", subtitle: readAloud, short: "Align" }` etc. (Or keep the current titles and put read-aloud in the hero.)
15. **No `+server.ts` changes**, no scoring-math changes, no domain-type changes. The CGI and the lens are unchanged; the redesign is purely a presentation layer.

After this, `bun run check` should still pass and `bun run dev` should show the new charts at `https://common-ground.zyeta.asia/host/LIVE` (after `wrangler pages deploy`). The `present/LIVE` page gets a facelift too: each screen has a CGI hero, a chart, and a 1-line read-aloud.

### Quick wins (in priority order)

If you want to ship *something* this week without a full chart rewrite, do these in order:

1. Add `readAloudForRoom` to `brief.ts` (30 min).
2. Add `<CgiHero room={room} />` to `RoomGlance.svelte` (45 min) — replace the ring-on-its-own with the ring + verdict + sentence.
3. Add the same `<CgiHero>` to `RoomInsights.svelte` and `WinnersLosers.svelte` (30 min total).
4. Add the "Emerging analysis" panel to the host page (1 h).
5. Update `Headlines.svelte` to use `readAloudForRoom` (30 min).
6. Build `ChordDiagram` and `PriorityMixBars` (2 h each) — the 4 chart components.
7. Wire them into the 5 screens (1 h).

Total: about a day's work. The host page alone (steps 1 + 4) is a meaningful improvement.


## Architecture & idempotency (the runtime contract)

The runtime is a single Cloudflare Worker holding an in-process `Store` singleton that mirrors a D1 row. The client polls `/api/room/${SESSION}/state` every 500 ms and the Server-Sent Events channel is *not* wired — it would shave the latency and remove the redundant network traffic. The HTTP verbs are mixed (`GET` is naturally idempotent; `POST` is not) and the AI endpoints are **expensive and non-idempotent** — every press of "Regen brief" re-pays  RapidI + fal. This section is the design spec for making the system **idempotent end-to-end, observably safe under concurrent isolates, and idiomatic Svelte 5** at every layer.

### A. The race in `withLiveRoom` is real, not theoretical

`src/lib/server/live.ts` does `store.sync(d) → fn() → store.persist(d)`. The in-process `Store` is a **module-level singleton** (`export const store = new Store()` in `store.ts:329`) that is shared by every request *on the same isolate*. The `syncing` promise blocks all callers — so on a single isolate, requests are serialised. But **Cloudflare Workers can run multiple isolates per colo**, and a second isolate has its own `Store` instance with its own in-memory `room`. The `INSERT … ON CONFLICT(id) DO UPDATE` in `room-store.ts:53` is *last-write-wins*, with no version vector.

**Concretely**: isolate A reads `room` (round 2, lockCount 3) at T0, isolate B writes round 2 → 3 at T1, isolate A finishes its mutation at T2 and writes `room` (round 2, lockCount 4) at T3. The advance is lost.

**The current scale (1 room, ≤ 7 tables, ≤ 30 users) hides this** — the polls run faster than mutations. But the moment a presenter double-clicks "Advance" from two devices, or two phones submit at the exact same moment on different isolates, the data loss is silent. The user's question — **"is it idempotent?"** — is the right question. The honest answer is: **POSTs to `/api/room/*` are not safe under concurrent retries from the same user, and concurrent writes across isolates can lose data.**

**Fix** (in order of priority):

1. **Add an `Idempotency-Key` header** to every mutating POST. Server stores `(key, response_body, expires_at)` in a new D1 table `idempotency (key TEXT PRIMARY KEY, response TEXT NOT NULL, expires_at INTEGER NOT NULL)`. TTL: 24h. On retry with the same key, return the cached response. **This is the standard `Idempotency-Key` pattern** (Stripe, Square, IETF draft). Do this for: `POST /api/room`, `POST /api/room/[code]/advance`, `…/retreat`, `…/config`, `…/tables`, `…/board`, `…/board/clear-cell`, `…/lock`, `…/unlock-table`, `POST /api/ai/brief`, `…/finale`, `…/table-render`.
2. **Add an `ETag` header to the state response** (`GET /api/room/${SESSION}/state`). Server sets it to `W/"${room.updatedAt}"`. Client sends `If-None-Match: W/"<old>"` and the server returns `304 Not Modified` with no body when unchanged. **This eliminates the redundant poll traffic** — the client only re-parses the room when the ETag changes.
3. **Switch the polling client to `EventSource` (SSE)**, with the ETag as `Last-Event-ID`. Cloudflare Workers support SSE natively (`new ReadableStream()` with a `text/event-stream` content type). The Worker pushes a `data:` frame whenever `store.persist(d)` runs. **The 500 ms poll disappears**. The client falls back to polling on connection drop. This is **the single biggest performance win** and it's also a natural fit for `last-event-id`-based reconnect — the client resumes from the ETag it last saw.
4. **Wrap the AI endpoints in a content-addressable cache**. Hash `(room.updatedAt, prompt.id, prompt.version, brief.user.json.slots)` → store in D1 table `ai_cache (key TEXT PRIMARY KEY, body TEXT NOT NULL, url TEXT, created_at INTEGER)`. **The "Regen brief" button is no longer "regen", it's "regen with new prompt version"** — and the cache key makes that explicit. The fal image generation is the same: hash the prompt + room fingerprint; if it exists, return the cached URL. **This is the largest cost saving** in the system.
5. **Drop the singleton in favour of per-request state**. `withLiveRoom(fn)` should be the **only** place that mutates the room, and it should **always sync-then-mutate-then-persist** with an `If-Match` style check (`updatedAt` from the synced snapshot is the version). On mismatch (another isolate wrote first), retry up to 3 times, then 409. The `Store` class can keep its `recompute` + scoring helpers as *pure functions* on `RoomState` and not own the singleton state at all. The new shape:

```ts
// src/lib/server/live.ts — the new shape
export async function mutateRoom<T>(
  fn: (room: RoomState) => { next: RoomState; response: T }
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = db();
    const current = await loadRoom(d) ?? makeRoom();
    if (current.phase === 'finale' && /* the mutating call would un-finale */ false) {
      throw error(409, 'Room is in finale; retreat first');
    }
    const { next, response } = fn(current);
    next.updatedAt = Date.now();
    // conditional UPDATE — fails if updatedAt moved
    const res = await d.prepare(
      `UPDATE room SET data = ?, updated_at = ?
       WHERE id = ? AND updated_at = ?`
    ).bind(JSON.stringify(next), next.updatedAt, 'LIVE', current.updatedAt).run();
    if (res.meta.changes > 0) return response; // won the race
  }
  throw error(409, 'Could not commit — too much contention');
}

export async function readRoom(): Promise<RoomState> {
  return (await loadRoom(db())) ?? makeRoom();
}
```

The `Store` class becomes a *namespace of pure helpers* — `applyBoardDelta`, `applySubmitTable`, `aggregate`, `recomputeTable` — not a singleton. Every request reads, mutates a *local* snapshot, and commits via conditional UPDATE. The in-memory singleton is **deleted**.

### B. The polling client is hand-rolled Svelte 4 + runes glue

`src/lib/state/session.svelte.ts` mixes `$state.raw<RoomState | null>(null)` (Svelte 5) with `let timer: ReturnType<typeof setInterval> | null = null`, `let booted = false`, `let pollChain: Promise<void> = Promise.resolve()`, `setInterval(poll, 500)`, and `document.addEventListener('visibilitychange', onVis)` (Svelte 4 / vanilla). The `poll()` function is a hand-rolled promise queue. The `boot()` function is *re-callable* — but the `booted` flag means the second call is a no-op, leaking the previous `setInterval` if `boot()` was called from a new mount (e.g. a route change remounts `+layout.svelte`).

This is the Svelte 4 *store-as-module* pattern with Svelte 5 runes sprinkled on top. It works, but it's **not idiomatic Svelte 5**. The right pattern is a **class with `$state` fields, instantiated in `+layout.svelte`'s `onMount`, with explicit teardown**:

```ts
// src/lib/state/session.svelte.ts — the new shape
import { onMount } from 'svelte';
import type { RoomState } from '$lib/game/types';

class SessionState {
  room = $state.raw<RoomState | null>(null);
  connected = $state(false);
  busy = $state(false);
  // Discriminated error union — components render different UI per kind
  error = $state<{ kind: 'none' } | { kind: 'transient'; message: string } | { kind: 'fatal'; message: string; retry: () => Promise<void> }>({ kind: 'none' });

  private abort: AbortController | null = null;
  private booted = false;

  boot() {
    if (this.booted) return () => {};
    this.booted = true;
    this.abort = new AbortController();
    void this.tick();
    const id = setInterval(() => void this.tick(), 500);
    const onVis = () => { if (document.visibilityState === 'visible') void this.tick(); };
    document.addEventListener('visibilitychange', onVis, { signal: this.abort.signal });
    return () => {
      this.booted = false;
      clearInterval(id);
      this.abort?.abort();
    };
  }

  private async tick() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch(`/api/room/LIVE/state`, {
        signal: this.abort?.signal,
        cache: 'no-store',
        headers: { 'if-none-match': this.room ? `W/"${this.room.updatedAt}"` : '' }
      });
      if (res.status === 304) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.applyRoom(await res.json() as RoomState);
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return;
      this.connected = false;
      this.error = { kind: 'transient', message: (e as Error).message };
    }
  }

  /** Optimistic mutation: apply locally, POST with If-Match, revert on conflict. */
  async mutate<T>(path: string, body: unknown, apply: (room: RoomState) => RoomState, opts: { optimistic?: boolean } = {}): Promise<T> {
    const etag = this.room ? `W/"${this.room.updatedAt}"` : '*';
    const key = `${path}:${etag}:${JSON.stringify(body)}`;
    // … (idempotency-key plumbing) …
    if (opts.optimistic && this.room) this.applyRoom(apply(this.room));
    try {
      const res = await fetch(`/api${path}`, {
        method: 'POST',
        signal: this.abort?.signal,
        headers: {
          'content-type': 'application/json',
          'if-match': etag,
          'idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify(body)
      });
      if (res.status === 409) {
        await this.tick();          // resync on conflict
        throw new Error('Conflict — room changed under us');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { room?: RoomState } & T;
      if (json.room) this.applyRoom(json.room);
      this.error = { kind: 'none' };
      return json;
    } catch (e) {
      if (opts.optimistic && this.room) await this.tick();  // revert by resync
      this.error = { kind: 'fatal', message: (e as Error).message, retry: () => this.mutate(path, body, apply, opts) };
      throw e;
    } finally {
      this.busy = false;
    }
  }

  applyRoom(next: RoomState) {
    if (!next || typeof next !== 'object') return;
    this.room = Object.freeze(next);     // $state.frozen when supported; Object.freeze is the fallback
    this.connected = true;
    this.error = { kind: 'none' };
  }

  // Specific action methods become 1-liners over mutate()
  advance = () => this.mutate(`/room/LIVE/advance`, {}, (r) => r, { optimistic: true });
  retreat = () => this.mutate(`/room/LIVE/retreat`, {}, (r) => r, { optimistic: true });
  boardDelta = (tableId: number, seat: number, priority: number, delta: 1 | -1) =>
    this.mutate(`/room/LIVE/board`, { tableId, seat, priority, delta }, (r) => r, { optimistic: true });
  // … etc, all 1-liners
}

export const session = new SessionState();
```

The class is instantiated **once at module top-level** (Svelte 5 has no module-singleton warning for *non-rune* state; the runes are inside the class). The `boot()` is called from `+layout.svelte`'s `onMount`, and the returned teardown is called from `onDestroy`. **No more `let timer` leaking**. The discriminated error union means `FutureWorkspace.svelte` can render `{#if session.error.kind === 'fatal'}` and offer the retry button — instead of guessing from a string.

The polling fetch is now an **`AbortController`-driven loop with `If-None-Match`** — server returns `304` for unchanged state, and the `signal` aborts on unmount. Combined with the SSE change (A.3), the polling client *disappears* in favour of a server-pushed event stream.

### C. Svelte 5 idioms that are not yet used

The codebase already uses runes (`$state`, `$state.raw`, `$derived`, `$derived.by`, `$effect`, `$bindable`, snippets, `{@render}`), property event handlers, and `bind:this` for native `<dialog>`. What's **missing**:

1. **`use:enhance`** for form-style mutations. The host page's `Save Budget`, `Reset Session`, the `downloadAll` button (which uses `setTimeout` to stagger 7 downloads), and the play page's submit (currently hand-written `try/finally` with `setTimeout(copied, 2000)`) should all use SvelteKit's `use:enhance`. **It gives progressive enhancement for free** — works without JS, gives `formdata` + `result` + `update` callbacks, and SvelteKit handles the loading state. ~80 lines saved across the codebase.

2. **`$state.frozen` for the `room` reference**. Currently `$state.raw<RoomState | null>(null)` — the `raw` wrapper tells Svelte not to deeply track, but the object is still mutable in the runtime. `Object.freeze(room)` in `applyRoom` makes it immutable. Svelte 5's `$state.frozen(room)` is the runtime-typed version. The benefit: bugs that try to mutate `room.aggregate.matrix[i]` directly throw a `TypeError` in strict mode. **One of the most common Svelte 5 / runes mistakes is to mutate a `$state.raw` reference in place** — `frozen` makes the mistake loud.

3. **`<svelte:boundary>` for the future-brief error state**. The current `FutureWorkspace` does `try { ... } catch { futureUi.err = 'Generation failed' }`. Wrap the body in a `<svelte:boundary onerror={(e) => futureUi.err = e.message}>` — Svelte 5's built-in error boundary. The component doesn't have to know how to handle errors; the boundary does. **This is the Svelte 5 idiom for partial UI failure.**

4. **`use:enhance` + `bind:value` for the editable brief** (in `FutureWorkspace.svelte:121-124`). The current code uses `bind:value={editableBrief}` on a `<textarea>` — but the *value source* is a SvelteKit form action that should `use:enhance`. The textarea should be a `<form use:enhance method="post" action="?/saveBrief">` and the value bound to the form field. **Saves 30 lines of hand-rolled fetch + error handling.**

5. **`Promise.allSettled` for the 7 table-renders** (in `FutureTableGrid.generateAll`, line 52-71). The current code does `for (const t of ready) { await session.generateTableRender(t.id) }` — 7 sequential fal calls is ~30 seconds. Replace with `Promise.allSettled(ready.map(t => session.generateTableRender(t.id)))` and update the busy state once. **Bonus**: a `concurrency: 2` limiter (semaphore-style) keeps the fal rate limiter happy.

6. **`Tween` from `svelte/motion`** for the count-up animation. Last pass proposed a `use:countUp` action — that works, but a `Tween` instance bound to a derived value is *more idiomatic* and reactive: `const tween = new Tween(0, { duration: 480 }); $effect(() => tween.set(room.aggregate.totalCoins));` and `tween.current` in the template. **No rAF, no action, no cleanup** — Svelte 5 owns the lifecycle.

7. **Discriminated `error` union** (replaces the current `let error = $state('')`). See B above.

8. **`AbortController` everywhere a fetch is held open**. Currently only `ExpandImage.svelte:30` does a single `fetch`; the new `session.tick()` (B) uses an `AbortSignal` for cancellation on unmount and on idle-tab.

9. **Discriminated `Result<T, E>` from the server** for AI endpoints. The current shape is `{ url, imageError, prompt, brief, briefSource, rapidi, room }` — `imageError` is a string union. Replace with a tagged union: `{ kind: 'ok'; url; brief; room } | { kind: 'no_key' } | { kind: 'failed'; error }`. The client renders different UI per kind. **Svelte 5 + TypeScript are made for this.**

10. **No `bind:clientWidth` / `bind:clientHeight` / `bind:offsetWidth`**. The `RoomInsights.svelte` ring (`r=42, dash = (ring/100) * 2π*42`) is hard-coded at `viewBox="0 0 100 100"`. If we ever want to scale to container width, we need `bind:this={svg}` + `bind:clientWidth` + a `viewBox` recalculation. Or use `preserveAspectRatio="xMidYMid meet"` and let CSS scale the SVG. **Currently the ring is at a fixed 100×100 — fine, but the future-brief room render (`FutureRoomGen.svelte:34`) is a 16:9 box that should fill its container, and right now it has fixed `aspect-ratio: 16/9` + a max-width. Consider `viewBox="0 0 1600 900"` and CSS `width: 100%; height: auto;` — which is what the SVG `<svg viewBox>` pattern was designed for.**

### D. The Server-Sent Events channel is the right architecture

The current `setInterval(poll, 500)` is a *pull* model. The right architecture for a single-room real-time app is a **push** model: the Worker holds a `ReadableStream` per connected client and writes a frame whenever `store.persist(d)` runs.

```ts
// src/routes/api/room/[code]/stream/+server.ts — new endpoint
import { defineEventHandler, getRequestEvent } from '$app/server';
import { readRoom, subscribeToRoom } from '$lib/server/live';

export const GET = defineEventHandler(async () => {
  let lastUpdatedAt = 0;
  const stream = new ReadableStream({
    start(controller) {
      const send = (room: RoomState) => {
        if (room.updatedAt === lastUpdatedAt) return;
        lastUpdatedAt = room.updatedAt;
        controller.enqueue(`event: room\ndata: ${JSON.stringify(room)}\nid: ${room.updatedAt}\n\n`);
      };
      // Send current snapshot immediately
      readRoom().then(send);
      // Subscribe to subsequent writes
      const unsubscribe = subscribeToRoom(send);
      // Heartbeat every 15s to keep the connection alive
      const hb = setInterval(() => controller.enqueue(':hb\n\n'), 15_000);
      // Cleanup on close
      const abort = getRequestEvent().request.signal;
      abort.addEventListener('abort', () => { clearInterval(hb); unsubscribe(); controller.close(); });
    }
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no'  // disable nginx-style buffering on some CDNs
    }
  });
});
```

`subscribeToRoom` is a tiny in-memory pub/sub (`Set<callback>`) that `store.persist(d)` writes to. The Worker keeps one SSE stream per connected client; on a scale of 30 users × 1 room, this is 30 streams — trivial for Workers (the runtime limit is 1,000 in-flight requests per isolate). The client uses `new EventSource('/api/room/LIVE/stream', { withCredentials: true })` — Svelte 5 doesn't have a built-in helper, but the `tick()` in `SessionState` (B) becomes a one-liner: `eventSource.onmessage = (e) => this.applyRoom(JSON.parse(e.data))`. **No more 500 ms lag. No more redundant network traffic. Server-pushed.**

The polling fallback is `setInterval(this.tick.bind(this), 5000)` (5s, not 500ms) — only kicks in if the SSE stream is closed. The client uses the `navigator.onLine` event + `EventSource.readyState` to choose between SSE and polling.

### E. Idempotency end-to-end — the contract

Every mutating endpoint accepts `Idempotency-Key: <uuid>`. The server returns one of:

| Status | Meaning | Client behaviour |
|---|---|---|
| `200 OK` with `Idempotency-Key: <original>` header | First success | Use the body |
| `200 OK` with `Idempotency-Key-Replay: true` header | Cached replay (same key within 24h) | Use the body (it's the original response) |
| `409 Conflict` | Mutation lost a race; resync and retry | Call `tick()` to get fresh state, surface a "Room changed — please retry" toast, optionally call `mutate.retry()` |
| `400` / `404` / `500` | Genuine error | Surface the error, do not cache |

The D1 schema adds:

```sql
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  status INTEGER NOT NULL,            -- HTTP status
  body TEXT NOT NULL,                 -- JSON response body
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL          -- 24h after created_at
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency(expires_at);
```

Cleanup is a cron Worker (or a lazy TTL check on read — drop the row if `now > expires_at`). The lazy approach is fine for 1 room: 1 row in, 1 row out, 24h later. **The cost is negligible.**

For the AI endpoints, the cache key is `SHA-256(prompt.id, prompt.version, room.aggregate.updatedAt)`. Same key → same response. **The "Regen" button becomes "Regen with a new prompt version"** — the user has to edit the prompt to bust the cache. This is the right affordance: free regen is a wallet hole, intentional regen is a feature.

### F. What this gets you, in priority order

If you only do **one thing** from this section, do **(B)** — convert `session.svelte.ts` to a class with `$state` fields, `AbortController`-driven polling, and a discriminated error union. The current hand-rolled Svelte 4 + runes glue is the biggest correctness risk in the system. **Half a day of work. No API change. No server change.** The class-based shape is the foundation for the SSE change (D) and the idempotency work (E) — do it first.

If you do **two things**, do **(B) + (E.1 Idempotency-Key)** — the server table is 8 lines, the client helper is 12, and the retry semantics make every POST safe. **One day total.** The user said "idempotent" — this is what they meant.

If you do **three things**, do **(B) + (E.1) + (D SSE)** — the polling disappears, the latency drops to < 100 ms, the cost drops to ~1 request per state change. **Two days total.** The current 500 ms poll goes away. The Live URL feels alive.

If you do **all four**, add **(A.5 drop the singleton)** — every request reads, mutates a local snapshot, commits via conditional UPDATE. The `Store` class becomes a namespace of pure functions. The race window is closed. **One additional day.** Now the system is correct under concurrent isolates *and* idempotent under retries.

If you do **all five**, add **(A.4 content-addressable AI cache)** — `brief` and `finale` re-generations are free within a prompt version. **Half a day.**  RapidI + fal costs drop ~80% in steady state.

### G. New gotchas (architecture & idempotency)

A1. **~~The `Store` singleton is not safe under concurrent isolates.~~ FIXED.** `withLiveRoom` now serializes mutations per isolate (a promise chain) and commits via compare-and-swap on `updated_at` (`store.persistIfUnchanged` → `saveRoomIfUnchanged`). Losing the CAS re-syncs and re-runs, up to 3 attempts, then 409. **`fn` passed to `withLiveRoom` must therefore be pure with respect to the room — never put a side effect (fal call, email) inside it.**
A2. **~~All `POST /api/room/*` and `POST /api/ai/*` are NOT idempotent today.~~ FIXED.** Every mutating POST is wrapped in `idempotentJson`; keys are validated `^[a-zA-Z0-9_-]{8,128}$`, cached in the D1 `idempotency` table for 24h, and replayed with an `idempotency-key-replay: true` header. The client sends a fresh `crypto.randomUUID()` per call and reuses the *same* key on a network-failure retry. **Any new mutating endpoint must use `idempotentJson`.**
A3. **~~No `ETag` on `/api/room/${SESSION}/state`.~~ FIXED.** The state route returns `ETag: W/"<updatedAt>"` and answers `304` to a matching `If-None-Match`. `store.bump()` is monotonic (`max(Date.now(), prev + 1)`) so two mutations in the same millisecond can't share an ETag.
A4. **No Server-Sent Events channel.** The client polls every 500 ms. Add `GET /api/room/${SESSION}/stream` (text/event-stream) and the polling disappears. See D. **Single biggest performance win.**
A5. **`session.svelte.ts` is not a Svelte 5 module — it's a Svelte 4 store + runes glue.** `let timer` + `let booted` + `let pollChain` + `setInterval` are all hand-rolled. Replace with a `SessionState` class with `$state` fields, an `AbortController` for cancellation, and a discriminated `error` union. See B.
A6. **The polling fetch has no `AbortController`.** When the route unmounts (presenter → host → play), the in-flight fetch continues. Add `signal: this.abort.signal` and an `AbortError` short-circuit in the catch. See B.
A7. **`FutureTableGrid.generateAll()` is a sequential `for...of` with `await` for 7 fal calls** — ~30 s total. Use `Promise.allSettled(ready.map(...))` with a concurrency limit of 2. **Saves 25 s and respects the fal rate limiter.** See C.5.
A8. **The `pulse` keyframe in `MobileSealed.svelte:82-86` is incomplete.** Only `50% { opacity: 0.35 }` is defined; the rest is implicit. Should be `0%, 100% { opacity: 1 }` + `50% { opacity: 0.35 }`. Or use a single `<span>` with `animation: pulse 1.2s ease-in-out infinite alternate;`. **A nit, but the rendering depends on the implicit keyframe being correct.**
A9. **`<svelte:boundary>` is the Svelte 5 idiom for partial UI failure.** Wrap the FutureWorkspace body in a boundary that calls `futureUi.err = e.message` on error. The component doesn't have to know how to handle errors. **Replaces the hand-written `try/catch/finally` in every `generateX` function.**
A10. **`use:enhance` is unused.** The host page's `Save Budget`, `Reset Session`, and the future-brief editor should all use SvelteKit's `use:enhance` instead of hand-rolled `fetch` + `setTimeout(copied, 2000)`. **~80 lines saved across the codebase; works without JS; gets progressive enhancement for free.**
A11. **Discriminated error union** (B + A5) replaces the `let error = $state('')` string. Components render `{#if session.error.kind === 'fatal'}` instead of guessing from a string. The `error.retry` callback is bound at the union level, not at the call site.
A12. **The Worker has no observability surface.** No `wrangler tail`, no logs beyond `console.error`. Add structured `console.info` (visible in the Pages dashboard logs; `wrangler tail` is unavailable here) on every `mutate` and every `persist` — include the idempotency key, the `If-Match` value, the contention result (win/lose/retry). **For a 1-room app this is enough.** For multi-room, add Workers Analytics (zero-config) with custom events.
A13. **`Promise.all` vs `Promise.allSettled`**: AI generation must use `allSettled` (a failure in one table shouldn't block the others). Currently the codebase has zero `allSettled` calls. Use it for: table-renders, image rendering, batch operations.
A14. **No `Idempotency-Key` validator.** The server must reject keys that are too long (DoS), too short (collision), or contain non-ASCII (URL-encoding footgun). **Validate to `^[a-zA-Z0-9-]{8,128}$` server-side.**
A15. **The `use:enhance` shape** (C.1) replaces a lot of hand-rolled fetch. The pattern is `<form method="post" action="?/save" use:enhance={() => async ({ result, update }) => { if (result.type === 'success') await update(); }}>`. SvelteKit's form actions *are* the Svelte 5 idiom for mutations. **A refactor of `/api/room/[code]/*` to SvelteKit form actions is the right long-term shape** — the API becomes a thin `+page.server.ts` and the client is a `<form>` with `use:enhance`. The body never crosses an explicit `fetch` boundary.
A16. **The `pulse` keyframe in `MobileSealed` is a CSS animation, not a Svelte transition.** Use Svelte's `crossfade` or `fly` for component-level transitions, not for *element* pulse. The CSS keyframe is correct here. **But the implicit keyframe is a footgun** — see A8.
A17. **The `setTimeout(() => (flashRow = {}), 400)` in `FunctionBoard.svelte:68` is fine** but consider a `Tween` for the flash opacity — it would interpolate from 0 → 1 → 0 over 400 ms automatically, no `setTimeout` needed. **This is the Svelte 5 idiom for any "show for X ms then hide" pattern.** The same applies to the `copied` state in `FutureWorkspace.svelte:42` and `MobileRender.svelte:115` and `+page.svelte:23`.
A18. **The `Date.now()` in `room.updatedAt` is set inside `recompute`** — but the SSE event in D needs to fire **on every persist**, not on every recompute. Move the timestamp to the persist boundary, not the recompute. Right now a no-op read on `GET /api/room/LIVE/state` doesn't bump `updatedAt` (correct), but an in-place mutation that doesn't trigger `recompute` would also not bump it (currently impossible, but the SSE refactor needs to be careful).


- **`Store`** is a singleton at `src/lib/server/store.ts`. Methods take a leading `_code: string` parameter that's always ignored (room is always `LIVE`). Public surface: `sync`, `persist`, `ensure`, `reset`, `snapshot`, `get`, `setTableCount`, `setConfig`, `advance`, `retreat`, `boardDelta`, `boardSet`, `clearCell`, `submitTable`, `saveTableBoard`, `lockTable`, `unlockTable`, `unlockSeat`, `setFinaleImage`, `setTableImage`, `setEnhancedBrief`. Plus the free `currentScenario(round)`.
- **`recompute(room)`** is the central integrity step called after every mutation. It rebuilds `aggregate`, per-table `matrix`/`reach`/`commonGround`, `lockedThisRound`/`expectedLocks`, `tableBountyTokens`, `analysisOpen`, the numbers brief (only if `briefSource !== 'rapidi'` — never overwrite a  RapidI brief), and `upsertHistory`. `setFinaleImage`/`setTableImage`/`setEnhancedBrief` skip the recompute and just bump `updatedAt`.
- **`setConfig`** accepts only `analysisForced` and `roomBountyTokens` (clamped 1..9999). Despite the older README/CLAUDE mention of `analysisUnlocks`, that field is **not** in the store or the endpoint.
- **Submit contract** (`applySubmitTable` / `submitTable`):
  - phase must be `lobby` or `round`, else `{ ok: false, error: 'Not accepting submissions' }`.
  - if `table.lockedThisRound` → return `{ ok: true, sealed: true }` (no change, idempotent).
  - if `seal: true` (default) but phase is not `round` or round is not capture (R2·R3·R5) → `{ ok: false, error: 'Submit/capture only on R2 · R3 · R5 ...' }` → HTTP 400.
  - on R3 (`isRemoveRound`): row is clamped to `min(row, prev)` per priority; cap is the **standing** total (cannot add).
  - otherwise: cap is `tableBountyTokens(room)` = `floor(roomBountyTokens / tableCount)`. Over-cap → 400.
- **Phase FSM** (`src/lib/game/rules/phase.ts`):
  - `lobby → round 0` (R1) → R2 → R3 → R4 → R5 → `reveal` → `finale`. `lobby` is no-op for retreat.
  - `applyAdvance` upserts a `RoundSnapshot` for the **leaving** round on every round→round transition (and re-opens all boards — `reopenBoards` clears `lockedThisRound`/`submittedSeats` and `analysisForced`). `applyRetreat` prunes `room.history` to rounds ≤ `room.round`.
  - Boards are never wiped; tokens carry across rounds (boards are cumulative).
- **Endpoint contract** (every handler under `src/routes/api/room/[code]/`). **Every mutating POST is wrapped in `idempotentJson` (`src/lib/server/with-idempotency.ts`)** — send an `Idempotency-Key` header and a retry replays the cached response instead of re-executing:
  - **`POST /api/room`** `{ tableCount?, reset? }` → idempotent ensure or reset. Returns `{ code, tables, room }`. `tableCount` is ignored if `reset` not set; if `reset: true` and `tableCount` undefined, uses current `tables.length` or `DEFAULT_TABLE_COUNT`.
  - **`GET /api/room/[code]/state`** → full `RoomState` with `ETag: W/"<updatedAt>"` + `cache-control: no-store`. The client polls with `If-None-Match` and the server answers `304` (empty body) when unchanged. `GET /api/room` (no code) returns `{ code, phase, tables }`.
  - **`POST .../advance|retreat`** → `{ phase, round, boardsOpened, room }` (advance also returns `captured`).
  - **`POST .../board`** `{ tableId, seat, priority, delta | value }` → `applyBoardDelta`/`applyBoardSet`. **Server-side, `delta` is validated against `CHIP_DELTAS = CHIP_DENOMS.flatMap(c => [c.value, -c.value])` = `[10, -10]`** (only ±$10M; the client signature `delta: 1 | -1` is stale — see Gotchas). Bad delta → 400. Bad indices/locked table → 200 with unchanged room.
  - **`POST .../board/clear-cell`** → `applyBoardSet(..., 0)`.
  - **`POST .../lock`** `{ tableId, board?, seal? }` → `submitTable`. `seal: true` (default) only seals on R2·R3·R5; R1/R4 only save.
  - **`POST .../unlock-table`** `{ tableId }` → `unlockTable`.
  - **`POST .../config`** `{ analysisForced?, roomBountyTokens? }` → `setConfig`. (No `analysisUnlocks`.)
  - **`POST .../table-count`** `{ count }` → `setTableCount`. Resizes `room.tables` to `clamp(count, 1, N_SEATS)`. (The older `/tables` endpoint + `setTables()` were removed — they always normalised to N_SEATS.)
  - **`POST /api/ai/room-concept`** / **`POST /api/ai/compose-brief`** — the two halves of the old `ai/finale`: fal room render and the RapidI brief respectively. 400 if `aggregate.totalCoins <= 0`. Persist `finaleImageUrl` / `enhancedBrief` + `briefSource`.
  - **`POST /api/ai/table-render`** `{ tableId: 1..7 }` → fal image from that function's cumulative bets. 400 on bad `tableId` or zero stake. Persists `tables[tableId].imageUrl` on success.
  - **`POST /api/ai/brief`** `{ code }` → regenerate narrative brief only (no image). Persists `enhancedBrief`/`briefSource`.

## UX deep review — flows, gamification, analysis surface

This is a from-the-source critique of the current user experience, written after reading every UI file end-to-end. The previous sections (Branding, UI/UX system, Analysis, Architecture) defined the *what*; this section defines the *what's still wrong* and the *order to fix it*. **No code changes proposed here are speculative** — every observation cites the exact file and line, every UX claim is grounded in the existing component.

The current product has the data, the AI, the analysis, the brand, and the gamification primitives. What's missing is **the spine of the experience** — the part that turns "7 phones with chips + 1 host page + 1 presenter page" into "a boardroom had a 90-minute strategy session, and here's what we found."

### A. The five user flows, audited

There are five distinct *actors* in the system: **the participant on a phone** (per function table), **the host** (the facilitator running the session), **the presenter** (the big-screen operator), **the participant at a board table** (the physical board + chip), and **the post-game viewer** (someone who walks up to the screen after the session ends). The current product serves four of these (phone, host, presenter, post-game via the persistent room state) and is silent on the fifth (the board). Each has a different job to be done; right now most of them are over-tooled and under-explained.

#### Flow 1 — The home page (`/`, `+page.svelte:1-127`)

The home page is what every user sees first. It is a 7-card grid (`+page.svelte:47-88`) of "function tables" with a colored dot, the persona name, a 12-character lens string, and a click handler that opens a `<Modal>` with the table's QR code. The whole page has **one paragraph of context** — `+page.svelte:33-44` — and that paragraph is the *brand line* ("Common Ground — A 90-minute workplace strategy game") plus a single-line description. The CTA below the cards is "Print all 7 QRs →" pointing to `/present/LIVE/qrs`.

**What works**: the cards are persona-colored (using `PERSONAS[].color` directly — good, not the `--color-seat*` drift tokens). The modal opens with a real `qrcode.toDataURL` (green-on-cream, `QrCode.svelte:9`). The `navigator.clipboard.writeText` + 2-second `copied` flag (`+page.svelte:19-25`) is correct.

**What's wrong**:

- **No explanation of the game loop.** A first-time facilitator sees 7 colored dots and a "scan to join" CTA. They have to *already know* what Common Ground is. The first 200 px should answer "What is this? What do I do? Where do I start?" with a 3-step numbered guide — not the brand line.
- **The 12-character lens is the most important copy on the page** and it's collapsed to 1 line of muted 12 px text (`+page.svelte:75`). On a 5xl breakpoint this is the bottom 1/3 of each card. Bump the lens to 14 px and a 2-line clamp.
- **The persona dot is 3 px** (`+page.svelte:76` `h-3 w-3`). Make it 12 px with a soft glow so the color identity is the dominant visual cue.
- **No "I'm a host / I'm a participant" bifurcation.** Both actors land here. A facilitator scanning for "set up the room" finds "Print all 7 QRs →" but no obvious "Host console" link — that lives in a footer-ish placement. Add a primary "Host this session" button in the header and a "Join a table" secondary, then the cards below.
- **No mobile responsiveness audit.** The grid is `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (3 breakpoints) — fine — but the `+page.svelte:75` lens clamping is not tested. On a 320 px iPhone SE, the cards become single-column and the dot is the only identity.

#### Flow 2 — The phone play page (`/play/[code]/[table]/+page.svelte`)

This is the densest page in the app. It has 4 different views: `tab='board' | 'render'`, plus `isFinale`, plus `submitted`, plus `phase='lobby'`, plus `phase='round' && !canCapture`. The render branch has its own nav-back, and the form is the only "save"-style element. The state machine is documented in AGENTS.md but the user has no map.

**What works**: `FunctionBoard.svelte` is the *one place* in the app where the gamification is real. The `navigator.vibrate(10)` on tap (line 78) is correct. The `in:scale={duration: 180, start: 0.35}` for chip piles (line 134) is correct. The `setTimeout(() => (flashRow = {}), 400)` for row flash (line 68) is correct. **The phone is the only surface where micro-interactions feel earned**, not decorative.

**What's wrong**:

- **No onboarding for first-time users.** A participant scans a QR, lands on the page, sees a board. They don't know what `R2: The Hollow Culture` means, what their mission is, or whether the buttons add or remove tokens. The `MobileHeader.svelte` shows the persona name + question + hint (`+page.svelte:35-49`) — but the *mission* is in the host's data, not the phone's. **Add a 3-card "First time here?" overlay** (dismissible) that shows: (1) "Your mission: {mission}", (2) "This round, you're {add|remove}-ing $10M chips", (3) "Tap ✓ to submit when you're done."
- **No timer, no "you have 2:34 left" countdown.** The 5 rounds are open-ended. The scenario hint is "Start by allocating ~$30M" — that's the *only* time cue. A real boardroom would benefit from a per-round timer. The timer is host-driven (the host starts a 5-min clock on advance), but the phone receives the tick via the room state. **Add a `roundStartedAt: number` to `RoomState` and a `remainingMs()` derived on the phone** (`MobileHeader` is the natural home).
- **The mission is missing from the phone.** `BoardSheet.svelte` prints the mission on the physical board, but `MobileHeader.svelte` only shows the persona name + the question. The phone and the board should agree. **Either show the mission on the phone** (as a `<details>` below the question) **or remove it from the board** (so the facilitator reads it aloud).
- **The `MobileHeader` hint condition is too narrow** (`MobileHeader.svelte:51` — `if scenario?.hint && phase === 'round' && scenario?.mode === 'capture'`). The hint should also show on R1 (`mode='wait'`) so the participant knows what *will* be asked; otherwise the phone is silent until R2.
- **No "you placed a chip" haptic or visual celebration beyond the row flash.** A participant places 10 chips — they should feel the *progress*, not just see the count change. **Add a `use:countUp` action** (per the UI/UX system design) to the `total` display in `FunctionBoard` so the number ticks from 0 → 10 over 280ms. Combined with a subtle "soft thud" haptic (`navigator.vibrate([5])`) on chip count milestones (every 5 chips), the gamification lands.
- **The "Submitted · Round 1" state in `MobileSealed.svelte` is read-only and the user is told to "wait for presenter"** — but the participant has *nothing else to do*. There's no "see what other tables submitted" view. **The phone should show a leaderboard strip below the seal** — top 3 priority leads across the room, refreshable every 2 s. This is the gamification hook that turns a passive wait into engagement.
- **The "Selfie & LinkedIn" button is locked behind having generated an image** (`MobileRender.svelte:173-177`). For a table that hasn't generated, the button is missing — but the *post-game* moment is the most shareable. **The button should always be present**, with a "Generate your workplace first" prompt if no image.

#### Flow 3 — The host page (`/host/[code]/+page.svelte`)

The host page is **the operator's cockpit**. 555 lines. 8 sections: Status, Tables, Game Config (200 lines), Budget, Export, Generated Images, Reset. **It is too long and too dense.** A facilitator on a 13" laptop scrolls past the budget field to reach the reset button.

**What works**: the Status section (lines 163-196) is correct — round rung chips, captured count, scenario question. The Tables section (199-232) is correct — per-table lock/unlock, link to play page. The Game Config editor (234+) is *the single biggest feature* in the app for an operator who wants to customise the session.

**What's wrong**:

- **555 lines in one component.** The Game Config alone is 200. **Split into 4 route files**: `/host/[code]/` (status + tables), `/host/[code]/config` (the editor), `/host/[code]/export` (downloads + reset), `/host/[code]/analysis` (the *Emerging analysis* panel from the analysis redesign). The operator gets a sidebar nav with 4 tabs. Currently they get a scrollbar.
- **The Game Config editor has no validation.** The host can type a hex code `#xyz` (line 277, `getPersonaField(seat, 'color')`), change `personas[3].seat` to `99`, or set `scenario.roundLabel` to `0`. **No color picker** (the persona color is typed hex), **no single-line-vs-multi-line input distinction** (lens / mission / question are `<input type="text">` when they should be `<textarea rows="2">`), **no "reset to default" button** (a bad edit makes the room unusable until next deploy). Add a `<input type="color">` for the persona color, `<textarea>` for multi-line fields, and a "Reset to default" button per persona / scenario.
- **The "Lock" button is per-table** (lines 222-227). For a 7-table session that's 7 clicks to lock all. **Add a "Lock all" button with a 5-second undo toast** — one click, not seven. Also add a keyboard shortcut `L` (with `<svelte:window>` like the present page does).
- **The "Reset session" uses `window.confirm`** (line 93). On iOS Safari PWA mode this can be blocked by some `beforeunload` handlers. **Replace with `<Modal bind:open={resetOpen}>`** + a typed `<input>` "type LIVE to confirm" pattern. The current `confirm` is a UX regression.
- **The "Emerging analysis" panel** (proposed in the previous pass) **is still missing**. The host has *zero* analysis. They can see status (which round, which tables are locked) but not "is the room converging?" **Ship the host's `<CgiHero>` + `<PriorityMixBars>` panel as the first thing the host sees** — above Status. The host's first question is "is it working?" not "what's the round?".
- **No "session timer" or "time since round started".** The host has the same blind spot as the phone — no clock. Add a `roundStartedAt: number` to `RoomState` and a `runningTimer` display.
- **The "Generated Images" section lists 7 table images but only one row each** (line 222-237). The "Save All ↓" button is on the right but the user has to scroll to it. **Make the section a grid** (one card per table) with per-image download buttons on hover, and the "Save All" as a sticky bottom-right action.

#### Flow 4 — The presenter page (`/present/[code]/+page.svelte`)

The presenter page is **the room's big screen**. 5 analysis screens (via `StageNav`), a topbar with round rungs, a scenario+action bar, the "live submissions" view, and the analysis deck. The `SCREENS[]` array (lines 19-25) defines the 5 screens in order. **The current order is** Combined Board → Room Insights → Priority Constellation → Trade-offs → Future Workspace. The previous pass proposed renaming them to "Where we agree / fight / missed / surprised / Future Workplace" — and that rename is critical. The current names are *technical* (Combined Board Heatmap, Priority Constellation) when the room hears *plain English* (where do we agree, where do we fight).

**What works**: the `StageNav` (5 dots + Back/Next buttons) is the right pattern. The keyboard nav (`onKey` lines 48-75) is comprehensive — `A` advance, `B` back, `E` extra, `Esc` close, `←/→` between screens. The submissions grid is a *correct* card per table.

**What's wrong**:

- **The submissions grid *disappears* when the deck opens** (`+page.svelte:179-244` is the `!open` branch). The presenter can be looking at the chord diagram and miss a table submitting. **The grid should collapse to a sticky footer strip** (7 dots, each with a state icon) — not disappear. The current behaviour forces the presenter to *manually* dismiss the deck to see submissions, which is the wrong default.
- **The extra analysis (`Headlines`, `ReachIntensityQuadrant`) is hidden behind `E`.** The chord diagram and the headlines panel are *the most interesting* surfaces for a boardroom. **Make them primary**: add a "Where do we fight?" screen as screen 2 (currently "Room Insights"), a "Where do we agree?" screen as screen 1 (CGI hero + Priority mix bars), a "Where did you surprise us?" screen as screen 3. **Hide the 2nd-class "extra modal"**; the chord diagram and headlines are primary deck content.
- **The "Future Workplace" screen is 5 components in 1** (`FutureWorkspace.svelte`). The editable-brief modal uses a hand-rolled div with `<!-- svelte-ignore a11y_interactive_supports_focus -->`. **Replace with the existing `<Modal>` primitive** (a 4-line change) and the screen becomes accessible for free.
- **No "what does the room say"** read-aloud on the presenter. The analysis is *visual* (rings, chips, bars) but the room hears a *presenter* read the lead/fault/blind. **Add a sticky "Read aloud" button at the bottom of every screen** that copies `readAloudForRoom(room)` to the clipboard and pulses the dot on `E`. The presenter can paste it into their speaker notes.
- **The transitions between screens are hard cuts.** `present.screen = 1; present.screen = 2; ...` — no animation. The first time the room sees a screen, it should *ease in*. **Add a `<div transition:fly={{ duration: 280, y: 8 }}>` to the `.canvas` wrapper** (Svelte 5 + `svelte/transition`).
- **The hero title is small** (`+page.svelte:247` — `h2 { meta.title }`). The screen name should be *the largest text on the screen* — a 48–72px hero. Currently it's a 24–32px H2. Bump it to 72px with Inter Display 800 weight.
- **The room's "all rounds complete" view (lines 162-175) is a 30px-tall bar.** The reveal moment is the climax of the session — it should be a *full-screen takeover* with the CGI hero, the verdict, and the "press Open deck →" button as the only chrome.
- **No "what was your journey" view.** `room.history` is captured for every round but never displayed as a chart. The journey — "R1: 22% alignment, R2: 38%, R3: 71%, R4: 64%, R5: 84%" — is one of the most powerful visual surfaces. **Add a 6th screen "Your journey" with a line chart** (5 columns, one per round, the CGI over time).

#### Flow 5 — The post-game (the "we did it" moment)

There is no post-game flow. After R5, the presenter advances to `reveal`, then to `finale`. The user sees the future-brief + room render + table grid. **There is no celebration, no "share this", no "here's what we found" headline.**

**What's wrong**:

- **No final hero.** The room render in `FutureRoomGen.svelte` is the *visual* answer, but the room should see a *headline* first. The headline is the CGI verdict + the lead priority + the read-aloud. **A "we did it" full-screen reveal**: the CGI hero at 200px, the verdict ("Aligned at 84/100"), the lead ("Future Readiness at 28% — your lead"), and a single CTA "Press to continue".
- **No "share this" moment.** The LinkedIn frame is in `MobileRender.svelte:174-177` but it's a small button in a corner. **The post-game should have a full-screen LinkedIn share card** with a QR code, a "Scan to share" CTA, and a "Download frame" button. The boardroom takes a picture of this.
- **No summary export.** The host page has "Export JSON" (line 121-131) — but no PDF, no PNG of the analysis, no "save the moment". **Add an "Export deck" button that generates a single PNG with all 5 screens side-by-side** (using `<canvas>` + `html2canvas` or a server-side `puppeteer`). The boardroom takes this home.
- **The "LinkedIn caption" copy in `linkedin-frame.ts:42` is the only place the brand speaks to the world** — and it's only on the share image. The website itself has no meta tags, no OpenGraph, no `og:title`. **Add `<svelte:head>` meta tags on the home page and the post-game screen** with the session's CGI, lead, and verdict as the social card.

### B. Gamification — what's earned, what's decorative, what's missing

The current gamification is **micro-interactions in 3 places**: chip pile + row flash + 10ms haptic on tap (all in `FunctionBoard.svelte`), the pulse dot in `MobileHeader`/`MobileSealed`, and the spin loader in 3 components (`FutureRoomGen`, `FutureTableGrid`, `MobileRender`). **The pulse and the spin are decorative** — they don't reinforce a game state, they just say "I'm waiting". The chip pile + row flash + haptic are *earned* — they reinforce "you placed a chip on Future Readiness".

The missing gamification primitives:

1. **The lead, fault, blind, surprise are the game state.** They should *animate* the moment they're computed. The CGI ring fills from 0 → current over 800ms. The lead priority on `RoomGlance` pulses gold for 2s. The fault priority pulses red. **None of this exists today.** The charts are static.
2. **The room's "alignment score" (CGI) should be a hero, not a chip.** It's currently a 70px-tall ring with a 28px number inside (`RoomInsights.svelte:14-26`). The room's most important number deserves a 200px-tall hero with the 120pt number, the verdict phrase, and a 1-line read-aloud.
3. **"This round, you placed a chip on Future Readiness."** The phone should show a *running narrative* of what the participant has done this round. After 3 chips, a small "You've shaped 3 priorities" line appears. After submit, a "✓ Round 1 sealed" with a 1-line sentence: "You sent $50M of $100M to Future Readiness, Productivity, Innovation. The room is at 38% of cap."
4. **The room is a multiplayer game, not a single-user one.** But the only place where the room is *seen* is the presenter's submissions grid. **A "room tension" meter on the presenter's topbar** — "5 of 7 tables locked" with a live counter that pulses when a new table locks — turns the per-table view into a "race to the round end" gamification.
5. **The "selfie" affordance** in `MobileRender.svelte:240-249` is a `<input type="file" accept="image/*" capture="user">` — it opens the phone's camera. **There's no in-app celebration** when the user takes the selfie and downloads the LinkedIn frame. The download button is just a button. **A confetti burst on download** (per the previous pass's `use:confetti` action) and a "✓ Posted!" success state turns a chore into a moment.
6. **The CGI is the room's score.** Currently it's a 0–100 number nobody on the room side has a stake in. **Make it a competition**: a CGI leaderboard ("Marketing is closest to the room at 0.91"), a delta indicator ("CGI up 12 since last round"), and a "CGI reveal" animation when the room advances to `reveal`. The score becomes the story.
7. **No "you're the surprise" callout on the phone.** If a participant's table is `surpriseToken`, the phone should *tell them* — "🎯 You surprised the room. You backed Future Readiness when no one else did." The surprise is currently shown to the presenter only.
8. **The "first table to lock" should be celebrated.** A small "First seal — {persona}" toast that fades after 3s. Currently the presenter sees a card flip from "Open" to "Submitted" with no celebration.
9. **The "your lead" tone.** When the room's lead priority is the same as a participant's top bet, the phone should highlight that: "Your #1 priority is also the room's #1 priority. +$10M to Future Readiness is going wide." **A 1-line "+10M" toast** that says "the room is with you".
10. **Round reveal.** When the room advances to the next round, *every phone* should see a brief reveal animation: the round name fades in ("R3 · The Rival HQ"), the mode badge ("REMOVE −") pulses gold, the hint types out letter by letter over 600ms. **Currently the phone just updates silently** (`phase` changes, the `MobileHeader` re-renders).

### C. The analysis surface — what's visible, what's missing

The current analysis surface is **5 screens + 1 hidden modal** (the `E` extra). The 5 screens show the data but not the *story*. The hidden modal shows the chord diagram — which is the most interesting chart in the system — but only if the presenter knows to press E. **The most interesting analysis is hidden.**

The 4 questions the analysis must answer (from the previous pass, restated):

| Question | Currently visible? | Where | Should be |
|---|---|---|---|
| **Where do we agree?** | Yes (RoomInsights chip) | screen 2 | screen 1, CGI hero + priority mix |
| **Where do we fight?** | Yes (RoomInsights chip) | screen 2 | screen 2, chord diagram + fault callout |
| **What did we miss?** | Yes (PriorityConstellation) | screen 3 | screen 3, with BLIND tag |
| **Who surprised us?** | Yes (one-line caption) | screen 2 bottom | screen 4, persona dot plot |
| **What's our future?** | Yes (FutureWorkspace) | screen 5 | screen 5, room render + brief |
| **How did we get here?** | No — `room.history` is captured but never shown | — | screen 6, journey line chart |
| **What was our read-aloud?** | No — `readAloudForRoom` is proposed but not built | — | a sticky button on every screen, copies the sentence |

The **chord diagram** (the most interesting chart) is currently in `src/lib/components/analytics/ReachIntensityQuadrant.svelte` — a quadrant chart, not a chord. The proposal in the previous pass was to *build* a chord diagram. **The chord diagram is the single visual that would make the analysis land with the room.** A circle of 7 personas, ribbons for every pair, alpha = cosine similarity. Teal when aligned, red when fighting. **That's the story.**

The **journey** is the other missing surface. `room.history[]` is captured on every advance (`recompute` calls `upsertHistory`), but no UI reads it. A line chart with CGI over time (R1 → R5) tells the *drama* of the session. **It's the most shareable visual** — a boardroom wants to know "we started divided and ended aligned".

### D. The analysis view in 5 minutes — the smallest redesign that ships

If you only have 5 minutes to ship, change three things:

1. **Add `readAloudForRoom(room)` to `src/lib/game/brief.ts`** (30 lines). Wire it to a sticky "📋 Read aloud" button at the bottom-right of every presenter screen. The button copies the sentence and pulses green on click. **One new file change, ~5 component changes.** The presenter has the read-aloud on every screen.
2. **Replace the 5 screen titles in `+page.svelte:19-25`** with plain-English labels: "Where we agree", "Where we fight", "What we missed", "Who surprised us", "Our future". **5 minutes.** The deck reads as a story, not as a feature list.
3. **Promote the "extra" modal to screen 2**. The chord diagram and the headlines panel are the most interesting content. Move them into the deck, demote "Combined Board Heatmap" to a sub-view of screen 1. **15 minutes.** The room sees the analysis without pressing E.

### E. The "first-time" path — onboarding the 4 actors

**No actor has an onboarding.** The home page assumes the user knows what Common Ground is. The phone assumes the user knows the round mechanic. The host assumes the user knows the operator's role. The presenter assumes the user knows which buttons to press. **Each actor has a "first 30 seconds" that should be taught.**

| Actor | First 30 seconds | Today | Should be |
|---|---|---|---|
| Participant on phone | "Your mission is X. Place chips on priorities. Submit when done." | `<MobileHeader>` shows the persona + question + (sometimes) hint | A 3-card `<details>` overlay on first visit (dismissable), showing mission + round mechanic + a single example chip placement. `localStorage` flag to never show again. |
| Host | "Lock tables. Advance rounds. Edit config. Reset when done." | The host page is a 555-line scroll. | A 3-step onboarding in a `<Modal>` (dismissible), showing the 4 tabs, a 1-sentence summary of each, and a "Show me around" button that scrolls to each section. |
| Presenter | "Watch the submissions. Click Open deck to see the analysis. Press A to advance." | The presenter has a topbar + a scenario bar + 5 screens behind nav | A 1-paragraph "Presenter's guide" in a sticky bottom bar that links to "Open deck" on first open. The keyboard shortcuts (A/B/E) should be on-screen. |
| Post-game viewer (walks up after) | "Here's what the room found." | No surface | A 6th screen "Your journey" with the chord diagram + the journey line chart + a "share" CTA. |

### F. The 7 most-impactful UX changes (in priority order)

1. **Replace the 5 screen titles with plain-English** (5 min, see D.2). The single biggest readability win.
2. **Promote the chord diagram to a primary screen** (15 min, see D.3). The most interesting chart should be in the deck, not behind a key.
3. **Add a "read aloud" button to every presenter screen** (1 h, see D.1). The presenter can paste the sentence into their notes.
4. **Show "your mission" on the phone** (1 h). The phone and the board should agree on what the participant is optimizing for.
5. **Add the "Emerging analysis" panel to the host page** (1 h, from the previous pass). The host has zero analysis; this is the first step.
6. **Build the chord diagram** (2 h, from the previous pass). The most interesting chart; needs a new component.
7. **Add a 5-min per-round timer** (1 h). Add `roundStartedAt: number` to `RoomState`. The phone shows the countdown; the host sees a "X:XX remaining" indicator.

Total: about 7 hours of focused work. The most-impactful single change is **(1)** — 5 minutes for a 10× readability win.

### H. New UX-flow gotchas (U1–U18)

U1. **The home page is silent about what the game is.** A first-time facilitator scans a 7-card grid and has no context. Add a 3-step numbered guide above the cards.
U2. **The persona lens (12-char brief) is the most important copy on the home page** and is collapsed to 1 line of 12 px muted text. Bump to 14 px and 2-line clamp.
U3. **The phone is missing the mission** that the printable board has. The participant scans a QR, lands on the page, sees a question but not *why they should care*. Show the mission on the phone, mirror the board.
U4. **No round timer.** The room has 5 open-ended rounds. A 5-min countdown per round (host-driven, room-tick'd) is a 1-hour win.
U5. **The phone's "Selfie & LinkedIn" button is locked behind having an image.** For a table that hasn't generated, the button is missing — but the post-game moment is the most shareable. The button should always be present.
U6. **The host's "Game Config" editor uses `<input type="text">` for multi-line fields** (lens, mission, question). Use `<textarea rows="2">`.
U7. **The host's "Game Config" has no color picker.** Personas are typed hex codes (`#E0A458`) — a 4.5-bit error rate. Use `<input type="color">` with the persona color preview.
U8. **The host's "Game Config" has no "reset to default" button.** A bad edit (e.g. `personas[3].color = "#fff"`) makes the room unusable until next deploy. Per-persona and per-scenario "Reset" buttons.
U9. **The host's "Lock" button is per-table** — 7 clicks to lock all. Add a "Lock all" with a 5-second undo toast, and a keyboard shortcut `L`.
U10. **The host's "Reset session" uses `window.confirm`** which can be blocked on iOS Safari PWA. Use `<Modal bind:open={resetOpen}>` with a typed-input "type LIVE to confirm" pattern.
U11. **The host's "Save Budget" is hand-written fetch** — should be SvelteKit `<form use:enhance>` with a form action. ~30 lines saved.
U12. **The host page is 555 lines in 1 component.** Split into 4 route files: `/host/[code]/` (status + tables), `/host/[code]/config` (the editor), `/host/[code]/export` (downloads + reset), `/host/[code]/analysis` (the emerging-analysis panel from the previous pass).
U13. **The presenter's live submissions grid *disappears* when the deck opens.** The presenter misses submissions while looking at the chord diagram. Collapse the grid to a sticky footer strip (7 dots) instead of removing it.
U14. **The presenter's chord diagram and headlines are hidden behind `E`.** They should be primary deck content — screen 2 and screen 3 in the new plain-English order.
U15. **The presenter's screen titles are technical** (Combined Board Heatmap, Priority Constellation). Use plain-English: "Where we agree", "Where we fight", "What we missed", "Who surprised us", "Our future".
U16. **The presenter's screen transitions are hard cuts.** Add a `<div transition:fly={{ duration: 280, y: 8 }}>` to the `.canvas` wrapper. Svelte 5 + `svelte/transition`.
U17. **The presenter's hero title is too small** (24 px H2). Bump to 72 px with Inter Display 800 (per the UI/UX system design). The screen name should be the largest text on the screen.
U18. **There's no "your journey" view.** `room.history[]` is captured on every advance but never shown. Add a 6th screen with a line chart of CGI over rounds. **It's the most shareable visual.**


- **`scoring.ts`**
  - `cosine`, `commonGround` (per-function-vs-room), `commonGroundIndex` (mean pairwise cosine; returns 0 when fewer than 2 active functions).
  - `verdicts(matrix, reach, functionVectors)` returns `{ alignment, fault, blind }`. `fault` = max-variance priority (skipping the lead); `blind` = least-funded priority.
  - `surpriseToken(functionVectors, personaBias)` returns `{ seat, priority }` only when `offBias >= 2 && share >= 0.25` (≥25% of the function's money on an off-type priority). Returns `undefined` when nobody broke type.
  - `aggregate(tables, personaBias)` builds `matrix`/`reach`/`alignmentIndex`/`alignment`/`fault`/`blind`/`surprise`/`totalCoins`/`tableCount`.
  - `recomputeTable(t, roomMatrix?)` rebuilds `t.matrix` (the function seat's row), `t.reach` (binary 0/1 per priority), and `t.commonGround` (when `roomMatrix` is supplied).
  - `roomInsights(room)` is the **SSOT** for the presenter insights deck (ring, lead/fault/blind, table breakdown, journey including a live point if not yet frozen in history, verdict label). Verdict label thresholds: `index >= 66` → "Aligned", `>= 40` → "Mixed", `> 0` → "Fractured", else "—".
  - `winnersLosersByFunction(tables)` — top winner/loser per function from the combined portrait (also returns `runnerUp` if non-zero).
  - `analysisOpen(room)` is `true` when `analysisForced` OR `phase in {'reveal', 'finale'}`. Checkpoint unlocks do **not** auto-open the deck.
- **`brief.ts`** — domain-only after the prompts/ refactor; no AI strings here.
  - `priorityMix(matrix)` — sums to 100 (largest-remainder rounding) when `total > 0`, else all zeros.
  - `spatialProgramFromAggregate(agg)` — `{ mandate, program, lead, resolve, blind, features, alignmentIndex, compositionLine }`. `mandate` and `lead`/`resolve`/`blind` are empty strings when there's no stake.
  - `buildEnhancedBrief(agg)` — numbers-only skeleton; returns `''` when `totalCoins <= 0` (no mandate invented). Used as the  RapidI fallback when Workers AI is unavailable.
  - **Moved out:** `finalePrompt`, `tableFunctionPrompt`, `briefFactsForRapidi` → `src/lib/server/ai/prompts/` (see "Prompts as data, not code" in [AI integration]).
- **`config.ts`**
  - **`PERSONAS[]` order is authoritative for `tableId`.** See the seven-row table in Project overview.
  - `tableSeatIndex(tableId)` clamps to `[1, PERSONAS.length]` and returns `n - 1`.
- `PRIORITY_COLORS` is the 7-color palette used by portrait, winners, future.
- `SCENARIOS[i]` is 0-based and paired with `roundLabel = i + 1` (R1..R5). `currentScenario(round)` (store helper) returns `SCENARIOS[round] ?? SCENARIOS[ROUND_COUNT - 1]`.

## Strategy disclosure + per-round constraints — the strategy of addition or protection
The current analysis answers *where* (lead, fault, blind) and *how much* (CGI, journey). The user asked a sharper question: **what was the room's *strategy*?** Was it additive (kept building)? Protective (held the line)? Balanced (made trades)? What did each *function* do? This section has three parts: **data flow** (A–G — pure functions, schema snapshots, consumer wiring, gotchas), **visual flow** (mock-ups of each consumer), and **integration with [AI integration]** (the brief prompt's expanded input shape + the empty-state guard).

- **Per-priority board colors** (a single source of truth that the heatmap, the chord diagram, the chip pile, and the lead/fault/blind chips all consume).
- **Per-round min/max token rules** (R1 has a floor of $30M; R2/R5 require coverage on ≥5 of 7 priorities with ≥$10M each; R3 requires ≥$20M of net removal). These rules are server-validated and tunable in the host's Game Config.
- **Strategy disclosure** — a new pure-function family in `scoring.ts` that classifies the room's posture (`additive-dominant` / `protection-dominant` / `balanced-trade`) and each function's posture (`additive` / `protective` / `balanced` / `no-op`), plus the *protected* and *contested* priority lists. The phone shows the player's own strategy on submit (Phase 7); the presenter shows the room's strategy as a 7th screen *Strategy* (Phase 8, alongside screen 6 *Your journey*); the host shows it in the emerging-analysis panel (Phase 7); the AI brief consumes it as 2 lines of context.

The whole feature is **pure functions on `RoomState`** for *computation* — no new endpoints, no new mutations. The `RoomState` schema gains **two optional cached snapshots** (`strategy: StrategySignature` and `protected: StrategySignature['protected']`) so the phone and presenter can read the result without recomputing on every poll. Default values mean the snapshots are backward-compatible.

### A. Per-priority board colors

Today every priority wears the **priority-palette color** *in the heatmap only*. Promote it to a system-wide token. A glance at any chart should answer "which priorities are we fighting over?" without reading a name.

**`src/lib/game/config.ts`** — add a typed getter:

```ts
/** Priority → hex. Single source for the heatmap, chord, chip, label. */
export const PRIORITY_COLORS = [
  '#E0A458', // 0 Talent
  '#E0665A', // 1 Employee Experience
  '#E574B0', // 2 Employer Brand
  '#5AA9E6', // 3 Productivity
  '#7E8CE0', // 4 Innovation
  '#3FB6A2', // 5 Cost / ROI
  '#C9A227', // 6 Future Readiness
] as const;

export type PriorityIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export function priorityColor(p: PriorityIndex): string {
  return PRIORITY_COLORS[p];
}
```

**`src/app.css @theme`** — expose each priority as a CSS variable so charts use `var(--priority-3)` instead of magic numbers:

```css
@theme {
  --priority-0: #E0A458;  /* Talent */
  --priority-1: #E0665A;  /* Employee Experience */
  --priority-2: #E574B0;  /* Employer Brand */
  --priority-3: #5AA9E6;  /* Productivity */
  --priority-4: #7E8CE0;  /* Innovation */
  --priority-5: #3FB6A2;  /* Cost / ROI */
  --priority-6: #C9A227;  /* Future Readiness */
}
```

**Where the colors apply** (one rule: *priority color = data; brand red/gold = chrome*):

| Surface | Color rule |
|---|---|
| `Chip.svelte` chip pile row in `FunctionBoard` | The chips in each row take the *priority's* color, not all red. The chip border is the priority's color; the chip face is brand red (the chip is still $10M; the priority is what the row represents). |
| `RoomInsights.svelte` lead/fault/blind chips | The *priority name* inside each chip is colored by the priority. The chip frame stays brand gold/teal/red by type. |
| `PortraitMatrix` cells | Already color-mixes the priority color; just use `priorityColor(p)` instead of `PRIORITY_COLORS[p]` so the source is one function. |
| Chord diagram (Phase 8) | Ribbon color encodes the priority where the disagreement is highest (the `fault`). Use the fault's priority color, not red. |
| Conviction bars (`ConvictionBars.svelte`) | Each bar's fill uses the priority color, not the persona color. The persona dot stays the persona color. |
| LinkedIn share frame | The `priorityColor(p)` paints the row the participant most protected on R3 — their "claim to fame". |


> ⚠️ **Known collision** — priority index 6 (Future Readiness, `#C9A227`) shares its hex with the C-Suite persona. They're different *things* in different *contexts*: the priority color is the data, the persona color is the chrome. The visual confusion is acceptable because the contexts never overlap (priority name vs persona name). See [Branding] for the proposed fix.

**What stays brand colors**: the wordmark, the action buttons (gold = primary, teal = confirmed, red = danger), the focus ring, the AI attribution. Brand chrome stays Zyeta teal/gold; **data wears priority color**. The split makes every chart instantly readable from across the room.

### B. Per-round constraints

Today a table can put $0 on every priority, or $100M on Innovation alone. That makes R2-R5 useless as *measurement* — there's nothing to compare against. Add real game constraints. **These are tunable per-session via the host's "Game Config" → "Constraints" tab.**

**`src/lib/game/config.ts`** — type and default values:

```ts
export interface RoundConstraints {
  /** Minimum $M total this table must place across all priorities this round. */
  floorPerRound: Partial<Record<'wait' | 'capture' | 'hold', number>>;
  /** Minimum number of priorities the table must cover with ≥$10M each. */
  minPrioritiesPerRound: Partial<Record<'wait' | 'capture' | 'hold', number>>;
  /** Maximum $M any single priority cell can hold (default: 100). */
  maxPerPriority: number;
  /** strategySignature() thresholds (see gotcha S3): */
  protectionShrinkPct: number;     // R2→R3 row shrink to classify as 'protective' (default 0.20)
  additiveGrowthPct: number;       // R2→R3 row grow to classify as 'additive'      (default 0.10)
}

export const DEFAULT_CONSTRAINTS: RoundConstraints = {
  floorPerRound: { wait: 30, capture: 50, hold: 0 },
  minPrioritiesPerRound: { wait: 0, capture: 5, hold: 0 },
  maxPerPriority: 100,
  protectionShrinkPct: 0.20,
  additiveGrowthPct: 0.10,
};

**The default values** are tuned for a 7-priority board, $100M table cap, $10M chips. They force:

- **R1 (`wait`)**: ≥$30M placed, no breadth minimum. "Start *somewhere*."
- **R2 / R5 (`capture`, add)**: ≥$50M placed, ≥5 of 7 priorities at ≥$10M each. Forces *breadth* — the room can't all pile onto one priority.
- **R3 (`capture`, remove)**: the *relative* floor — the table must remove ≥$20M of the previous standing total. Forces *churn* — R3 measures the room's willingness to take away.
- **R4 (`hold`)**: no constraints. The board holds. R4 is a thinking pause.

**`src/lib/game/rules/board.ts`** — server-side validation, returning the typed error the phone can render:

export type SubmitTableResult =
  | { ok: true; sealed: boolean }
  | {
      ok: false;
      reason:
        | 'not-accepting'
        | 'not-capture-round'
        | 'over-budget'
        | 'wrong-seat'
        | 'locked'
        | 'floor-not-met'
        | 'breadth-not-met';
      message: string;        // human copy, shown in the phone's toast
      hint?: string;          // optional suggestion (e.g. "Try covering more priorities")
    };

export function validateRoundSubmission(
  room: RoomState,
  tableId: number,
  row: Vec7,
  constraints: RoundConstraints
): Extract<SubmitTableResult, { ok: false }> | Extract<SubmitTableResult, { ok: true }> {
  // (See the domain logic below.)
}

**The phone UI** (`src/routes/play/[code]/[table]/+page.svelte`) gets back `{ ok: false, message: ... }` from the submit endpoint and renders a toast:

```
Round 2 needs at least $50M of $100M and 5 of 7 priorities covered.
You're at $30M with 3 priorities.
Try covering more priorities or moving chips around.
```

The `message` is server-generated copy. **Localised by the server**, *not* by the client. Round + budget + covered count come from the room state; the framing copy is `constraints.ts`'s concern.

**Integration with `applySubmitTable`**: the existing `applyBoardDelta` already enforces R3's `move: 'remove'` rule and rejects over-budget. `validateRoundSubmission` is called *before* `applySubmitTable` — it does not double-validate `move` or budget (those remain the existing rules' responsibility). It adds the **new** validations (`floor-not-met`, `breadth-not-met`) on top. **Order of checks**: existing FSM (`not-accepting`, `not-capture-round`, `wrong-seat`, `locked`) → existing budget (`over-budget`) → new validator (`floor-not-met`, `breadth-not-met`). The error reason is whichever check fires first.


### C. Strategy disclosure (the *real* feature)

This answers the user's question — *"what was protected?"* The signature is a new pure function in `src/lib/game/scoring.ts`:

```ts
/** The room's posture across rounds. */
export type RoomStrategy = 'additive-dominant' | 'protection-dominant' | 'balanced-trade';

/** A single function's posture at a given round. */
export type FunctionStrategy = 'additive' | 'protective' | 'balanced' | 'no-op';

export interface StrategySignature {
  /** R3 vs R2 net movement across the room. */
  roomStrategy: RoomStrategy;
  /** Per-function posture from R2 → R3. */
  functionStrategies: Record<number, FunctionStrategy>;
  /** Priorities each function held the line on (their R3 share ≥ room average). */
  protected: Array<{ seat: number; priority: number; shareR2: number; shareR3: number; held: boolean }>;
  /** The contested priority (same as verdicts.fault) and per-function share there. */
  contested: { priority: number; perFunction: Array<{ seat: number; share: number }> };
}

export function strategySignature(room: RoomState): StrategySignature {
  // Pure function. Called from `recomputeTable(room)` after every `applyAdvance` / `applyRetreat`.
  // The `strategy` and `protected` snapshots in `RoomState` are updated by recomputeTable — no
  // separate mutation surface needed. The result is *provisional* between R3 and R5 (the
  // additive-dominant verdict can't confirm until R5 lands); see gotcha S6.
  // Room posture — computed AFTER R3 (R5 has not happened yet):
  //   Net removal > 50% of R2's standing  → protection-dominant.
  //   Net removal < 10%                   → additive-dominant (R5 will re-confirm or override).
  //   Otherwise                           → balanced-trade.
  //
  // Per-function (R2 → R3), checked in this order:
  //   shrunk ≥ protectionShrinkPct (20%)   → protective
  //   grew   ≥ additiveGrowthPct  (10%)    → additive
  //   delta  === 0                          → no-op   (zero-change is a distinct signal)
  //   otherwise (delta in ±thresholds)      → balanced
  //
  // Protected: for each (seat, priority) where R3 share >= R2 share AND
  //   R3 share > room average share for that priority. "Held the line."
  //
  // Contested: from verdicts.fault. For each function, share = R3 row[fault].
}
**The narrative forms** (also in `scoring.ts`):

```ts
/** 3-bullet read-aloud for the presenter's "strategy" screen. */
export function formatStrategyForRoom(room: RoomState): {
  headline: string;     // "The room is protection-dominant."
  bullets: [string, string, string];  // 3 named moves
};

/** 1-paragraph phone-side readout, shown on the user's own device after submit on capture rounds. */
export function formatStrategyForFunction(
  room: RoomState,
  tableId: number
): string;
```

**Example outputs:**

```
// formatStrategyForRoom
{ headline: 'The room is protection-dominant on R3.',
  bullets: [
    'Marketing protected Future Readiness — held $40M of $100M there while the room cut it $30M overall.',
    'Operations cut Talent by $40M, the most aggressive move in the room.',
    'C-Suite held every priority flat — no-op.'
  ] }

### D. Where each consumer lands

| **Presenter screen 7 "Strategy"** (Phase 8 — same phase as the *Your journey* screen 6; both are chart work) | One chart per row: room strategy + per-function strategies. Plus the room's contested-priority chord strip (priority-colored ribbons, not red). |
| **Host's emerging-analysis panel** (above Status, **Phase 7**) | CGI hero + strategy fingerprint + protected/contested lists. The first thing the host sees on opening the page. |
| **Phone "your strategy" card** (**Phase 7**, on `MobileSealed.svelte`) | A 1-paragraph readout of the *player's own* strategy. Shown after submit on R2/R3/R5. |
| **LinkedIn share frame** | The participant's most-protected priority, painted in its `priorityColor`, in the LinkedIn header. |
| **Brief prompt** (`prompts/brief.user.ts`) | Two lines of context appended: `Strategy: {roomStrategy}. Protected: {names}. Contested: {name}.` **Renderer projection**: `protected` is a per-seat array `Array<{seat, priority, shareR2, shareR3, held}>`. The brief renderer projects this to a deduped priority-name list — `protected = [...new Set(room.strategy.protected.filter(p => p.held).map(p => PRIORITIES[p.priority]))]`. `contested = PRIORITIES[room.strategy.contested.priority]`. **Empty-state guard**: when `room.strategy` is undefined (R1, R2, pre-reveal), the strategy lines are *omitted entirely* — never emit `Strategy: .` blank. See [AI integration §Failure modes] for the corresponding failure-mode row. The  RapidI brief uses these lines to inform the narrative. |


### E. Concrete change list

1. **`src/lib/game/config.ts`** — add `priorityColor(p: PriorityIndex)`, `PRIORITY_COLORS` typed const, `RoundConstraints` interface, `DEFAULT_CONSTRAINTS` const.
2. **`src/lib/game/types.ts`** — extend `RoomState` with `constraints: RoundConstraints` (default `DEFAULT_CONSTRAINTS`), `protected: StrategySignature['protected']` (cached snapshot), `strategy: StrategySignature` (cached snapshot). All optional / have defaults.
3. **`src/lib/game/rules/board.ts`** — add `validateRoundSubmission(room, tableId, row, constraints)` and extend `applySubmitTable` to return `SubmitTableError` from the validator. The error message is server-generated.
4. **`src/lib/game/scoring.ts`** — add `strategySignature(room)`, `formatStrategyForRoom(room)`, `formatStrategyForFunction(room, tableId)`, `priorityColor(p)` re-export.
5. **`src/app.css @theme`** — add `--priority-N` tokens.
6. **`src/lib/components/Chip.svelte`** — accept optional `hex` for the *border* (chip face stays brand red). The refactored FunctionBoard per-row takes the row's priority color.
7. **`src/lib/components/phone/MobileSealed.svelte`** — add the "Your strategy" card when `phase in {reveal, finale}`. Show the `formatStrategyForFunction(room, tableId)` 1-paragraph + the protected-priority list as 3 pills.
8. **`src/lib/components/analytics/StrategyStrip.svelte`** (~60 lines) — per-function strip shown on screen 7 (Phase 8, alongside *Your journey* screen 6) and the host's emerging-analysis panel. Each dot = one function, colored by its strategy. **Avoid brand colors** — pick a *new* strategy palette that doesn't collide with persona or chrome: e.g. `additive` = green, `protective` = navy, `balanced` = teal, `no-op` = muted grey. The dot's tooltip shows protected + contested priorities.
9. **`src/lib/components/analytics/FunctionStrategyDot.svelte`** (~30 lines) — single dot with hover tooltip.
12. **`src/lib/client/linkedin-frame.ts`** — paint the participant's most-protected priority with its `priorityColor` in the LinkedIn header.
13. **Tests** (`rules.test.ts`) — `validateRoundSubmission(...)` cases (floor-not-met, breadth-not-met, ok), `strategySignature(...)` cases (additive / protective / balanced classification).
14. **Glossary entries** — `priorityColor`, `RoundConstraints`, `validateRoundSubmission`, `strategySignature`, `RoomStrategy`, `FunctionStrategy`, `additive-dominant`, `protection-dominant`, `balanced-trade`, `protected`, `contested`.
15. **Master plan** — Phase 7 already mentions the host split; add a one-line "phone gets your-strategy card; presenter gets screen 7 *Strategy* (Phase 8, alongside screen 6 *Your journey*)" to its deliverables.
### F. Why this matters

The user's question — *"what was protected?"* — is the missing **narrative verb**. Today the analysis answers *where* (lead/fault/blind) and *how much* (CGI). After this change it answers *how* — "Marketing protected Future Readiness by holding the line at $40M of $100M while the room cut it $30M overall." That's the **Common Ground story** as a *post-game reflection*, not just a *real-time aggregate*.

Three side-effects beyond the obvious:

1. **The "Your strategy" phone card turns submission into reflection.** A boardroom talks about *what they did* in the minutes after submit. A 1-paragraph readout that names their posture and the priority they protected is the gamification of reflection.
2. **The host gains situational awareness.** Today the host has zero analysis. The strategy fingerprint + the protected/contested lists answer "should I advance?" — if R3 was protection-dominant and the room is tight, the next round's add-mode will be more contested.
3. **The brief gets narrative context.** Instead of "your lead is Future Readiness at 28%",  RapidI gets "The room is protection-dominant; Marketing held Future Readiness; Operations cut Talent." The brief reads like a story, not a stat dump.

### G. New gotchas (S1–S8 — strategy disclosure)

S1. **Don't merge the validator into the submit response.** `validateRoundSubmission` is a *server-side* function called by `applySubmitTable`; the client shows the resulting `message` verbatim. **The server owns the copy** because the constraints are configurable per-room — the client can't know them statically.
S2. **The "no-op" function strategy is honest, not silent.** A function whose R3 row equals R2 row may have done *nothing*. `formatStrategyForRoom` should mention "no-op" explicitly — "C-Suite held every priority flat — no-op" — so the room sees who participated and who didn't.
S3. **The protection threshold (20% R2→R3 shrink) is not a magic number.** It's a *tunable* in `DEFAULT_CONSTRAINTS`. A future session could choose "the room takes things back more aggressively" — the threshold is 35% in that case. Keep the threshold in the function signature, not buried in `strategySignature`.
S4. **The "Your strategy" card is post-submit, not post-round.** Show it on the same screen as `MobileSealed.svelte` — the moment the user has finished *their* R3. Don't wait for the round to end; the participant's strategy is fixed the moment they submit, not the moment the round seals.
S5. **The contested-priority list changes when `verdicts.fault` changes.** Recompute on every poll. The StrategyStrip should not memoize on `room.updatedAt` *or* `room.aggregate`; it should re-render whenever either changes. **Use `$derived.by`** for the strip and let Svelte 5 handle it.
S6. **The "Strategy" presenter screen (7th) is gated by phase, not empty-state.** The strategy fingerprint is only meaningful after R3 + reveal, but `analysisOpen` already gates the deck to `phase in {'reveal', 'finale'}`. So this screen is *never* rendered before R3 + reveal — no empty-state needed. The fallback message in the prose ("Not enough rounds yet...") is unreachable; remove it if implemented as written. The "Strategy" tab in `StageNav` is hidden until the room has ≥3 rounds of history. (Phase 8's screen 6 is *Your journey* — strategy is screen 7 in the same phase.)
S7. **The priority-color variables need a Tailwind safelist.** Tailwind v4's JIT doesn't include `--priority-N` automatically; either expose them as CSS variables (no JIT needed) or add them to the safelist config. The CSS-variable route is simpler — `var(--priority-3)` works in any `style:` attribute.
S8. **LinkedIn frame color inheritance.** If `priorityColor` is unavailable in `linkedin-frame.ts` (it's a `.ts` file, not `.svelte`), inline the array from `config.ts`. Don't import directly into the `client/` folder (the `index.ts` is deprecated per [gotcha 16](#gotchas)). Use `import { priorityColor } from '$lib/game'`.

### Persona hashtags + post-game badges (Phase 7, additive — *hashtag shipped; badge helper landed; badge UI pending MobileSealed.svelte*)

Today the persona card (home page, `BoardSheet.svelte`, phone header) shows: persona name, lens, color dot, table ID, QR code. The persona's *identity* is conveyed through color + name only — there's no memorable single-line tag participants can rally around. And after the game, the persona's *play* (what they actually did) is conveyed only through the read-aloud narrative.

Two new fields land the same data on three surfaces:

**Hashtag** (static, brand-y, always shown):
- New optional field on `Persona`: `hashtag?: string` (e.g. `#FootprintShrinker`, `#PeopleOptimizer`, `#AIAdopter`, `#CostDisciplinarian`, `#ResilienceBuilder`, `#BrandBuilder`, `#EnterpriseOptimizer`).
- Lives in `src/lib/game/config.ts` next to `name`, `lens`, `bias`, `mission`, `strength`, `risk`.
- Format: `#PascalCase` (one word, one hash, no spaces). Host-editable per session via the Game Config editor.
- Always rendered on: home page card, `BoardSheet.svelte` (printed board), phone header (`MobileHeader.svelte`), LinkedIn share frame header.
- Brand voice rule: the hashtag *is* the persona's vote slogan. It must fit on one line, be readable on a phone in 14 px text, and not exceed 18 characters (excluding the `#`).

**Badge** (dynamic, post-game, derived from `strategySignature`):
- Computed per-table after R3 reveal. Lives in the same `strategySignature.protected` shape — the existing `protected` array already names the priorities each function held the line on.
- The badge is the *first* entry of the table's `protected` array, ranked by `shareR3` (highest share wins). E.g. "Held Future Readiness" or "Cut Talent — 60%".
- Rendered on: post-game phone card (`MobileSealed.svelte`, the "Your strategy" card), LinkedIn share frame header (next to the priority color pill), presenter screen 7 strategy strip's hover tooltip.
- Empty-state: when `strategySignature.protected` is empty for a table (no held priorities), the badge reads "Balanced" or "No-op" — never blank.

**Visual mock-up** (home page card, after Phase 7):

```
┌──────────────────────────────────────────┐
│  ● Real Estate                            │
│  Table 1                                  │
│  Optimise portfolio & reduce footprint    │
│  #FootprintShrinker                       │ ← new hashtag line, monospace, brand gold
│                                          │
│       [QR CODE]                            │
│                                          │
│  Open Board →                             │
└──────────────────────────────────────────┘
```

**Visual mock-up** (post-game phone card, after Phase 7):

```
┌──────────────────────────────────────┐
│  YOUR STRATEGY                       │
│                                      │
│  Held Future Readiness               │ ← new badge line, priority-colored, bold
│  $40M of $100M across R2-R3.         │
│                                      │
│  You were protection-dominant on     │
│  Future Readiness: ...               │
│                                      │
│  #FootprintShrinker                  │ ← persona hashtag
│                                      │
│  Protected:  Future Readiness        │
│           Cost / ROI                 │
│           Innovation                │
└──────────────────────────────────────┘
```

**Data flow** (additive, no schema breaks):

```
config.ts       (hashtag field on Persona)        ← static
  ↓
Persona.cards   (rendered everywhere a persona card renders)

t.matrix        (existing per-table bets)
  ↓
strategySignature(room)
  ↓
room.strategy.protected[i]   (existing per-seat array)
  ↓
badgeForTable(room, tableId)  (new helper: protected[0] → "Held {name}")
  ↓
Post-game phone card, LinkedIn frame, presenter screen 7
```

**Why both hashtag and badge?**

The hashtag is the persona's *declared identity* — what they said they'd do. The badge is the persona's *observed play* — what they actually did. When the hashtag and the badge tell the same story, the room celebrates. When they don't (HR declares `#PeopleOptimizer` but their badge says "Cut Talent"), the *fault* is visible — that's the strategy disclosure section's whole point. Both fields are additive; both surface on the same card.

(See [Visual flow] below for the corresponding strategy-flow mock-ups.)



### Visual flow — what each consumer looks like with strategy

The data flow above describes *what* each consumer receives; this sub-section shows *how it renders* on each surface. Each block is a UI mock in prose — meant to keep the implementation and review teams aligned on appearance before code.

**Phone "Your strategy" card** (`MobileSealed.svelte`, after submit on R2/R3/R5):

```
┌──────────────────────────────────────┐
│  YOUR STRATEGY                       │ ← micro-cap, brand gold
│                                      │
│  ┌─ Held Future Readiness ────────┐ │ ← post-game badge
│  │  $40M of $100M across R2-R3  │ │   priority-colored border
│  └─────────────────────────────────┘ │
│                                      │
│  You were protection-dominant on     │ ← 14px body
│  Future Readiness: you held $40M     │
│  there across R2-R3 while the room   │
│  cut it $30M overall. The room       │
│  noticed.                            │
│                                      │
│  #FootprintShrinker                  │ ← persona hashtag, monospace, gold
│                                      │
│  Protected:  Future Readiness        │ ← 3 pills, priority-colored border
│           Cost / ROI                 │
│           Innovation                │
└──────────────────────────────────────┘
```

**Presenter screen 7 "Strategy"** (Phase 8):

```
┌────────────────────────────────────────────────────────────────┐
│  STRATEGY                                                       │ ← screen title (Inter Display 800, 72px)
│                                                                │
│  The room is protection-dominant on R3.                        │ ← formatStrategyForRoom().headline
│                                                                │
│  ┌─ Marketing ──────┐ ┌─ HR ──────────┐ ┌─ IT ──────────┐     │
│  │ ● protective     │ │ ● additive    │ │ ● balanced    │     │ ← StrategyStrip
│  │ held $40M FR     │ │ +$20M Talent  │ │ ±$0M          │     │   7 dots, color by strategy
│  └──────────────────┘ └───────────────┘ └───────────────┘     │   palette (green/navy/teal/muted)
│  ┌─ Finance ────────┐ ┌─ Operations ──┐ ┌─ Marketing ──┐     │
│  │ ● protective     │ │ ● protective  │ │ ● protective  │     │
│  │ -$40M Talent     │ │ -$40M Talent  │ │ held $40M FR  │     │
│  └──────────────────┘ └───────────────┘ └───────────────┘     │
│  ┌─ C-Suite ────────┐                                            │
│  │ ● no-op          │                                            │ ← dot shows who participated
│  │ held everything  │                                            │
│  └──────────────────┘                                            │
│                                                                │
│  Contested: Cost / ROI                                          │ ← contested-priority chord strip
│  [ribbon: C-Suite 60%] [ribbon: Marketing 5%] [ribbon: IT 12%] │   ribbon color = priority color
└────────────────────────────────────────────────────────────────┘
```

**Host's emerging-analysis panel** (Phase 7, above Status on `/host/[code]/`):

```
┌────────────────────────────────────────────────────────────────┐
│  EMERGING ANALYSIS                                              │
│                                                                │
│         ╭─────────────╮                                          │
│        ╱   67   CGI    ╲     Common Ground Index 67            │ ← CGI ring + read-aloud
│        ╲   (Mixed)   ╱                                          │
│         ╰─────────────╯                                          │
│                                                                │
│  The room is protection-dominant.                              │ ← headline, 1 line
│  Protected: Future Readiness, Cost / ROI.                      │ ← protected list
│  Contested: Talent (highest variance across functions).         │ ← contested priority
└────────────────────────────────────────────────────────────────┘
```

**LinkedIn share frame** header strip:

```
┌────────────────────────────────────────────────────────────────┐
│  #WeFoundCommonGround   [gold/teal ZyetaI wordmark]            │ ← existing chrome
│                                                                │
│  Your claim to fame:                                           │ ← new line
│  ┌────────────────────────┐                                    │
│  │  Future Readiness      │ ← priority-colored pill            │
│  │  $40M of $100M held    │ ← share-the-priority narrative     │
│  └────────────────────────┘                                    │
│                                                                │
│  #FootprintShrinker  ·  Marketing  ·  @function_name             │ ← hashtag + persona
│                                                                │
│  [verdict chip] [function name] [share CTA]                    │
└────────────────────────────────────────────────────────────────┘
```

**Brief prompt user-message** ( RapidI input, NOT a UI surface but the data shape — this is what the brand writer sees when editing the prompt):

```
ROOM STATE
  matrix:  [...]
  lead: Future Readiness (reach=7)
  fault: Talent (variance=...)
  blind: Productivity (least funded)
  cgi: 67 (Mixed)
  strategy: protection-dominant           ← NEW (Phase 8, see [AI integration])
  protected: Future Readiness, Cost / ROI ← NEW (Phase 8)
  contested: Talent                       ← NEW (Phase 8)
  journey: [22, 38, 71, 64, 84]
  verdict: Mixed

OUTPUT RULES
  ... (unchanged)
```

The RapidI *output* (the brief text) is unchanged in shape — still the brand voice, still 1 paragraph. The strategy context informs the narrative; it doesn't change the output format. **Empty-state**: when `room.strategy` is undefined (R1, R2, pre-reveal), the strategy lines are *omitted entirely*. The brief never blocks on strategy being present.

### Why "look" matters

The data flow is the *contract*; the visual flow is the *experience*. The two are coupled but not identical. The data layer (A–E above) defines what's possible; the look layer (this section) defines what the user actually *sees* and *feels*. Without this section, the implementer has to imagine the experience — and that imagination drifts between teammates. The mock-up pins it down.

**Trade-offs encoded in the look above:**

- **Phone card** uses `formatStrategyForFunction(room, tableId)` — the *1-paragraph narrative*, not 3 bullets. The phone is small; the participant wants *one story about themselves*, not analysis. The protected-list pills are decorative, not informational (the paragraph already names them).
- **Presenter screen** is a *grid of dots*, not a chart. The chart would be the CGI; the dots are *who did what*. A chart of strategies would be over-engineered — 7 boolean-ish values don't need a chart.
- **Host panel** has the *CGI ring* (existing) + the strategy headline + the lists. The ring is the trust signal; the lists are the data. The host needs *what to say*, not a chart.
- **LinkedIn frame** shows the *single most-protected priority* as a colored pill, not the full list. LinkedIn shares are 1-second reads; the priority color does the storytelling.
- **Brief prompt** keeps the strategy as *2 lines of facts*, not as a verbose paragraph.  RapidI writes the prose; we feed it facts. The prompt stays structured.

### Why this section sits at the end

The data flow (A–G) defines *what's possible*. The look section (this) defines *what the user sees*. Implementation should land the data flow first, *then* refine the look. The look is the polish pass, not the foundation.

## Master plan — 12 weeks, 11 milestones, 1 release
Everything above (Branding, UI/UX system, Analysis story, AI integration, Architecture & idempotency, UX deep review) is a *spec*. This section is the *plan* — how the specs land in order, what each phase unblocks, and what the live URL shows at each milestone. The plan is sequenced by **dependency** (early phases unblock later ones), by **risk** (low-risk first, so we can roll back easily), and by **demo value** (every milestone produces something visible on the live URL).

### Critical path (the one you must read first)

```
Phase 0 ────► Phase 1 ────► Phase 2 ────► Phase 3 ────► Phase 4 ────► Phase 5
fonts        design       session       store         prompts/      motion +
& tokens     tokens       class         idempotent    folder        actions

                                                       │
                                                       ▼
              Phase 6 ────► Phase 7 ────► Phase 8 ────► Phase 9
              5-min         phone +       chord +      SSE
              redesign      host          journey      push

              Phase 10 ◄──── Phase 11
              post-game      polish
```

The dependency order is **strict**: the design system (Phase 0–1) is the foundation; the session class (Phase 2) is the substrate for the idempotent store (Phase 3); the prompts folder (Phase 4) needs the idempotent store; the motion/actions (Phase 5) need the design tokens; the 5-minute redesign (Phase 6) needs the read-aloud function and the design system; the phone + host (Phase 7) need the design system and the analysis; the charts (Phase 8) need the design system and the read-aloud; the SSE (Phase 9) needs the idempotent store; the post-game (Phase 10) needs the charts; the polish (Phase 11) wraps everything.

**If you only have 1 week**: do **Phase 6** (the 5-minute redesign). Three changes, ~30 minutes, the live URL feels 10× more readable.

**If you only have 1 month**: do **Phases 0, 1, 2, 6**. That's the design system, the session class, and the 5-minute redesign. The live URL gets fonts, motion, and the read-aloud. ~3 weeks of work; the live URL is materially different.

**If you have 3 months**: do all 11 phases in order. The live URL ships a modern, boardroom-grade product by week 12.

### Phase 0 — Fonts + tokens (3 days)

**Goal**: drop in the new font stack, the semantic color tokens, and the motion tokens. Every later phase uses them.

**Deliverables**:

- `src/app.html` — swap Google Fonts URL to Inter / Inter Tight / JetBrains Mono (drop-in snippet in [UI/UX §1]).
- `src/app.css` — replace `@theme` block with the new font stack, semantic colors (`--color-fg`, `--color-action`, `--color-emphasis`, `--color-danger`, `--color-success`, `--color-border`, `--color-shadow-*`), and the `--ease-*` / `--dur-*` motion tokens (drop-in snippet in [UI/UX §3–4]).
- The `.t-display` / `.t-head` / `.t-body` / `.t-caption` / `.t-mono` / `.t-tabular` base classes ([UI/UX §2]).
- `body { font-feature-settings: 'tnum' 1, 'cv11' 1; }` for tabular figures everywhere.

**Risk**: low. Fonts and tokens don't change behavior. The reduced-motion override at the bottom of `app.css` stays in place; new motion tokens gate on it.

**Demo**: the live URL looks different on day 1. The font swap is the single biggest visual delta.

**Rollback**: revert the Google Fonts URL. ~30 seconds.

### Phase 1 — Branding + type scale (3 days)

**Goal**: the brand surface is consistent across all pages — wordmark, hashtag, palette, persona colors, type roles. No more "favicon is the Svelte logo".

**Deliverables**:

- `src/lib/assets/favicon.svg` — replace the orange "S" Svelte logo with the `CG` monogram SVG (drop-in snippet in [Branding]). The LinkedIn frame canvas uses the same SVG to brand the share image.
- `src/app.css` — fix the `--color-seat*` drift by aligning with `PERSONAS[].color` in the order Real Estate / HR / IT / Finance / Operations / Marketing / C-Suite ([Branding fix]).
- The wordmark "COMMON GROUND" uses `var(--font-display)` (Inter Tight 900) with `letter-spacing: -0.04em` + uppercase, on every page (home, host, presenter). The `font-family: 'Playfair Display', sans-serif` literal in `Chip.svelte:30` and any inline `font-family` in `present/*.svelte` / `phone/*.svelte` is replaced with `var(--font-display)`.
- `<svelte:head>` on every page: `<meta name="description" content="…">`, an OpenGraph title/description, and the favicon link.

**Risk**: low. Brand changes are cosmetic; persona color fix changes the visible dot on the home page card, the heatmap cells, and the chord diagram. The drift fix actually *corrects* a bug (the seat colors were misaligned with the persona order).

**Demo**: the home page card has a 12 px colored dot instead of 3 px; the wordmark is Inter Tight 900 instead of Playfair Display 800; the favicon is a brand mark in the browser tab.

**Rollback**: revert the favicon SVG; restore the old seat tokens; revert the wordmark. ~1 minute.

### Phase 2 — Session as a Svelte 5 class (3 days)

**Goal**: `session.svelte.ts` is no longer a hand-rolled Svelte 4 + runes glue. It's a class with `$state` fields, `AbortController`-driven polling, and a discriminated `error` union. The polling fetches with `If-None-Match` so the server returns `304 Not Modified` when nothing changed.

**Deliverables**:

- `src/lib/state/session.svelte.ts` — rewrite as `class SessionState` with `$state.raw<RoomState>`, `connected`, `busy`, `error` (discriminated union), and an `AbortController`. The `boot()` returns a teardown closure. The polling loop is an `async tick()` that uses `signal: this.abort.signal` and short-circuits on `AbortError` (drop-in snippet in [Architecture B]).
- `src/routes/+layout.svelte` — `onMount(() => const teardown = session.boot(); return teardown;)` and `onDestroy(teardown)`.
- The polling fetch sends `If-None-Match: W/"${this.room?.updatedAt ?? ''}"`. Server returns `304` when unchanged (this needs the server side; see Phase 3).
- `Object.freeze(room)` in `applyRoom` so bugs that try to mutate `room.aggregate.matrix[i]` directly throw.

**Risk**: medium. The class is a new shape; every component that imports `session` (most of them) needs to keep working. The discriminated `error` union is a breaking change for any code that does `if (session.error)` — there's no `if (session.error)` anymore, only `if (session.error.kind === 'fatal')`. **Search and update** every call site.

**Demo**: the polling stops when the tab is backgrounded, resumes on focus. The connection state is more accurate. The error state has a `retry` callback.

**Rollback**: revert `session.svelte.ts` to the module-level pattern. ~5 minutes.

### Phase 3 — Store + idempotency (5 days)

**Goal**: every mutating endpoint is idempotent under retries, safe under concurrent isolates, and uses ETag / If-Natch for optimistic concurrency. The in-process `Store` singleton is replaced with read-then-mutate-then-conditional-UPDATE on a per-request basis.

**Deliverables**:

- `src/lib/server/live.ts` — drop the singleton. New `mutateRoom(fn)` shape (drop-in snippet in [Architecture A.5]) that does `loadRoom(d) → fn(current) → conditional UPDATE`. On `If-Match` conflict, retry 3 times, then 409.
- `src/lib/server/room-store.ts` — add `If-Match` support to `saveRoom` (SQL `UPDATE ... WHERE id = ? AND updated_at = ?`).
- `Idempotency-Key` header on every mutating `POST`. New D1 table `idempotency (key TEXT PRIMARY KEY, status INTEGER, body TEXT, created_at INTEGER, expires_at INTEGER)`. New helper in `src/lib/server/idempotency.ts` (~30 lines) that wraps every mutating handler.
- `GET /api/room/${SESSION}/state` returns `ETag: W/"${room.updatedAt}"`. `If-None-Match` returns `304 Not Modified` with no body.
- Validator: `^[a-zA-Z0-9-]{8,128}$` for the `Idempotency-Key` header.

**Risk**: high. The conditional-UPDATE pattern changes the concurrency model. Every mutation must be re-tested for race correctness. **Run the test suite in concurrent mode** (`vitest --repeat 100 --reporter=verbose`) to flush out the bugs.

**Demo**: the live URL no longer silently loses data on double-click. A presenter advancing from two devices gets a 409 on the second one (with a "Room changed — please retry" toast). A retry of the same request with the same `Idempotency-Key` returns the cached response.

**Rollback**: revert the conditional-UPDATE; restore the unconditional `INSERT ... ON CONFLICT DO UPDATE`. The idempotency table is additive — leave it. ~30 minutes.

### Phase 4 — Prompts as data (3 days)

**Goal**: brand voice lives in `src/lib/server/ai/prompts/` as JSON, renderers are TS, the registry is typed, the `promptHash` is returned in every AI response. The AI module is the cleanest part of the codebase.

**Deliverables**:

- `src/lib/server/ai/prompts/_schema.ts` — `PromptMeta`, `ChatPrompt<M>`, `ImagePrompt<M, I>` (drop-in snippet in [AI integration Prompts as data, not code]).
- `src/lib/server/ai/prompts/brief.system.json` — the ZyetaI brand voice, in 6 sections (role, audience, voice, vocabulary, structure, constraints) per the refined system prompt in [AI §Refined system prompt (proposed)].
- `src/lib/server/ai/prompts/brief.user.json` + `brief.user.ts` — the slot text + the renderer (`buildBriefFacts(room) → BriefFacts`, `renderUserPrompt(facts)`).
- `src/lib/server/ai/prompts/image.finale.json` + `image.finale.ts` — the room-render template + the renderer.
- `src/lib/server/ai/prompts/image.table.json` + `image.table.ts` — the per-function template + the renderer.
- `src/lib/server/ai/prompts/registry.ts` — `BRIEF`, `ROOM_RENDER`, `TABLE_RENDER`, `PROMPTS`, `promptHash(meta, system)`.
- `src/lib/server/ai/rapidi.ts` — collapse to ~25 lines, calls `PROMPTS.brief`.
- `src/lib/server/ai/fal.ts` — collapse to ~25 lines, calls `PROMPTS.roomRender`.
- `src/lib/game/brief.ts` — drop `finalePrompt`, `tableFunctionPrompt`, `briefFactsForRapidi`. Keep `priorityMix`, `spatialProgramFromAggregate`, `buildEnhancedBrief`. Add `readAloudForRoom(room)` (see Phase 6).
- `scripts/lint-prompts.ts` — the prompt lint script (60 lines, [AI integration Wiring & shrunken plumbing]).
- `package.json` — add `"lint:prompts": "bun run scripts/lint-prompts.ts"`.

**Risk**: low-medium. The renderer logic is the same; the *place* it lives is different. The system prompt text changes — verify the brief output reads as expected.

**Demo**: a brand writer can now edit `brief.system.json` in a PR. The system prompt version is in the meta. The `promptHash` in every AI response tells the client "this brief was generated with v2026.07.0 of the system prompt".

**Rollback**: revert the prompts/ folder; restore `rapidi.ts` and `fal.ts` to their previous shape. The renderers in `brief.ts` are still there (we don't delete them until Phase 4 ships). ~30 minutes.

### Phase 5 — Motion + actions (1 week)

**Goal**: every component uses the design tokens. The Svelte 5 actions (`use:ripple`, `use:countUp`, `use:confetti`) ship. The hand-rolled fetch is replaced with `use:enhance` where it makes sense. Modal entrance animations land.

**Deliverables**:

- `src/lib/actions/ripple.ts` — Material-style click ripple, ~30 lines, drop-in snippet in [UI/UX §8].
- `src/lib/actions/confetti.ts` — chip scatter on `MobileSealed` mount, ~30 lines, drop-in snippet in [UI/UX §5].
- `src/lib/actions/count-up.ts` — 280ms `$` amount animation, ~30 lines, drop-in snippet in [UI/UX §6]. (Or use `Tween` from `svelte/motion` per Architecture C.6.)
- `src/lib/components/Button.svelte` — add `use:ripple` to the rendered button/anchor. Add `transform: scale(0.97)` on `:active`. Reference `var(--font-display)`, `--dur-fast`, `--ease-out-quart`.
- `src/lib/components/Modal.svelte` — entrance animation `scale 0.96 → 1` + opacity 0 → 1 over `--dur-base`. Add the `<svelte:boundary>` for partial UI failure.
- `src/lib/components/ExpandImage.svelte` — same entrance treatment. Image scales in 0.92 → 1.
- `src/lib/components/present/FutureWorkspace.svelte` — wrap body in `<svelte:boundary>`. Replace the hand-rolled brief-edit modal with `<Modal bind:open={briefOpen}>`.
- `src/lib/components/present/FutureTableGrid.svelte` — replace `for...of await` with `Promise.allSettled(ready.map(...))` + concurrency 2.
- `src/routes/host/[code]/+page.svelte` — `Save Budget` becomes `<form method="post" use:enhance={...}>` (Phase 7 does the full split, this is the first half).
- `src/routes/+layout.svelte` — add the `onNavigate` + `document.startViewTransition` cross-fade (drop-in snippet in [UI/UX §7]). Browsers without the API no-op.

**Risk**: low. Animations are additive; the existing components still work. The `use:enhance` migration is the only API change, and it preserves the same handler shape.

**Demo**: the live URL feels alive. Every button has a ripple. Every `$` amount counts up from 0. The submit seal has confetti. Modals ease in. Route changes cross-fade (in Chrome/Edge).

**Rollback**: remove the action imports; revert Button/Modal/ExpandImage. ~10 minutes.

### Phase 6 — The 5-minute redesign (3 days, the smallest ship)

**Goal**: the presenter deck reads as a *story*, not a feature list. The "extra" modal is primary content. The room has a read-aloud on every screen.

**Deliverables**:

- `src/lib/game/brief.ts` — add `readAloudForRoom(room)` (~30 lines, drop-in snippet in [Analysis: the Common Ground story §`readAloudForRoom(room)`]).
- `src/routes/present/[code]/+page.svelte` — replace the 5 screen titles in `SCREENS[]` (lines 19-25) with plain-English labels: "Where we agree", "Where we fight", "What we missed", "Who surprised us", "Our future". Promote the chord diagram and headlines to primary deck content.
- A reusable `<ReadAloudButton room={room} />` component (~30 lines) — a sticky bottom-right button that copies `readAloudForRoom(room)` to the clipboard with a 2-second "✓ Copied" pulse.
- Wire `<ReadAloudButton>` into every presenter screen pane.

**Risk**: low. The screen title change is a string. The read-aloud button is a new component, not a refactor. The chord-diagram promotion is moving 2 components from a hidden modal to primary deck content.

**Demo**: the live URL's presenter page now reads as a story. Every screen has a "📋 Read aloud" button bottom-right that copies the read-aloud. The deck starts with "Where we agree" instead of "Combined Board Heatmap". The room has its first "Aha" moment.

**Rollback**: revert the screen titles. The read-aloud button is additive — remove it. ~10 minutes.

### Phase 7 — Phone + host UX (2 weeks)

**Goal**: the phone has a mission, a timer, and a leaderboard. The host page is split into 4 routes. The host has a color picker, a "lock all" button, and the emerging-analysis panel.

**Deliverables**:

- **Phone** (`src/routes/play/[code]/[table]/+page.svelte` and components):
  - Add the mission to `MobileHeader.svelte` (a `<details>` below the question with the persona's `mission` from `PERSONAS[seat].mission`).
  - Add `roundStartedAt: number` to `RoomState` and a `remainingMs()` derived on the phone (5-min per-round countdown).
  - Add `<CountUp>` (the action from Phase 5) to the `total` in `FunctionBoard.svelte`.
  - Add the "your surprise" callout in `MobileSealed.svelte` if `room.aggregate.surprise?.seat === tableSeatIndex(tableId)`.
  - Add the "room leaderboard" strip below the seal (top 3 priorities, refreshable every 2s).
  - The "Selfie & LinkedIn" button is always present, with a "Generate first" prompt if no image.
  - The `MobileHeader.svelte` hint shows on R1 (`mode='wait'`) too, not just capture rounds.
- **Host** (split into 4 route files):
  - `/host/[code]/+page.svelte` (now ~150 lines) — status + tables.
  - `/host/[code]/config/+page.svelte` — the Game Config editor with `<input type="color">` for persona colors, `<textarea rows="2">` for multi-line fields, per-persona/per-scenario "Reset to default" buttons, and full validation.
  - `/host/[code]/export/+page.svelte` — the export + downloads + reset (with `<Modal>` typed-input confirm).
  - `/host/[code]/analysis/+page.svelte` — the emerging-analysis panel: `<CgiHero room={room} />` + `<PriorityMixBars room={room} />` + the 1-line `readAloudForRoom`.
  - A `<HostNav>` sidebar component with 4 tabs, used on all 4 routes.
  - "Lock all" button with 5-second undo toast + keyboard shortcut `L`.

**Risk**: medium. The 4-route split is a big refactor. The new phone surfaces need careful testing across iOS Safari (the camera + clipboard paths). The host split touches the presenter page's link (`+page.svelte:130`).

**Demo**: the phone shows the participant's mission, a 5-min countdown, and a leaderboard. The host sees 4 tabs and the emerging analysis. The "Lock all" is one click + one toast.

**Rollback**: revert the host route split (revert to a single 555-line component). The phone changes are additive — they can be removed one by one. ~1 hour.

### Phase 8 — The analysis charts (2 weeks)

**Goal**: the room's analysis lands with charts that tell a story. The CGI hero is the single anchor. The chord diagram shows "where do we fight". The journey shows "how did we get here". A 6th screen "Your journey" tells the room's full story.

**Deliverables**:

- `src/lib/components/analytics/CgiHero.svelte` — the 120pt ring + verdict + 1-line read-aloud. Used in presenter screens 1, 2, 3, 4, 5, 6, and the host's emerging-analysis panel.
- `src/lib/components/analytics/ChordDiagram.svelte` — 7-persona ring with 21 ribbons, alpha = cosine similarity. Teal when aligned, red when fighting. ~80 lines of SVG.
- `src/lib/components/analytics/PersonaAgreement.svelte` — 7 dots on a horizontal axis at `t.commonGround` x position, persona-color, surprise outlined in gold. ~50 lines.
- `src/lib/components/analytics/PriorityMixBars.svelte` — 7 horizontal bars, sorted desc, the lowest 1–2 tagged BLIND. ~60 lines.
- `src/lib/components/analytics/JourneyChart.svelte` — CGI over time, R1–R5, with a line chart and per-round dots. Reads `room.history[]`. ~50 lines of SVG.
- `src/lib/components/analytics/StrategyStrip.svelte` — per-function strategy strip (the 7th screen "Strategy" chart). Reads `room.strategy`; one dot per function. ~60 lines.
- `src/lib/components/analytics/FunctionStrategyDot.svelte` — single dot with hover tooltip showing protected + contested. ~30 lines.
- Update `src/lib/game/scoring.ts` — extend `roomInsights()` with `pairs`, `agreement`, `mix` per [Analysis: the Common Ground story §Computed additions]. Add `strategySignature(room)`, `formatStrategyForRoom(room)`, `formatStrategyForFunction(room, tableId)`.
- Update the 5 screens to use the new charts: RoomGlance = CgiHero + PriorityMixBars, RoomInsights = CgiHero + ChordDiagram + fault/surprise callout, PriorityConstellation = CgiHero + bars with BLIND, WinnersLosers = CgiHero + PersonaAgreement, FutureWorkspace = CgiHero + Lead→Resolve→Protect strip + FutureBrief/Gen/Grid.
- Add a 6th screen "Your journey" = JourneyChart + CgiHero + a "We started divided, ended aligned" 1-line summary.
- Add a 7th screen "Strategy" = StrategyStrip + the contested-priority chord ribbon + the room's headline (`formatStrategyForRoom().headline`).
- Wrap each new chart in `<svelte:boundary>` so a chart error doesn't take the deck down.

**Risk**: medium-high. The chord diagram and journey chart are non-trivial SVG. The scoring changes to `roomInsights()` are additive but every consumer needs the new fields. Screens 6 and 7 break the `present.total = 5` invariant — `StageNav` and the keyboard nav need updating for 7 total screens.

**Demo**: the live URL's presenter page is now visually the most important part of the product. The chord diagram shows the room's tensions. The journey tells the story of the session. The CGI hero is on every screen.

**Rollback**: revert the chart components; restore the old 5 screens. The scoring additions are additive. ~2 hours.

### Phase 9 — SSE push (1 week)

**Goal**: the 500ms poll disappears. The server pushes a `data:` frame whenever `store.persist(d)` runs. The client uses `EventSource` with a polling fallback.

**Deliverables**:

- `src/lib/server/live.ts` — add `subscribeToRoom(callback)` pub/sub. The `Store.persist` calls `notifySubscribers(room)`.
- `src/routes/api/room/[code]/stream/+server.ts` — new endpoint that returns a `text/event-stream` (drop-in snippet in [Architecture D]).
- `src/lib/state/session.svelte.ts` — replace the polling loop with `new EventSource('/api/room/LIVE/stream', { withCredentials: true })`. `eventSource.onmessage = (e) => this.applyRoom(JSON.parse(e.data))`. Polling fallback (`setInterval(this.tick.bind(this), 5000)`) on `EventSource.readyState === CLOSED`.
- Heartbeat every 15s (`enqueue(':hb\n\n')`) to keep the connection alive.
- Reconnect with `Last-Event-ID` so the client resumes from the last ETag.

**Risk**: high. SSE is a long-lived connection; the Worker has a 1,000 in-flight request limit per isolate. For 30 users × 1 room, this is fine. For multi-room, this is the first architectural step toward Durable Objects. The polling fallback must work even if SSE is unsupported (Safari < 16, Firefox).

**Demo**: the live URL's presenter page refreshes within 100 ms of a phone's chip placement (down from 500 ms avg). The 500 ms poll is gone in Chrome/Edge.

**Rollback**: revert the stream endpoint; restore the polling client. ~30 minutes.

### Phase 10 — Post-game + share (1 week)

**Goal**: the climax of the session is a "we did it" moment. The room has a full-screen reveal with the CGI hero, the verdict, the lead, and a single CTA. The LinkedIn share card is a full-screen takeover with a QR code.

**Deliverables**:

- `src/lib/components/present/Reveal.svelte` — full-screen reveal: 200 px CGI hero at the top, the verdict phrase ("Aligned at 84/100"), the lead priority and its %, a "Press to continue →" button. The whole screen has a slow-fade entrance + a single shared element transition.
- `src/lib/components/present/ShareScreen.svelte` — full-screen LinkedIn share: QR code, persona name + $, "Download frame" button, "Open LinkedIn (caption copied)" button. Includes a `use:confetti` on download.
- Wire `Reveal` into the presenter's "Open deck" flow — the first screen of the deck is `Reveal` for `phase in {reveal, finale}`.
- Wire `ShareScreen` into `MobileRender.svelte:174-177` (replace the inline "Selfie & LinkedIn" modal).
- `<svelte:head>` meta tags on the home page: `<meta property="og:title" content="Common Ground · {personaName}">`, `<meta property="og:description" content="{readAloudForRoom(room)}">`.
- "Export deck" button on the post-game screen: server-side route that captures the 6 screens as a single PNG (using `@cloudflare/puppeteer` or a simple canvas-based composition).

**Risk**: medium. The "export deck as PNG" requires either `puppeteer` (heavy) or a canvas-based composition (light but fiddly). The full-screen reveal changes the presenter's first impression of the deck — make sure the existing keyboard nav still works.

**Demo**: at the end of R5, the presenter advances to `reveal`. The room sees the CGI hero at 200 px, the verdict, the lead, and "Press to continue". On the phone, the LinkedIn share card is a full-screen QR + "Download frame" + "Open LinkedIn".

**Rollback**: revert the reveal and share components. ~30 minutes.

### Phase 11 — Polish (1 week)

**Goal**: the live URL is production-ready. Observability is in place. The doc is the deliverable.

**Deliverables**:

- **Observability**: `console.info` (visible in the Pages dashboard logs; `wrangler tail` is unavailable here) on every `mutate` and every `persist` — include the idempotency key, the `If-Match` value, the contention result.
- **A11y audit**: every interactive element has a `<button>` or `<a>` (no `<div onclick>`); every form has a label; the focus ring is visible; the colour contrast meets WCAG AA (4.5:1 for text, 3:1 for large text).
- **Reduced-motion audit**: every new animation gates on `prefers-reduced-motion`. Run the doc's "Reduced-motion" checklist in [UI/UX §4].
- **Test coverage**: 70%+ on `src/lib/game/`. Add a `vitest` config for in-process tests of `applyBoardDelta`, `applySubmitTable`, `applyAdvance`, `applyRetreat`. The current `src/lib/game/rules/rules.test.ts` covers most of this; add edge cases.
- **Deploy**: `bun run build && wrangler pages deploy`. Watch for 5xx by polling `/api/room/LIVE/state` — `wrangler pages deployment tail` does NOT work on this project (advanced-mode `_worker.js`; Cloudflare answers "does not have a Pages Function", code 8000098). Use the dashboard's Pages analytics or black-box probes instead. Verify the live URL at `https://common-ground.zyeta.asia/host/LIVE` matches the design.
- **Doc**: the doc *is* the deliverable. The user reads it. Update it: the *current* state is the *spec* state. Mark the "proposed" sections as "shipped" with version stamps.

**Risk**: low. Polish is a series of small fixes; nothing is structural.

**Demo**: the live URL is production-grade. The doc is the design contract. The "what we built" story is one PR away from the "what we spec'd" story.

### The shipping cadence

| Phase | Duration | Live URL looks like | PR is |
|---|---|---|---|
| 0 | 3 d | New fonts everywhere | One CSS+HTML change, ~50 lines |
| 1 | 3 d | Brand wordmark, persona colors, type roles | One SVG + 5 component edits |
| 2 | 3 d | Polling stops on background, cleaner errors | One rewrite of `session.svelte.ts` |
| 3 | 5 d | Idempotent retries, no data loss on double-click | One server-side refactor + D1 schema |
| 4 | 3 d | Brand-voice prompts in JSON, prompt version in responses | New `src/lib/server/ai/prompts/` folder + `rapidi.ts`/`fal.ts` collapse |
| 5 | 1 wk | Animations feel right; `use:enhance` everywhere it should be | New `src/lib/actions/` folder + 5 component edits |
| 6 | 3 d | **Presenter deck reads as a story; read-aloud button** | New `<ReadAloudButton>` + 3 string changes + 1 chart move |
| 7 | 2 wk | **Phone has mission, timer, leaderboard; host has 4 tabs** | 4 new route files + 1 sidebar + 5 component edits |
| 8 | 2 wk | **CGI hero, chord diagram, journey chart, 6th screen** | 5 new chart components + 1 new screen + scoring additions |
| 9 | 1 wk | **Polling replaced by SSE; <100 ms refresh** | New `stream/+server.ts` + `EventSource` in `session.svelte.ts` |
| 10 | 1 wk | **Post-game reveal + share screen** | 2 new components + meta tags + share pipeline |
| 11 | 1 wk | Production-grade, observability, a11y | Docs + 1 deploy |

**Total: ~12 weeks, 11 milestones, 1 release.** Every milestone has a visible demo on the live URL.

### What you do *today* if you have 30 minutes

Open the live URL. Read the homepage. Read the host page. Read the presenter page. **Walk through the 5 user flows in §A of the UX deep review.** Pick the 3 things that bother you most. Those are your first 3 PRs. The plan above is the longer view; the user-flow audit is the shorter one. The plan is the *map*; the user flows are the *territory*. Walk the territory first; then check the map.

### What you do *today* if you have 2 hours

Open the doc. Read the **Branding** section. Make the favicon change (drop-in SVG). Update the seat color tokens. **Ship one PR.** The live URL has a brand mark in the tab and the persona colors are correct. ~30 minutes of work, +∞ in brand equity.

### What you do *today* if you have a day

Open the doc. Read the **UI/UX system** section. Drop in the new fonts. Add the motion tokens. **Ship one PR.** The live URL looks different on day 1. The font swap is the single biggest visual delta.

### What you do *this week* if you have a week

Open the doc. Read the **UX deep review** §F. Do phases 0, 6, and 7 in order. **The live URL is materially different by Friday.** Fonts land. The 5-minute redesign lands. The host page is split into 4 routes with the emerging analysis panel. The phone has a mission and a timer. **One week, one product update.**

### What you do *this quarter* if you have 12 weeks

Execute the full plan. **The live URL ships a modern, boardroom-grade product.** Fonts, motion, gamification, analysis charts, idempotent server, push-based refresh, post-game share. **The Common Ground story is told end-to-end.** The doc becomes a changelog: every "proposed" section gets a "shipped" stamp.

### The single biggest risk

The SSE work in Phase 9 is the only thing that can break the live URL under load. The polling fallback in the same phase means the worst case is "polling continues" — never a broken page. The single biggest *non*-risk is **not shipping**: every phase is independent. Even Phase 0 (fonts) is a self-contained, rollback-safe PR. **Ship something every week.** The plan rewards consistency, not a big bang.

### The single biggest unlock

The conditional-UPDATE pattern in Phase 3 unlocks idempotency (Phase 3), the prompts folder (Phase 4), the AI cache (Phase 4), and the SSE push (Phase 9). Every later phase depends on the store being correct. **Phase 3 is the foundation of every future work.** Don't skip it. Don't half-do it. The test suite in concurrent mode is non-negotiable. If the conditional-UPDATE is wrong, the data loss is silent and the live URL looks fine for a week. **Test it.**

### What success looks like at week 12

- A facilitator walks up to the live URL, scans a QR, lands on a phone with their mission, places 10 chips in 3 minutes, sees the room's reaction, downloads a LinkedIn frame, posts it, and walks out. Total time: 12 minutes. **Every step has a micro-interaction that rewards the user.** Every screen has a read-aloud the presenter can read. The CGI hero is the first thing the room sees. The chord diagram is the most-discussed chart. The journey tells the story of the session. The data is correct under concurrent retries. The polling is replaced by push. The brand is consistent across every page. **The product feels alive.**

## Important files

| Path | Purpose |
|---|---|
| `src/lib/server/store.ts` | Single LIVE room, `Store` class, `recompute()`, all mutation methods. `setTableCount` clamps to `[1, N_SEATS]`. `setConfig` accepts only `analysisForced` and `roomBountyTokens`. |
| `src/lib/server/live.ts` | Request-scoped D1 binding, `withLiveRoom` (sync + mutate + persist) and `readLiveRoom` (seed-on-empty). |
| `src/lib/server/room-store.ts` | D1 table `room (id, data, updated_at)`, single row id `'LIVE'`, `INSERT … ON CONFLICT(id) DO UPDATE`. `ensureSchema` runs once per isolate. `loadRoom`/`saveRoom` swallow errors with `console.error` prefix. |
| `src/lib/server/ai/rapidi.ts` | Thin wrapper around the chat model — system prompt + user-message prompt with priority mix, lead/fault/blind, surprise, journey, verdict. Returns `null` on no binding / no stake / short reply / failure; caller falls back to `buildEnhancedBrief`. Exported `AiBinding` type used by `app.d.ts`. The four prompt strings live in `src/lib/server/ai/prompts.ts` (`finalePrompt`, `tableFunctionPrompt`, `briefFactsForRapidi`, `designCardsJsonForRapidi`). |
| `src/lib/server/ai/fal.ts` | Thin wrapper around the fal image model. `ImageResult = { url } \| { url: null, error: 'no_key' \| 'failed' }`. Prompt construction lives in `src/lib/server/ai/prompts.ts`. |
| `src/lib/state/session.svelte.ts` | Polling client. `INTERVAL = 500`, `If-None-Match` conditional polls, serialized `pollChain`, `$state.raw<RoomState>`, per-call `Idempotency-Key` with one same-key network retry, 409 → resync, post-advance poll +200 ms, refresh on `visibilitychange`. |
| `src/lib/state/present.svelte.ts` | `TOTAL = 5`, `screen` (1..5), `next`/`prev`/`setScreen`/`enterAnalysis`. |
| `src/lib/state/host.svelte.ts` | `tableCount` + `roomBountyTokens` drafts, `syncOnce(room)`, `resync(room)`. |
| `src/lib/game/rules/phase.ts` | `applyAdvance` / `applyRetreat` / `reopenBoards`. Boards never wiped; advance upserts `history` snapshot for the **leaving** round; retreat prunes history past current round. `reopenBoards` clears `analysisForced`. |
| `src/lib/game/rules/board.ts` | `applyBoardDelta` (caps adds to `tableBountyTokens`, reject on locked/wrong seat/remove round, value `0` rejected, NaN rejected), `applyBoardSet` (clamps to budget; on R3 clamps to standing), `applySubmitTable` (returns `SubmitTableResult`), `isRemoveRound`, `canEditTable`, `functionSeatOrNull`, `boardTokenSum`, `tableBountyTokens`. |
| `src/lib/game/config.ts` | `PERSONAS` (order = tableId), `PRIORITIES`, `PRIORITY_COLORS`, `ROUND_COUNT=5`, `EVOLUTION_ROUNDS = CAPTURE_ROUNDS = [2,3,5]`, `CHIP_VALUE=10`, `DEFAULT_TABLE_COUNT=7`, `DEFAULT_ROOM_BOUNTY_TOKENS=700`, `DEFAULT_TABLE_BOUNTY_TOKENS=100`, `SCENARIOS`, `SPACE`/`DESIGN_LONG`/`DESIGN_SHORT`, `isCaptureRound`. |
| `src/lib/game/scoring.ts` | `cosine`, `commonGround`, `commonGroundIndex`, `verdicts`, `surpriseToken`, `aggregate`, `recomputeTable`, `analysisOpen`, `roomInsights`, `winnersLosersByFunction`, `roomPortrait`, `snapshotFromRoom`, `upsertHistory`. |
| `src/lib/game/brief.ts` | Domain-only (no AI strings): `priorityMix`, `spatialProgramFromAggregate`, `buildEnhancedBrief` (numbers-only fallback for when  RapidI is unavailable), **`readAloudForRoom(room)`** (the canonical one-sentence story — used by every chart, the presenter deck, and the host page; see "Analysis: the Common Ground story"). **The AI prompt templates (`finalePrompt`, `tableFunctionPrompt`, `briefFactsForRapidi`) move out of this file** into `src/lib/server/ai/prompts/` — they cross the AI boundary, not the domain boundary. See "Prompts as data, not code" in [AI integration]. |
| `src/lib/game/types.ts` | `PRIORITIES`, `TableState`, `Aggregate`, `RoundSnapshot`, `RoomState`, `Persona`, `Scenario`, `Phase`, `RoundMove`, `RoundMode`, `TOKEN_VALUE_USD = 1_000_000`. |
| `src/lib/game/money.ts` | `tokenUnitLabel`, `tableWalletLabel`, `formatUsd` (compact), `formatUsdFull` (Intl). |
| `src/lib/components/phone/FunctionBoard.svelte` | Per-priority ± buttons step by `CHIP_VALUE` (10). R3 is remove-only. Enforces cap from `tableBountyTokens(room)`. Row-flash animation on change. `onpointerup` is used for touch handling with `touch-action: manipulation`. |
| `src/lib/components/phone/MobileRender.svelte` | Selfie (file input `capture="user"`) + LinkedIn frame composite. Has a hard-coded LinkedIn share origin fallback: `https://common-ground.zyeta.asia`. |
| `src/lib/components/present/FutureWorkspace.svelte` | Composes the ZyetaI concept/design surfaces; owns the editable brief modal (uses `session.updateBrief`, which persists via `/api/ai/brief-edit`). |
| `src/lib/components/present/future.svelte.ts` | Co-located UI state for Future Workspace screen (progress, err, briefOpen). |
| `src/lib/components/present/StageNav.svelte` | Dots + Back/Next buttons; `total` default = 5, but the caller passes `present.total`. |
| `src/lib/components/present/RoomGlance.svelte` | Strip (round / stake / budget) + per-table chips + `<PortraitMatrix>`. Comment in source: "Alignment lives on screen 2 — screen 1 is the board + money only." |
| `src/lib/components/present/PriorityBreakdown.svelte` | Screen 2 — per-priority breakdown of room stake. |
| `src/lib/components/present/RoundInsights.svelte` | Screen 3 — how the room evolved across capture rounds (SSOT: `roomInsights` + `roomRoundStory`). |
| `src/lib/components/present/PrioritiesSummary.svelte` | Screen 4 — what each function did (backed / dropped per function). |
| `src/lib/components/present/FunctionPriorities.svelte` | Screen 5 — per-function detail. |
| `src/lib/components/analytics/PortraitMatrix.svelte` | 7×7 heatmap of function × priority stake, `color-mix` per cell. The only remaining analytics component. |
| `src/lib/components/Modal.svelte` | Native `<dialog>` primitive with `$bindable` `open`. Uses `$effect` to call `showModal()`/`close()`. Backdrop click + native close sync `open` back. |
| `src/lib/components/QrCode.svelte` | Async `qrcode.toDataURL` on mount with green-on-cream colors. |
| `src/lib/components/Button.svelte` | Polymorphic: `<a>` when `href`, else `<button>`. Variants: `primary`/`secondary`/`teal`/`outline`/`ghost`/`danger`. Sizes: `sm`/`md`/`lg`. |
| `src/lib/components/Icon.svelte` | Inline monochrome SVG: 5 glyphs. Add a path when a new one is needed (the `paths` map is the only place to register). |
| `src/lib/components/ExpandImage.svelte` | Image lightbox with Download (catches CORS, falls back to `window.open`) + Open tab + Close (Esc). |
| `src/lib/components/ZyetaI.svelte` | Brand attribution pill. Two variants: `compact = "AI · ZyetaI"` and the default `"AI powered by ZyetaI"`. Styled with `var(--color-muted)` text and `var(--color-teal)` highlight on the "ZyetaI" span. |
| `src/lib/client/present-labels.ts` | `advanceLabel(phase, roundLabel)` (e.g. `"R3 → R4"`, `"Reveal →"`, `"Finale →"`), `canAdvance(phase)`, `canRetreat(phase)`. |
| `src/lib/client/linkedin-frame.ts` | Browser-only canvas composite (1200×630) for #WeFoundCommonGround frame; `linkedInShareText`, `openLinkedInShare`, `downloadLinkedInFrame`. Paints "Powered by ZyetaI" at bottom-right. |
| `src/routes/present/[code]/+page.svelte` | 5-screen presenter deck; keyboard nav (←/→/Space/Enter/N/B/A/E); extra analysis modal. Defines `SCREENS[]` order (Combined Board → Insights → Constellation → Trade-offs → Future Workspace). |
| `src/routes/host/[code]/+page.svelte` | Per-table lock/unlock, room budget editor (Save Budget), JSON export, image download (all + finale), reset. **No advance/retreat buttons** (presenter-only). |
| `src/routes/play/[code]/+page.svelte` | Table directory; `?table=1..7` deep links `goto` to `/play/{SESSION}/{fromQuery}`. |
| `src/routes/play/[code]/[table]/+page.svelte` | Mobile gameplay: see "Mobile page state machine" above. |
| `vite.config.ts` | Plugins: `tailwindcss()`, `sveltekit({ adapter: adapter-cloudflare(), compilerOptions: { runes: true (except node_modules) } })`. **No `svelte.config.js`.** |
| `tsconfig.json` | Extends generated `.svelte-kit/tsconfig.json`. Strict, `rewriteRelativeImportExtensions`, `allowJs`/`checkJs`, `moduleResolution: 'bundler'`. |
| `wrangler.jsonc` | Worker `common-ground-phygital`, `compatibility_date: 2026-07-01`, `nodejs_compat`, D1 binding `common_ground_db` → `common-ground-db` (id `7c40c4ce-932b-450c-97f4-3daab7907375`), Workers AI `AI`. |
| `vitest.config.ts` | `src/**/*.{test,spec}.ts`, node env, `$lib` alias. |
| `src/app.d.ts` | Augments `App.Platform.env`: `FAL_API_KEY?`, `FAL_KEY?`, `ANTHROPIC_API_KEY?` (declared, **unused**), `AI?: AiBinding`, `common_ground_db?: D1Database`. |
| `src/app.html` | Google Fonts (Playfair Display, Lora, Space Mono), responsive viewport, `data-sveltekit-preload-data="hover"`. |
| `src/app.css` | Tailwind v4 import + `@theme` tokens (gold/teal/red, seat colors 0–6 — drift note above, Playfair/Lora/Space Mono) + global focus-visible ring + reduced-motion override. |
| `src/lib/assets/favicon.svg` | **Default Svelte logo (orange "S") — wrong for a boardroom app.** Replace per [Branding] above. |

## Runtime / tooling preferences

- **Package manager: Bun** (`bun.lock` v1; no `package-lock.json`/`pnpm-lock.yaml`).
- **Node engine: enforced via `.npmrc` `engine-strict=true`**. No `package.json#engines` block.
- **Build**: Vite 8 + `@sveltejs/vite-plugin-svelte` 7 + SvelteKit 2 + Svelte 5 (runes mode forced everywhere except `node_modules`). Adapter is `@sveltejs/adapter-cloudflare` 7.2.9, instantiated **inline in `vite.config.ts`** — there is **no `svelte.config.js`**.
- **Worker**: `compatibility_date 2026-07-01`, `nodejs_compat`, `main .svelte-kit/cloudflare/_worker.js`, assets from `.svelte-kit/cloudflare`.
- **D1**: single binding `common_ground_db`; schema `room (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)` with row id `'LIVE'`. `ensureSchema` is per-isolate (cached in module scope, not persistent).
- **Workers AI**: binding `AI`; model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (3.1-8b (deprecated) was deprecated 2026-05-30). The  RapidI SYSTEM prompt mandates plain text (no `#` markdown), under 280 words, structured as Mandate / Where the money went / Lead / Resolve / Protect / Spatial program / One open question.
- **fal**: `@fal-ai/client` 1.10, `fal-ai/nano-banana-2`, 16:9 1K webp, key from `$env/dynamic/private.FAL_API_KEY`/`FAL_KEY` then `platform.env`. Missing key → `url: null, error: 'no_key'`.
- **Env files**: `.env` is gitignored and **currently contains a real key** — treat as a secret, do not echo. `.env.example` exposes only `FAL_API_KEY=`. Cloudflare local secrets live in `.dev.vars` (gitignored).
- **Do not add native Node modules** (e.g. `better-sqlite3`). All persistence is D1; all inference is Workers AI; all images are fal.

## Testing & QA

- **Vitest 4** in node env, `src/**/*.{test,spec}.ts`, `$lib` aliased to `./src/lib` (`vitest.config.ts`).
- The only test file today is `src/lib/game/rules/rules.test.ts` — covers: phase FSM (`applyAdvance`/`applyRetreat`, no wipe on advance, captured flag), retreat history-prune, R3 remove rules (`isRemoveRound`, reject positive delta, allow subtract, `boardSet` clamp, `submitTable` clamp + cap, wrong-seat rejection), table wallet cap (rejects over-budget add, `boardSet` clamp, NaN priority), alignment index denominator (unanimous = 100, split = low), and ground-up lenses (`verdicts` lead/fault, `surpriseToken` off-type ≥25%). Add new test files alongside their module under `src/lib/**`.
- **No CI, no lint/format scripts, no `.github/`** — the only quality gate is `bun run check`. There is no ESLint/Prettier config in-repo; use the editor formatter (tabs, semicolons, single quotes).

## Failure modes & ops runbook

The live URL at `https://common-ground.zyeta.asia/host/LIVE` is the only deployment. If something is broken at 11pm, this is the runbook. **Each failure mode is named, the symptom is concrete, the root cause is specific, and the recovery is one action.** The doc is the runbook; update it when a new mode appears.

### Observability surface

Before any failure mode, **the log path** matters. The Worker has no third-party observability — it's `console.*` + `wrangler tail` only. Add these in production:

- `wrangler tail --format pretty` in a terminal during an active session. Every state change prints one line.
- `console.info` on every `mutate` and `persist` (post-Phase 3): include the `Idempotency-Key`, the `If-Match` value, and the contention result (win / lose / retry). One line per state change.
- `console.error` on every caught exception, with `e.message` and a short stack.
- **No `console.log`** — use `info` (visible) or `debug` (filtered).
- For batch operations (the 7 table-renders in Phase 8), log a per-table result on completion.

### F1. The room is "stuck" — the presenter's advance doesn't take

**Symptom**: presenter clicks "Advance", the spinner spins, the page doesn't change. The polling shows the same round.

**Diagnosis**: open `wrangler tail`. Look for `Idempotency-Key` collisions. If the same key is being reused, the request is returning the cached response. Or: the `If-Match` is being rejected (409) because another isolate wrote first. **Both are the conditional-UPDATE pattern working correctly** — the issue is the client doesn't have the latest `updatedAt`.

**Recovery**:
1. The client should call `await this.tick()` to resync. If the UI doesn't auto-recover, the user can refresh the page (F5) — the polling client will fetch a fresh state.
2. If the issue is a true deadlock (one isolate holds the lock), restart the Worker: `wrangler pages deploy --force`. New isolates start fresh.
3. **Don't** re-attempt the mutation without a fresh `updatedAt`. That's a recipe for infinite 409s.

### F2. The phone shows "Reconnecting" / `session.connected = false`

**Symptom**: phone or presenter shows "○ Reconnecting" in the topbar (`MobileHeader.svelte:32`).

**Diagnosis**: the polling fetch failed. Look at `wrangler tail` for `console.error` from the session module. Likely causes:
- The Worker is on a cold isolate that has no in-memory state (the `Store` singleton was on a different isolate, now this one doesn't have it). The next poll will sync.
- D1 is unreachable (the binding is misconfigured, or the D1 ID in `wrangler.jsonc` is wrong). Check `wrangler d1 list` and `wrangler d1 info common-ground-db`.
- The browser is offline (`navigator.onLine = false`). The session module should show this in `connected` — it's the same condition.

**Recovery**:
1. **Don't reset the room.** The state is on D1; a network blip doesn't lose it.
2. The polling client will retry every 500 ms (current) or fall back to 5 s (post-Phase 9 SSE). The state will resync when the connection returns.
3. If the D1 binding is misconfigured: check `wrangler.jsonc` → `d1_databases[*].database_id` matches `wrangler d1 list`. Re-deploy.
4. If the worker is on a bad isolate: `wrangler pages deploy --force` to roll isolates.

### F3. The final image doesn't render — the toast says "Image needs a FAL_API_KEY"

**Symptom**: the presenter clicks "Generate room" or a table clicks "Generate workplace", and the toast says `Image needs a FAL_API_KEY on the worker.` (`FutureRoomGen.svelte:55-57`).

**Diagnosis**: `FAL_API_KEY` is missing from the Worker's environment. Look at `wrangler secret list` — if `FAL_API_KEY` is not there, it was never set.

**Recovery**:
1. **Don't reset the room** — the brief and the table data are on D1, the AI image is the only thing missing.
2. The user can manually run `wrangler secret put FAL_API_KEY` with the value from z-corenet's `.env` (or wherever the team's key vault is).
3. Re-deploy. The polling client re-renders `FutureRoomGen` automatically.
4. If the secret *is* in `wrangler secret list` but the request still says `no_key`, check the env reading order in `src/lib/server/ai/fal.ts:31` — `env.FAL_API_KEY || env.FAL_KEY || platform.env.FAL_API_KEY || platform.env.FAL_KEY`. The Worker's `$env/dynamic/private` should be populated from `wrangler secret put`; `platform.env` is the static binding from `wrangler.toml` / `wrangler.jsonc`. If neither has the key, the secret was put on the wrong environment.

### F4. The brief says "ZyetaI unavailable — numbers brief only"

**Symptom**: the presenter clicks "Regen brief" or generates a room, and the toast says `ZyetaI unavailable — numbers brief only.` (`FutureWorkspace.svelte:71`).

**Diagnosis**: the Workers AI binding `AI` is missing or returning errors. The brief still works (it falls back to `buildEnhancedBrief` — the numbers-only skeleton), but the user-visible copy is "ZyetaI unavailable" which reads as a real failure.

**Recovery**:
1. The numbers brief is *correct* — it's the right output given the AI is unavailable. The user-visible toast is a debug message; do not show it in production.
2. To fix the underlying issue: check `wrangler.jsonc` → `ai.binding: "AI"` is present. The Workers AI binding should be auto-provisioned on deploy; if it's not, the account may need to be enrolled in Workers AI.
3. Re-deploy.
4. If the AI is intermittently failing (rate limit, network): the brief still completes, the user just doesn't see the AI copy. **This is the correct fallback behaviour** — improve the copy to say "Numbers brief — AI will be retried on next regen" instead of "unavailable".

### F5. The state is corrupted — `room` has wrong `phase` or `round` or `aggregate`

**Symptom**: a table is showing the wrong scenario, the round is wrong, or `aggregate.totalCoins` is wildly off.

**Diagnosis**: this is almost always a partial write. Open `wrangler d1 execute common-ground-db --command "SELECT * FROM room"`. The blob is `data` — it's a `RoomState` JSON. If the blob is older than expected, the conditional-UPDATE didn't take (a 409 lost a retry).

**Recovery**:
1. **Don't reset the room yet** — you might lose the participant's chips.
2. From the host page, click "Export JSON" (line 121-131). Save the current `room.aggregate`, `room.history[]`, and per-table `room.tables[i].board[]` to a file.
3. The host's "Save Budget" + "Lock all" + "Reset session" combination can recover most corrupted states.
4. If the data is unrecoverable: click "Reset session" with the host's "Type LIVE to confirm" prompt (post-Phase 7). The room is wiped; participants re-scan and re-place.
5. **Always do (2) before (4)**. The JSON export is your only record of what happened.

### F6. The favicon is the Svelte logo

**Symptom**: the browser tab shows the orange "S" Svelte logo.

**Diagnosis**: `src/lib/assets/favicon.svg` is the default SvelteKit favicon. The Phase 1 brand fix hasn't shipped.

**Recovery**:
1. Replace the SVG with the `CG` monogram (drop-in snippet in [Branding]).
2. Re-deploy. The favicon updates on next browser refresh.
3. The favicon path is set in `src/routes/+layout.svelte:13` via `<link rel="icon" href={favicon} />` — the imported SVG is the source of truth. The browser caches aggressively; force-refresh to verify.

### F7. The polling client is hammering the worker

**Symptom**: `wrangler tail` shows thousands of `GET /api/room/LIVE/state` requests per second.

**Diagnosis**: the client is supposed to use `If-None-Match` (post-Phase 3). Pre-Phase 3, the client polls every 500 ms regardless of whether the state changed. The worker responds with the full `RoomState` (which can be ~30 KB JSON) every time. **That's 60 requests per minute × 30 KB = 1.8 MB/min per device**. With 30 devices: 54 MB/min, 3.2 GB/hr. This is a billable bandwidth event.

**Recovery**:
1. **Pre-Phase 3**: this is expected behaviour. Reduce polling rate via `INTERVAL` in `session.svelte.ts:9` (currently 500). Bump to 2000 ms.
2. **Post-Phase 3**: the server returns `304` for unchanged state. The client still polls but the body is empty. The bandwidth drops to ~5 KB/min/device (304 headers only).
3. **Post-Phase 9**: SSE replaces polling entirely. The polling is the fallback only.

### F8. The presenter's submissions grid is stuck (a table is locked but the card shows "Open")

**Symptom**: a table has clearly submitted (the participant sees `MobileSealed.svelte`), but the presenter's submissions grid still shows the card as "Open" with the gold ring.

**Diagnosis**: stale `room` snapshot. The presenter's polling client has the old state.

**Recovery**:
1. The presenter can press F5 to force a refresh. The polling client fetches a fresh `RoomState`.
2. Post-Phase 3: the `If-None-Match` should make this self-resolving. If the presenter's `updatedAt` is fresh (newer than the host's lock action), the server returns `304` and the client shows the locked state.
3. Pre-Phase 3: the polling client is the source of truth. The host's `unlockTable(t.id)` + `lockTable(t.id)` round-trip is the manual fix.

### F9. The brief or render "succeeded" but the UI shows the old value

**Symptom**: the presenter clicks "Regen brief" or "Generate room", the response says `url: '...'` and `brief: '...'`, but the FutureWorkspace component still shows the old `brief` and `imageUrl`.

**Diagnosis**: the response is correct but the component reads from `room.enhancedBrief` (not from the response body). If `store.setEnhancedBrief('', brief, ...)` was called but the room was persisted with a stale snapshot, the next poll returns the old state.

**Recovery**:
1. Force-refresh the presenter page.
2. Check `wrangler tail` for the `setEnhancedBrief` log (post-Phase 3) and verify the persist succeeded.
3. The fix is in the server: ensure `await withLiveRoom(() => { store.setEnhancedBrief(...); if (url) store.setFinaleImage(...); })` is the LAST line of the endpoint, after the AI call. The order is correct in `src/routes/api/ai/compose-brief/+server.ts` (and the equivalent persist block in `room-concept`). The bug is more likely a stale `room` snapshot.

### F10. The session can't reconnect after a long disconnect

**Symptom**: the user closes their laptop for 30 minutes, opens it back up, and the app is stuck on "Reconnecting". The state in the DB has changed (e.g. host advanced a round), but the phone shows the old state.

**Diagnosis**: the visibility-change handler in `session.svelte.ts:114-117` calls `tick()` on `visibilitychange === 'visible'`. The state is re-fetched. But the *user has been typing chips on the phone* — those local edits are lost. **The phone is optimistic but doesn't track the local delta** (post-Phase 7: it will, with `If-Match` and a "syncing…" indicator).

**Recovery**:
1. The participant re-fetches the room state (the user's last chip is now in the server's view, not the local view).
2. **Pre-Phase 7**: the participant's last chip is *lost*. Re-place it. The other participants' progress is preserved.
3. **Post-Phase 7**: the `mutate` function uses `If-Match`. The user's last chip is the new ETag. If the server returns 409, the client re-syncs and shows "Room changed — please retry".

### F11. `wrangler d1 execute` returns a blob that's not parseable

**Symptom**: `wrangler d1 execute common-ground-db --command "SELECT * FROM room"` returns a `data` column that's a stringified JSON, but the `room.aggregate` is somehow wrong.

**Diagnosis**: D1 stores the `data` column as `TEXT`. The blob is a `JSON.stringify(room)` of the *current* `RoomState` shape. **If the schema changes (a field is renamed or removed) and there's no migration, old blobs deserialize with `undefined` for new fields**. The current schema has been stable, but a future rename will break this.

**Recovery**:
1. **Always have a migration plan for schema changes**. The current "schema" is implicit (TypeScript types in `src/lib/game/types.ts`). A real schema (Zod or Valibot) would catch drift at write time.
2. For a forward-incompatible change, write a `migrateRoom(oldRoom: unknown): RoomState` that handles the old shape. Run it in `recompute()` on every read.
3. For now: don't rename fields. If you must, version the blob (`{ version: 2, room: {...} }`) and write a `migrateV1toV2` adapter.

### F12. The page is 5xx and the worker is throwing

**Symptom**: `wrangler tail` shows `Uncaught (in promise)` or `Error:` stack traces.

**Diagnosis**: the SvelteKit dev server is the source of all 5xx. Common causes:
- A `+page.svelte` references a `$lib` module that doesn't exist (the dev server is strict; production is more lenient).
- A `+server.ts` calls a function that doesn't exist (TypeScript catches it in `bun run check`, but only if the type is broken).
- A `+server.ts` returns `throw error(500)` somewhere unexpected — `wrangler tail` shows the message.

**Recovery**:
1. **Re-run `bun run check`**. The TypeScript checker will surface most of these.
2. **Check the exact URL + endpoint**: `wrangler tail --format pretty | grep <path>` — narrow the search.
3. **Re-deploy** — the dev server's HMR is sometimes stale.
4. If the error is in `src/lib/server/`: roll back to the previous deploy. The Wrangler version history is at `https://dash.cloudflare.com/.../workers/<worker>/deploys`.
5. If the error is in `src/lib/game/`: the scoring is pure, so a runtime error means the input is wrong. Check the AI prompt — a model regression could return malformed JSON.

### F13. The UserPrompt is malformed

**Symptom**: the brief output reads as garbage, or the AI returns an error.

**Diagnosis**: pre-Phase 4, the prompt is in `src/lib/game/brief.ts:139` (`briefFactsForRapidi(agg)`). The render can return a string that the  RapidI model can't parse. **Post-Phase 4**, the prompt is in `src/lib/server/ai/prompts/brief.user.json` + `brief.user.ts` — the section keys are typed in `_schema.ts`. A missing section or a malformed render is the bug.

**Recovery**:
1. **Pre-Phase 4**: check `brief.ts:139-155`. The user prompt is `Total stake: ${...} tokens (${tokenUnitLabel()}).\nAlignment index: ...\n...`. If the `room.aggregate` has a `NaN` (e.g. `aggregate.matrix[i] = NaN` from a `+nan` payload), the prompt reads as `NaN tokens`. Validate before render.
2. **Post-Phase 4**: run `bun run lint:prompts` (the script from the plan). It catches missing `sections` keys, unknown `{{token}}` placeholders, and over-size system prompts.
3. Check `wrangler tail` for the response: `[rapidi] brief failed: ...`. The  RapidI model is returning an error — likely a token limit (700 max_tokens, ~280 words).

### F14. The poster / chip / board UI is in a weird state

**Symptom**: a card shows a value that doesn't match the data (e.g. a chip that's "100" when the rest are 0, or a priority with a weird color).

**Diagnosis**: this is almost always a CSS or font fallback issue, not a data issue. The CSS variable is wrong, the value is too small, the rgba is broken.

**Recovery**:
1. Inspect the element: `curl https://common-ground.zyeta.asia/... | grep -A 5 'class="card"'`. Check the class and the data attribute.
2. The CSS variables (`--color-gold`, `--color-teal`, etc.) are defined in `src/app.css` `@theme`. If a variable is undefined, the value is `inherit` (not the right answer).
3. **Tabular figures**: if the chip pile is 8 chips but the number says 7, the `<CountUp>` action is miscounting. The bug is in `src/lib/actions/count-up.ts` (post-Phase 5).
4. **Font fallback**: if the display font is Inter Tight but the fallback is "sans-serif" and Inter isn't loaded, the user sees Roboto. Check `src/app.html:9` for the Google Fonts URL.

### F15. The room is "ready" but no one is showing up

**Symptom**: the home page shows 7 cards. No one has scanned. The host page says "Connecting...". The polling client can't reach the worker.

**Diagnosis**: the live URL is down. `curl -I https://common-ground.zyeta.asia` returns a non-200. The Worker is paused, the deployment was reverted, or the DNS is broken.

**Recovery**:
1. **Re-deploy**: `bun run build && wrangler pages deploy`. Cloudflare's `wrangler tail` shows the last deploy time; if the Worker is paused, the dashboard at https://dash.cloudflare.com shows it.
2. **Check DNS**: `dig common-ground.zyeta.asia` (or `nslookup`). The custom domain `common-ground.zyeta.asia` is a CNAME to `z-common-ground.pages.dev`. If the subdomain is wrong, the request goes nowhere.
3. **Check the env**: `wrangler secret list` — if the secrets are missing, the worker boots but the AI endpoints fail (and the home page is a single fetch away from "Connecting...").
4. **Check the Cloudflare status page**: https://www.cloudflarestatus.com — if Workers or D1 is down, you wait.

### F16. The dev server is fine but `bun run build` fails

**Symptom**: `bun run check` passes, `bun run dev` works, but `bun run build` throws.

**Diagnosis**: the SvelteKit build is stricter than the dev server. Common causes:
- A Svelte 5 rune is used in a file that doesn't allow it (e.g. `$state` at module top level without `.svelte.ts`).
- A `<svelte:component>` with an async import that's not handled.
- A `.svelte` file uses a TypeScript type that exists in dev (the dev server is more lenient) but fails in build (the Svelte preprocessor is strict).

**Recovery**:
1. Read the build error carefully. It's a real Svelte 5 / TypeScript error.
2. **Pre-Phase 4 (prompts/ refactor)**: most build errors are in `src/lib/server/ai/rapidi.ts` or `fal.ts`. The current `SYSTEM` constant is a template literal; a stray `\` in a prompt will fail the build.
3. **Post-Phase 4**: the prompts/ refactor moved the prompt text to JSON. The build is less likely to fail on prompt content (JSON is more forgiving of multiline strings). The remaining build failures are usually Svelte runes misuse.
4. `bun run build 2>&1 | head -200` — the first 200 lines are usually enough.

### The runbook on a card

Print this. Tape it to the wall.

```
FAILURE                        │ FIX
─────────────────────────────── │ ───────────────────────────────
presenter advance doesn't take  │ F5 (refresh) → poll resyncs
phone "Reconnecting"            │ wait 5s → polling retries
image: "FAL_API_KEY" toast      │ wrangler secret put FAL_API_KEY
brief: "ZyetaI unavailable"     │ numbers brief is correct; ignore
state corrupted (wrong round)   │ Export JSON first, then reset
favicon is the Svelte logo     │ ship the Phase 1 brand fix
polling hammering (>1k/min)     │ bump INTERVAL to 2000 ms
submissions card stuck "Open"   │ F5, or host lock/unlock round-trip
brief/render shows old value    │ F5; ensure persist is last in endpoint
long disconnect, lost chip      │ re-place; post-Phase 7: If-Match
d1 blob not parseable           │ write migrateV1toV2 adapter
5xx, throws in tail             │ re-deploy; roll back via CF dash
brief output is garbage         │ validate room.aggregate (no NaN)
weird chip/priority value       │ inspect element; CSS var, not data
room is "ready" but no clients  │ wrangler pages deploy; check DNS
bun run build fails             │ read the error; usually Svelte rune
```

## Gotchas
1. **One room only.** `SESSION = 'LIVE'` is hard-coded everywhere. `[code]` route segments exist but every `Store` method and endpoint ignores the value. Don't add multi-room features without reworking `Store` + every `+server.ts`.
2. **Persona order = tableId.** `PERSONAS[]` in `src/lib/game/config.ts` is the source of truth: 1=Real Estate, 2=HR, 3=IT, 4=Finance, 5=Operations, 6=Marketing, 7=C-Suite. README's "Workplace Exp / Biz Leaders" seat list is stale; do not regenerate it.
3. **D1 is the source of truth across colos**, but `Store` is a process-local singleton. If the binding is missing or `saveRoom` fails, state stays in-memory only and vanishes on redeploy or isolate drift. `loadRoom`/`saveRoom` swallow errors with a `console.error` prefix.
4. **Render needs a key.** `POST /api/ai/room-concept` and `POST /api/ai/table-render` return `url: null` (with `imageError: 'no_key'`) when `FAL_API_KEY`/`FAL_KEY` is unset — the UI surfaces this in toast text. Brief still works (Workers AI binding `AI`).
5. **Brief needs stake.** `aggregate.totalCoins <= 0` → 400 on finale and brief endpoints. `buildEnhancedBrief` returns `''` (no invented mandate). The UI's "no stake" empty state shows on the relevant screens.
6. **History is round-aware.** Evolution R2/R3/R5 only populates after those rounds have been advanced through; retreat prunes snapshots for rounds past the current one. `roomInsights` adds a **live** point for the current round if not yet in history, so the journey chart never blanks mid-round.
7. **Phones show round number + scenario question + hint** (in `MobileHeader`/`RoundQuestion`). Scenario copy is also broadcast on the presenter side; phone is the only place that requires the user to read it on-device.
8. **`ANTHROPIC_API_KEY` is declared in `src/app.d.ts` but unused** — don't trust its presence.
9. **Two `workers-types` versions coexist** in `bun.lock` (root `5.20260721.1` vs adapter-pinned `4.20260702.1`); import bindings via `$lib/server/ai/rapidi` for the `AiBinding` type, not the workers-types namespace.
10. **Single chip is $10M.** `CHIP_DENOMS` has exactly one entry (`{ red, value: 10 }`); `CHIP_DELTAS = [10, -10]`. The board endpoint's server validation **only accepts ±10** and 400s on anything else — despite the client `session.boardDelta` signature saying `delta: 1 | -1` (stale). The previous blue/green chip story is gone from code; `types.ts` still has a stale comment + the `$10M/$5M/$2M` legend in the `BoardSheet` print. Edit comments rather than the store.
11. **`session.boardDelta` is a silent no-op** (still `200`) on phase ≠ `round` (or `lobby`), locked table, wrong seat, out-of-range priority, `delta: 0`, `NaN` priority, over-budget add, or remove-round positive delta. Clients should treat the response as informational, not authoritative. `boardSet` is also a no-op on locked/wrong-seat/bad-priority but clamps to budget on the happy path.
13. **`setConfig` ignores `analysisUnlocks`.** The endpoint body type and `setConfig` patch type only accept `analysisForced` and `roomBountyTokens` (1..9999, clamped). The README/CLAUDE mention of `analysisUnlocks` is stale. (The `setTables` method + `/api/room/[code]/tables` endpoint were removed — `setTableCount` is the only table-count entry point.)
14. **LinkedIn share fallback origin** is hard-coded to `https://common-ground.zyeta.asia` in `MobileRender.svelte`; the real `window.location.origin` is preferred when available. `MobileRender.svelte` uses a file-input camera (`<input type="file" accept="image/*" capture="user">`) — this is a voluntary selfie for the LinkedIn frame, **not** board-reading vision (the README "no vision" claim still holds for gameplay).
15. **`session.updateBrief(text)` persists.** It POSTs to `/api/ai/brief-edit`, which sets `enhancedBrief` with `briefSource: 'manual'` — and `recompute()` never overwrites a `manual` or `rapidi` brief with the numbers skeleton. (Earlier revisions of this doc called it local-only; that is stale.)
16. **`$lib/client/index.ts` has been deleted.** It used to re-export `$lib/state`. Import from `$lib/state` directly.
17. **`$lib/index.ts` is a thin barrel** re-exporting `game/types.js`, `game/config.js`, `game/scoring.js` only. It is **not** a general `$lib` entry point — there is no `client.ts` or `server.ts` barrel.
18. **`app.css` seat color tokens are misaligned with `PERSONAS[]`.** The 7 `--color-seatN` tokens don't match the actual persona hex codes in the order they're used; components use `persona.color` directly. Don't reach for `--color-seat*` thinking it's the persona palette. **See [Branding] for the proposed fix.**
19. **The client polls `/api/room/${SESSION}/state` directly every 500 ms** (`fetchStateOnce` in `src/lib/state/session.svelte.ts`), sending `If-None-Match` so an unchanged room costs a `304` with no body. The state route IS the polling path, not just a debugging endpoint. If you add a 404 here, every phone/presenter/host screen will stop refreshing.
20. **No print CSS on `/present/[code]/qrs/`.** The print sheet uses `print:` Tailwind variants but the route has no `@page` rule and no `body { background: white !important }` override. `/board/[seat]/` and `/boards/all/` do have `@page landscape margin:0`.
21. **Favicon is the `CG` monogram** (`src/lib/assets/favicon.svg`) — the default Svelte logo has been replaced. Later [Branding] prose that says otherwise is stale.
22. **Prompts live in code, not in `src/lib/server/ai/prompts/`.** Today the  RapidI `SYSTEM` constant is in `rapidi.ts:22` and the image-prompt string templates (`finalePrompt`, `tableFunctionPrompt`, `briefFactsForRapidi`) are in `src/lib/game/brief.ts`. That mixes brand-voice text with domain code, makes the brand voice un-diffable for non-engineers, and prevents runtime A/B. **Fix:** lift them into `src/lib/server/ai/prompts/` as JSON (sections + meta) with TS renderers + a typed `PROMPTS` registry — see "Prompts as data, not code" in [AI integration]. The current setup is the smell that gotcha 23 describes.
23. **The CGI is invisible to the AI.** Neither the current  RapidI prompt nor the fal prompt names the Common Ground Index, the lead/fault/blind lens, or the verdict label. The AI ends up paraphrasing what the UI already shows instead of amplifying it. The refined prompts in `src/lib/server/ai/prompts/brief.system.json` (Common Ground vocabulary section) and `brief.user.ts` (Lens block) fix this.
24. **JSON for prompts, not markdown.** It is tempting to drop prompts in `static/prompts/*.md` so designers can edit them in any editor. **Don't.** Cloudflare Workers don't ship a filesystem; the bundle has to contain the prompt. Use `.json` in `src/lib/server/ai/prompts/` so the prompt rides with the rest of the Worker code, gets type-checked by the `PromptMeta` schema, and is diffable in PR review. Static markdown files would also lose the sectional structure (`{ role, audience, voice, vocabulary, structure, constraints }`) that makes a single-section edit safe.
25. **No story in the analysis today.** The presenter deck has the *data* for "where we agree / where we fight / what we missed / who surprised us" but it does not have a *story* — the presenter sees a ring + chips + a heatmap and has to translate to English in their head. The host page has zero analysis at all. **Fix:** ship `readAloudForRoom(room)` in `src/lib/game/brief.ts` (the one-sentence read-aloud), add an `<CgiHero>` component, and surface the same string on both `/present/[code]/` and `/host/[code]/` — see "Analysis: the Common Ground story" above for the full change list.
26. **Live URL drift.** The deployment at `https://common-ground.zyeta.asia/host/LIVE` runs the code as of the last `wrangler pages deploy`. Local changes (including any of the analyses-redesign steps above) do not appear there until the site is rebuilt and redeployed. There is no CI; deploy is a manual `bun run build && wrangler pages deploy`. After the redesign, expect the live URL to lag the local dev server by however long the deploy takes (typically 1–2 minutes for the build, 10–30s for the wrangler push).
27. **Hard-coded `cubic-bezier` and durations.** Most components inline `cubic-bezier(0.22, 1, 0.36, 1)` and `transition: ... 0.4s ease` in their `<style>` blocks. The UI/UX system design in this doc defines `--ease-out-quart`, `--ease-in-out-quart`, `--dur-instant` / `--dur-fast` / `--dur-base` / `--dur-slow` / `--dur-stage` / `--dur-stagger` as `@theme` tokens. **Replace every hard-coded transition with the tokens** when you touch a component — the rule is "tokens, not literals". Same for `font-family: 'Playfair Display', ...` and `font-family: 'Lora', ...` — drop them in favour of `var(--font-display)` and `var(--font-sans)`. The 5+ places with `Playfair` literals are in `Chip.svelte:30`, the presenter's `.brand` class, and any inline `font-family` inside `present/*.svelte`/`phone/*.svelte` components.
28. **No count-up animation today.** Every `$` amount on screen (`formatUsd(...)`) snaps when `room.aggregate.totalCoins` changes. A 280ms count-up from old to new is the single biggest perception-of-life improvement. Use the proposed `use:countUp` action in `src/lib/actions/count-up.ts` (see UI/UX §6) on every formatted amount. The action must read `tnum` + the right `Intl.NumberFormat`; do not write a new formatter per call site.
29. **No view transitions between routes.** The current `+layout.svelte` has `data-sveltekit-preload-data="hover"` but route changes are hard cuts. Add the `onNavigate` + `document.startViewTransition` hook in `+layout.svelte` (see UI/UX §7) — it's ~10 lines and the single biggest "sleek" win for the host → present → play flow. Browsers without the API (Safari, Firefox) silently no-op; the rest of the app must continue to work without it.
30. **Gamification is micro-interactions, not a candy splash.** The proposed vocabulary (tap, chip land, row flash, submit seal, count up, confirmation, route transition, celebrate) is the **complete** set. Do not add particle effects, screen shakes, or sound effects beyond `AudioContext` for the finale "ding" (off by default). Every interaction must have a purpose and a contract; the table at UI/UX §5 is the spec.
31. **`@media (prefers-reduced-motion: reduce)` is global** but currently only zeros `animation-duration` / `transition-duration` (in `app.css:61`). The new motion tokens must also respect it — `Modal.svelte`, `ExpandImage.svelte`, the new `use:ripple` / `use:confetti` / `use:countUp` actions, and the view-transition hook in `+layout.svelte` all gate on `matchMedia('(prefers-reduced-motion: reduce)')` and skip the animation. **The chip-flash and `in:scale` chip-pile animation are exceptions** (functional, not decorative) — they fire even under reduced-motion because the chip count is the user's input, not a flourish.
32. **Wordmark uses Playfair today.** The presenter's `.brand` class (`src/routes/present/[code]/+page.svelte` style block) and the `<h1 class="brand">COMMON GROUND</h1>` host page use Playfair Display 800. Replace with `var(--font-display)` (Inter Tight 900) + `letter-spacing: -0.04em` + uppercase per UI/UX §1. The wordmark is a brand mark; the modern sans reads better in a stage-sized logo.

## Glossary

Every domain term used across this doc, defined in one place. **Alphabetical.** Each entry: the term, a one-sentence definition, and the canonical file/line where the term lives. If you can't find a term here, it's a doc bug — add it.

### A

- **AbortController** — Svelte 5 + browser primitive that lets you cancel an in-flight `fetch` (or any signal-bearing async work). Used in `src/lib/state/session.svelte.ts` (post-Phase 2) to abort the polling loop on unmount and on `visibilitychange` away.
- **aggressive cache** — see *Idempotency-Key*.
- **alignment** — see *lead*.
- **alignment index** — see *CGI*.
- **AI binding** — the Workers AI binding `AI` (declared in `src/app.d.ts` as `AI?: AiBinding`). Used by `src/lib/server/ai/rapidi.ts` to invoke the RapidI chat model.
- **analysis deck** — the 5-screen presenter view (`/present/[code]/`), gated on `analysisOpen(room)` (defined in `src/lib/game/scoring.ts`).
- **analysisForced** — boolean field on `RoomState` (`src/lib/game/types.ts`). When `true`, the analysis deck is shown even during R1–R5. Set by the host via `POST /api/room/[code]/config` with `{ analysisForced: boolean }`.
- **analysisOpen(room)** — pure function in `src/lib/game/scoring.ts` that returns `true` when the room is in `reveal`/`finale` or when `analysisForced` is set.
- **AtC** — see *AbortController*.

### B
- **backplate / panel / chip-frame** — the recessed green-felt background layer; brand chrome stays Zyeta teal/gold, **data wears priority color**.
- **bias** — per-persona, per-priority 0–3 weight in `src/lib/game/config.ts` (`PERSONAS[i].bias`). The `surpriseToken` function uses this to detect off-type bets.
- **`badgeForTable(room, tableId, persona?)` (proposed)** — `src/lib/game/scoring.ts`. Returns `{ hashtag, badge, badgePriority, badgeShare }` for one table. The `hashtag` is the persona's *declared* identity (e.g. `#FootprintShrinker`); the `badge` is the persona's *observed play* (e.g. `"Held Future Readiness"`, derived from the table's top-priority token). Empty-state: zero stake → `badge: 'No stake'`; missing hashtag → `'#YourFunction'`. Renders on the post-game phone card, LinkedIn share frame, and presenter screen 7.
- **blind** — the priority that received the *least* $M in `aggregate.matrix`. Computed by `verdicts(matrix, reach, functionVectors)` in `src/lib/game/scoring.ts`. The lens named "what are we blind to".
- **`buildEnhancedBrief(agg)`** — the numbers-only skeleton brief in `src/lib/game/brief.ts`. Used as the  RapidI fallback when Workers AI is unavailable.

### C

- **`cellBg(v, pri)`** — color-mix helper in `src/lib/components/analytics/PortraitMatrix.svelte` that returns a CSS `color-mix(...)` string from a cell value `v` and the priority's color.
- **`CGI` (Common Ground Index)** — the 0–100 alignment score. Computed by `commonGroundIndex(functionVectors)` in `src/lib/game/scoring.ts` as the mean pairwise cosine similarity between function vectors. Returns 0 when fewer than 2 functions are active. The room's single most important number.
- **`chord diagram` (proposed)** — a 7-node circle of personas with 21 ribbons for every function pair. Color (teal/gold/red) and alpha encode the pairwise cosine. The most interesting chart in the system. Spec in [Analysis: the Common Ground story §Proposed chart set].
- **`cloneMatrix(m)`** — utility in `src/lib/game/scoring.ts`. Pure deep-copy of a 7×7 matrix.
- **`clamp(0..99)`** — the priority value cap inside `applyBoardSet` (board.ts:90). Values are clamped to `[0, 99]` to prevent overflow.
- **`commonGround(tableMatrix, roomMatrix)`** — `src/lib/game/scoring.ts`. Per-function-vs-room cosine similarity × 100. Used in `recomputeTable` to compute `t.commonGround` per table.
- **`commonGroundIndex(functionVectors)`** — `src/lib/game/scoring.ts`. Mean pairwise cosine across the room. 0–100.
- **`config` (RoomState field)** — `src/lib/game/types.ts`. The room's runtime overrides (personas, scenarios, roomBountyTokens, tableBountyTokens).
- **`conditional UPDATE`** — the SQL pattern in `src/lib/server/room-store.ts` (proposed in Phase 3): `UPDATE room SET data = ? WHERE id = ? AND updated_at = ?`. Optimistic concurrency via `If-Match`.
- **`cosine(a, b)`** — private function in `src/lib/game/scoring.ts`. Standard cosine similarity between two 7-element vectors.
- **`counterState`** — `(lockedCount, totalTables)` derived in `src/routes/present/[code]/+page.svelte`. Drives the topbar "X/7" chip.

### D

- **`D1`** — Cloudflare's serverless SQL database. The single binding `common_ground_db` holds one row `id = 'LIVE'` whose `data` column is a `JSON.stringify(RoomState)` blob. See `src/lib/server/room-store.ts`.
- **`D1 schema` (proposed)** — `room (id, data, updated_at)` + `idempotency (key, status, body, created_at, expires_at)` + `ai_cache (key, body, url, created_at)`. The current state has only the first table.
- **`data-sveltekit-preload-data="hover"`** — attribute in `src/app.html:14`. Tells SvelteKit to preload page data on hover. Should be paired with the `onNavigate` + `startViewTransition` hook (Phase 5) for smooth route transitions.
- **deadline** — see *Etag*.
- **`deepEqual`** — not used. The codebase relies on `$state.raw` for reference-replace equality. Add a deep-equal check in the `mutate` function (Phase 3) for optimistic-concurrency conflict resolution.
- **delta-1-instead-of-10** — the bug at `src/lib/state/session.svelte.ts:222` where `boardDelta` accepts `delta: 1 | -1` but the server validates against `CHIP_DELTAS = [10, -10]`. Server returns 400 on the wrong delta. See gotcha 10.
- **`dirtyPersonas` / `dirtyScenarios`** — local edit state in `src/routes/host/[code]/+page.svelte` (line 25-26). Tracks unsaved persona / scenario edits; cleaned on save.
- **doctype** — `src/app.html:1`. Always `<!doctype html>`. No XHTML / legacy.

### E

- **`ease-out-quart`** — motion token (`--ease-out-quart = cubic-bezier(0.22, 1, 0.36, 1)`). The default transition curve in the design system.
- **empty matrix** — `emptyMatrix()` in `src/lib/game/scoring.ts`. A 7×7 zero matrix, the default for a new table's `board` field.
- **`endAt`** — `derived(page >= total)` in `StageNav.svelte`. The "Next → Done" affordance.
- **`enhancedBrief`** — `RoomState.enhancedBrief: string` in `src/lib/game/types.ts`. The current brief ( RapidI or numbers). Persisted by `Store.setEnhancedBrief(code, brief, source)`.
- **`endpoint contract`** — the documentation in [Server: store + endpoints](#server-store--endpoints) that lists every `+server.ts` handler, its body, response, and side effects.
- **Etag** — see *If-Match / If-None-Match*.
- **even smaller ship** — the user's "if you only have X time" entry points in the Master plan. A single PR (font swap, favicon, read-aloud button) takes 30 minutes and changes the live URL.
- **`extra analysis` (deprecated)** — the `showExtra` modal in `src/routes/present/[code]/+page.svelte`. Was hidden behind the `E` key. Promoted to primary deck content in the [Analysis redesign]. The `E` keybinding is preserved for power users.

### F

- **`fallback`** — the behaviour when an AI call fails or a key is missing. `buildEnhancedBrief` is the numbers-only fallback for the chat model. `generateImage` returns `ImageResult = { url: null, error: 'no_key' | 'failed' }` for fal.
- **`fault`** — the priority with the *greatest spread* across functions (max variance, skipping the lead). Computed by `verdicts(matrix, reach, functionVectors)`. The lens named "where do we fight".
- **`FEATURE_COUNT`** — not used. The `+page.svelte:43` host page could show a stat card with "X of Y features enabled" — proposed in Phase 7.
- **FETCH_DELTAS** — see *CHIP_DELTAS* (different name, same concept).
- **fetchStateOnce** — the polling function in `src/lib/state/session.svelte.ts:42-63`. Wraps the `GET /api/room/LIVE/state` call. Catches all errors and flips `connected = false`.
- **`finale`** — one of the four `Phase` values (`lobby | round | reveal | finale`). After all 5 rounds, the presenter advances to `reveal` (the analysis deck opens) and then to `finale` (the analysis is permanently shown). The post-game moment.
- **`finalePrompt(matrix)` (proposed, moved to `prompts/`)** — the room-render prompt. `src/lib/game/brief.ts:51` today, `src/lib/server/ai/prompts/image.finale.json` + `image.finale.ts` after Phase 4.
- **`firstUpdatedAt` (proposed)** — for the `Lock all` button's undo toast. The room's `updatedAt` at the time of the lock. Undo restores the lock state if no other mutation has happened.
- **`flatMap(c => [c.value, -c.value])`** — the pattern in `src/routes/api/room/[code]/board/+server.ts:8` that builds `CHIP_DELTAS` from `CHIP_DENOMS`. So `[10, -10]` from a single entry `{ red, value: 10 }`.
- **`flushSync`** — not used. The codebase's `Store.sync` and `Store.persist` are both `async`. Add explicit "sync point" comments at the start of every `+server.ts` handler that mutates.
- **frozen (`Object.freeze`)** — proposed in Phase 2. The `room` snapshot is `Object.freeze`-d in `applyRoom` so bugs that try to mutate `room.aggregate.matrix[i]` directly throw a `TypeError`.

### G

- **`game config` editor** — the `configOpen` panel in `src/routes/host/[code]/+page.svelte` (line 234+). Per-persona and per-scenario text fields, color hex. Split into `/host/[code]/config/+page.svelte` in Phase 7.
- **`GameConfig` (proposed)** — the new SvelteKit form action for persisting persona / scenario edits. Currently uses `session.setPersona` / `session.setScenario` (post-Phase 7 endpoints).
- **`getRequestEvent()`** — SvelteKit server primitive in `src/lib/server/live.ts:5`. The `+server.ts` handler's request context, including the `platform.env` (Workers bindings). Used to get `env.common_ground_db`.
- **`getPersonaField(seat, field)`** — `src/routes/host/[code]/+page.svelte:29-35`. The local edit state lookup: returns the dirty override if any, then the room's `st.personas[seat]`, then the default `PERSONAS[seat]`. Triple-fallback.

### H

- **`headline`** — proposed in Phase 8. The single 1-sentence read-aloud for the room, produced by `readAloudForRoom(room)` in `src/lib/game/brief.ts` (proposed). A sticky "📋 Read aloud" button copies it to the clipboard.
- **headless** — not used. The tests are vitest, not headless-chrome. Add Playwright only when E2E tests are needed (not in the current plan).
- **history (RoomState field)** — `RoomState.history: RoundSnapshot[]` in `src/lib/game/types.ts`. Captured by `upsertHistory(room)` on every `applyAdvance` for rounds R1-R5 (and `reveal`). Used by `roomInsights().journey` to draw the live journey chart.

### I

- **`idempotency`** — the property that a re-execution produces the same result. The current codebase has zero idempotent endpoints (gotcha A2). Fix in Phase 3 with `Idempotency-Key` header + D1 table.
- **`Idempotency-Key`** — HTTP header (IETF draft, also Stripe / Square convention) that lets a client safely retry a mutating POST. The server stores the response in a D1 table and returns the cached response on retry.
- **`If-Match` / `If-None-Match`** — HTTP headers for optimistic concurrency. `If-Match: W/"<updatedAt>"` on a POST means "only apply if the current `updatedAt` is `<updatedAt>`". `If-None-Match` on a GET means "return 304 if the resource hasn't changed".
- **incremental render** — see *view transition*.
- **interop** — the seam between the `game/` pure domain and the `server/` Worker. Defined in `src/lib/server/live.ts` (the `withLiveRoom` / `readLiveRoom` helpers). The `prompts/` refactor (Phase 4) extends the interop into AI land.
- **`isCaptureRound(roundLabel)`** — `src/lib/game/config.ts:156`. Returns `true` for round labels in `CAPTURE_ROUNDS = [2, 3, 5]`. The R2/R3/R5 capture seal.
- **`isRemoveRound(room)`** — `src/lib/game/rules/board.ts:29`. Returns `true` when `phase === 'round' && SCENARIOS[room.round].move === 'remove'`. Currently always R3.

### J

- **journey** — see *history*.

### K

- **`keepfocus` (proposed)** — Svelte 5 transition directive for keeping focus on the focused element when content changes. Not currently used.

### L

- **`label`** — the `SCREENS[]` `short` field in `src/routes/present/[code]/+page.svelte:19-25`. The one-word stage label (e.g. "Align", "Future"). Used in `StageNav` dots.
- **latency budget** — the user-perceived latency budget for the live URL. The current 500 ms polling is the budget floor. Post-Phase 9 SSE drops it to <100 ms. **Anything over 200 ms is "the app is slow"** for a 60-user boardroom.
- **`lead`** — the priority the *most* functions rallied behind. Computed by `verdicts(matrix, reach, functionVectors)` as `argmax(reach)`, tiebreak by `argmax(matrix)`. The lens named "where do we agree".
- **`lead-clamp.ts` (proposed)** — the file with the `leadPct` rounding logic in `buildBriefFacts` (Phase 4, brief.ts). Currently the formula `(a.matrix[a.alignment] ?? 0) / a.totalCoins) * 100` returns NaN when `totalCoins === 0`. The `?? 0` is correct.
- **left-rail** — the rail in `RoomInsights.svelte:15-46` (the ring + lead/fault/blind chips + journey). Will be replaced with the CGI hero (Phase 8).
- **`lib/index.ts` (deprecated)** — see [gotcha 17](#gotchas). Don't add new consumers. Use `$lib/state` or `$lib/game` instead.
- **`Link`** — not used. The codebase uses native `<a href>` for navigation. SvelteKit's `<Link>` component is for prefetched navigation; the current `data-sveltekit-preload-data="hover"` does this without a component.
- **`linkedIn-frame.ts`** — `src/lib/client/linkedin-frame.ts`. The 1200×630 canvas composite for the share image. Paints "Powered by ZyetaI" at bottom-right.
- **live URL** — `https://common-ground.zyeta.asia/host/LIVE`. The only deployment. Updated by `wrangler pages deploy`. **The doc is a spec; the live URL is the truth.** If they disagree, the live URL wins.
- **loading state** — see *busy*.
- **LLAMA_MODEL** — `'@cf/meta/llama-3.3-70b-instruct-fp8-fast'` in `src/lib/server/ai/rapidi.ts:9`. The Workers AI chat model. `3.1-8b (deprecated)-instruct (deprecated)` was deprecated 2026-05-30.
- **`loadRoom(db)`** — `src/lib/server/room-store.ts:28-44`. Reads the row from D1. Returns `null` if no row, or if the row fails validation.

### M

- **matrix** — `Vec7` or `Matrix7x7` in `src/lib/game/types.ts`. A priority vector is `[talent, exp, brand, productivity, innovation, cost, future]` of token counts (in $M).
- **mid-round** — R1 (`mode: 'wait'`) and R4 (`mode: 'hold'`). No capture seal; the board saves cumulative. Mid-round hints are in `SCENARIOS[0].hint` ("Start by allocating ~$30M").
- **misalignment** — the `verdicts.fault` priority, the room's biggest variance. See *fault*.
- **`mode` (Scenario field)** — `wait | capture | hold`. Determines whether the round seals on submit.
- **`money.ts`** — `src/lib/game/money.ts`. The `formatUsd` (compact, `$28.5M`) and `formatUsdFull` (Intl) helpers.
- **`move` (Scenario field)** — `add | remove`. R3 is the only `remove` round.

### N

- **`N_PRIORITIES = 7`** — `src/lib/game/config.ts`. The number of priorities. Used everywhere a loop iterates priorities.
- **`N_SEATS = 7`** — `src/lib/game/config.ts`. The number of personas / tables. One per function.
- **`navigator.onLine`** — browser API checked in `EventSource` reconnect (Phase 9). When `false`, the client doesn't try to reconnect.
- **`newEventSource(url, opts)`** — the constructor for the SSE client. Used in Phase 9 to replace the polling loop.
- **`NoData`** — not used. The codebase uses `{#if !hasData}` patterns (`FutureBrief.svelte:28`, `FutureRoomGen.svelte`). A `<NoData>` Svelte snippet would be more idiomatic.

### O

- **`open` (Modal)** — `$bindable(false)` prop on `src/lib/components/Modal.svelte`. The dialog's open state. Two-way bindable.
- **`open` (FutureWorkspace)** — `futureUi.briefOpen` boolean. Toggles the editable-brief modal.
- **`open` (Presenter)** — `derived(analysisOpen(room))`. True when the analysis deck is open.

### P

- **`parseRoom(data)`** — not used. The D1 blob is `JSON.parse(row.data)` in `loadRoom`. The `typeof data.updatedAt !== 'number'` check is a minimal shape guard. Add a full Zod / Valibot schema in Phase 11.
- **`PERSONAS[]`** — `src/lib/game/config.ts`. The 7 personas (Real Estate, HR, IT, Finance, Operations, Marketing, C-Suite). Source of truth for tableId → persona name + color + mission + lens + **hashtag** (e.g. `#FootprintShrinker`). Host-editable per session via the Game Config editor.
- **`Phase`** — `'lobby' | 'round' | 'reveal' | 'finale'` (`src/lib/game/types.ts`). The room's state machine.
- **`phaseStartedAt`** (proposed) — see *roundStartedAt*.
- **`polling fallback`** — the 5 s `setInterval(this.tick.bind(this), 5000)` in Phase 9. Runs when `EventSource.readyState === CLOSED`.
- **`present` (state module)** — `src/lib/state/present.svelte.ts`. The screen index (1-5) for the presenter deck. `next/prev/setScreen/enterAnalysis`.
- **`PRIORITIES[]`** — `src/lib/game/config.ts`. The 7 priorities (Talent, Employee Experience, Employer Brand, Productivity, Innovation, Cost / ROI, Future Readiness).
- **`PRIORITY_COLORS[]`** — `src/lib/game/config.ts`. The 7-color palette for the priorities (sky-blue, teal, purple, gold, periwinkle, red, green).
- **`priorityMix(matrix)`** — `src/lib/game/brief.ts`. The percentage mix of room $M across priorities, with largest-remainder rounding so the sum is exactly 100. Drives the future-prompt.
- **`promptHash`** — proposed in Phase 4. A short hash of the prompt id + version + system. Returned in every AI response. Used by the client to detect "prompt changed since last brief" and warn the user.
- **`prompts/` (folder)** — proposed in Phase 4. The new home of brand-voice content: `brief.system.json` + `brief.user.json` + `brief.user.ts` + `image.finale.json` + `image.finale.ts` + `image.table.json` + `image.table.ts` + `registry.ts` + `index.ts`. See [AI integration Prompts as data, not code].
- **`PROMPTS`** (registry) — proposed in Phase 4. The typed map `PROMPTS = { brief, roomRender, tableRender }`. Exported from `src/lib/server/ai/prompts/registry.ts`.

### Q

- **`queue-promise`** — not used. The current `pollChain = pollChain.then(fetchStateOnce).catch(...)` in `session.svelte.ts:18` is a hand-rolled promise queue. The Phase 2 refactor replaces this with an `AbortController`.

### R

- **range (priority token count cap)** — `applyBoardDelta` rejects `delta` if the result would exceed `tableBountyTokens(room) = floor(roomBountyTokens / tableCount)`. The cap is the standing total on R3.
- **`reach` (Vec7)** — `aggregate(tables, personaBias)` builds `reach[i] = number of functions that bet on priority i` (binary 0/1 per function, summed).
- **`readAloudForRoom(room)`** — proposed in Phase 6. The canonical one-sentence story for the room. Used by the presenter's "📋 Read aloud" button and the host's emerging-analysis panel.
- **`recompute(room)`** — `src/lib/server/store.ts`. The central integrity step called after every mutation. Rebuilds `aggregate`, per-table `matrix`/`reach`/`commonGround`, `lockedThisRound`/`expectedLocks`, `tableBountyTokens`, `analysisOpen`, the numbers brief, and `upsertHistory`. Bumps `updatedAt`.
- **`recomputeTable(t, roomMatrix?)`** — `src/lib/game/scoring.ts`. Rebuilds `t.matrix` (the function seat's row), `t.reach` (binary 0/1 per priority), and `t.commonGround` (when `roomMatrix` is supplied).
- **`recurring workflow`** — not used. No scheduled tasks in the Worker. Add a cron trigger in Phase 11 to prune expired `idempotency` rows.
- **`resetSession()`** — `src/routes/host/[code]/+page.svelte:92-96`. Calls `session.ensure({ reset: true, tableCount })`. Wipes the room.
- **`reveal`** — see *Phase*.
- **rich text** — not used. The brief is plain text. The future-brief editor uses `<textarea>`. Don't add a rich-text editor; the brand voice is plain.
- **`room`** — the single source of truth for the session. A `RoomState` object persisted in D1 as JSON. The `session.room` in the client is a reference to the last polled snapshot.
- **`RoomGlance.svelte`** — Screen 1 of the presenter deck. Currently a strip + PortraitMatrix. Will become the "Where we agree" screen (Phase 8).
- **`RoomInsights.svelte`** — Screen 2. Currently a ring + lead/fault/blind chips. Will become the "Where we fight" screen (Phase 8).

### S

- **Sass / SCSS** — not used. The codebase uses Tailwind v4 with `@theme` CSS variables. No Sass, no PostCSS, no `.scss` files.
- **`SCENARIOS[]`** — `src/lib/game/config.ts`. The 5-round scenario table. Each round has `mode` (wait | capture | hold), `move` (add | remove), `instruction`, `title`, `question`, `hint`, `emoji`.
- **`strategySignature(room)` (proposed)** — `src/lib/game/scoring.ts`. Returns the room's posture (`additive-dominant` / `protection-dominant` / `balanced-trade`), per-function posture (`additive` / `protective` / `balanced` / `no-op`), the *protected* priority list (where each function held the line), and the *contested* priority list (the room's `fault` and per-function share there). Drives the 7th presenter screen "Strategy" (Phase 8, alongside the 6th screen "Your journey"), the phone "Your strategy" card, the host's emerging-analysis panel, and 2 lines of context in the  RapidI brief.
- **`RoomStrategy`** — `'additive-dominant' | 'protection-dominant' | 'balanced-trade'`. The room-level classification in `strategySignature`. Computed from R3's net removal vs R2's standing (>50% removed = protection-dominant; <10% removed AND R5 added ≥20% = additive-dominant; else balanced-trade).
- **`FunctionStrategy`** — `'additive' | 'protective' | 'balanced' | 'no-op'`. The per-function classification. Thresholds: R2→R3 row shrank ≥20% = protective; grew ≥10% = additive; within ±10% = balanced; zero delta = no-op. The thresholds are tunable in `DEFAULT_CONSTRAINTS`.
- **`additive-dominant`** — room-level posture: R3 was a *light touch* (≤10% removed) AND R5 added ≥20% over R4. The room kept building.
- **`protection-dominant`** — room-level posture: R3 net-removed >50% of R2's standing. The room took things back.
- **`Screens` (presenter)** — the 5 base screens in `src/routes/present/[code]/+page.svelte:19-25`. Phase 8 adds a 6th ("Your journey") and a 7th ("Strategy" — strategy disclosure). Each has `title`, `subtitle`, `short`.
- **`protected`** (StrategySignature.protected) — `Array<{ seat, priority, shareR2, shareR3, held: boolean }>`. The priorities each function held the line on. "Held" means R3 share ≥ R2 share AND R3 share > the room's average for that priority. The function's strategy is *protective* on that priority.
- **`priorityColor(p: PriorityIndex)` (proposed)** — `src/lib/game/config.ts`. Returns `PRIORITY_COLORS[p]`. Single source of truth for the heatmap, the chord diagram, the chip pile, and the lead/fault/blind labels. Brand colors (gold/teal/red) stay for chrome; **priority colors are for data**.
- **`PRIORITY_COLORS`** — `src/lib/game/config.ts`. The 7-priority palette: Talent `#E0A458`, Employee Experience `#E0665A`, Employer Brand `#E574B0`, Productivity `#5AA9E6`, Innovation `#7E8CE0`, Cost / ROI `#3FB6A2`, Future Readiness `#C9A227`.
- **`RoundConstraints` (proposed)** — `src/lib/game/config.ts`. Per-round validation rules: `floorPerRound: Partial<Record<mode, number>>` (R1: $30M, R2/R5: $50M, R4: 0), `minPrioritiesPerRound: Partial<Record<mode, number>>` (R1: 0, R2/R5: 5, R4: 0), `maxPerPriority: number` (default 100). The host's Game Config → Constraints tab edits these per session.
- **`validateRoundSubmission(room, tableId, row, constraints)` (proposed)** — `src/lib/game/rules/board.ts`. Returns `{ ok: true } | { ok: false, reason, message, hint? }`. The `message` is server-generated copy that the phone renders verbatim. The validator owns the *copy* because the constraints are per-session configurable.
- **`SubmitTableError` (proposed)** — typed result of `validateRoundSubmission`. Reasons: `'not-accepting' | 'not-capture-round' | 'over-budget' | 'wrong-seat' | 'locked' | 'floor-not-met' | 'breadth-not-met'`. Phone renders the `message` in a toast.
- **`session.boot()`** — `src/lib/state/session.svelte.ts`. Called from `+layout.svelte`'s `onMount`. Starts the polling loop and the visibility listener. Returns a teardown.
- **`session.busy`** — boolean flag on the `SessionState`. True while a mutating action is in flight. UI gates buttons on this.
- **`session.connected`** — boolean. True when the last polling fetch succeeded. False on first error.
- **`session.error`** — discriminated union `{ kind: 'none' | 'transient' | 'fatal' }` (post-Phase 2). Today it's a string.
- **`setEnhancedBrief('', brief, source)`** — `src/lib/server/store.ts`. Sets `room.enhancedBrief` and `room.briefSource` (the second arg is ignored — `_code: string` is always `LIVE`). Recomputes only if `source === 'numbers'`; the  RapidI brief is preserved.
- **`setFinaleImage('', url)`** — same shape, for `room.finaleImageUrl`. Skips recompute.
- **`SEATS` / `SEAT_COLORS` / `SEAT_LENS` / `SEAT_MISSIONS` / `SEAT_BIAS`** — `src/lib/game/config.ts`. Per-persona fields, mirrored from `PERSONAS[]`. (The seat-color tokens in `app.css` are drift — see [Branding fix].)
- **showExtra (presenter)** — `let showExtra = $state(false)` in the presenter page. The `E` key toggles it. Promoted to primary deck content in the [Analysis redesign].
- **silent** — see *Reactive*. Svelte 5 reactivity. Module-level `$state` is not reactive; only class field `$state` is.
- **`StageNav.svelte`** — the dots + Back/Next buttons for the presenter deck. `total` defaults to 5; caller passes `present.total`. Will need to handle 7 screens in Phase 8 (5 base + *Your journey* + *Strategy*).
- **store (singleton)** — `src/lib/server/store.ts`. The `class Store` with `private room: RoomState | null`. The process-local singleton. **Dropped in Phase 3** — replaced with per-request read-then-mutate-then-conditional-UPDATE.
- **store (verb)** — `applyBoardDelta`, `applyBoardSet`, `applySubmitTable`, `applyAdvance`, `applyRetreat`. The mutating verbs. Pure functions on `room` + `table`. Take a `RoomState`, return success/failure + (sometimes) a derived shape.
- **subject** — the `setSubject` for the AI prompts. Currently inline in `rapidi.ts:51`. Moved to `prompts/brief.user.ts` in Phase 4.
- **sub-tables** — not used. One table per function. No nested tables. See *sub-card* for the presenter's submissions grid.
- **subCard (presenter)** — `src/routes/present/[code]/+page.svelte:215-242`. A 7-card grid showing each table's submission state (✓ Submitted, 🧊 Frozen, Open). Hidden when the analysis deck is open. Will collapse to a sticky footer strip in Phase 7.
- **surprise** — `aggregate.surprise: { seat, priority } | undefined`. The function that put ≥25% of its money on an off-type priority. The lens named "who surprised us".
- **`surpriseToken(functionVectors, personaBias)`** — `src/lib/game/scoring.ts`. Returns `{ seat, priority }` only when `offBias >= 2 && share >= 0.25`. Otherwise `undefined`.

### T

- **`tableBountyTokens(room)`** — `src/lib/game/rules/board.ts`. `floor(roomBountyTokens / tableCount)` — the per-table cap.
- **`tableId`** — 1-based, 0-based seat is `tableId - 1`. `tableSeatIndex(tableId) = clamp(tableId, 1, 7) - 1`. The auth-of-truth is `PERSONAS[]` order in `config.ts`.
- **`TableState`** — `src/lib/game/types.ts`. Per-table state: `id, board, lockedThisRound, submittedSeats, matrix, reach, commonGround, imageUrl`.
- **`tablePersona(tableId)`** — `src/lib/game/config.ts`. Returns `PERSONAS[tableSeatIndex(tableId)] ?? PERSONAS[0]`.
- **`tear-down`** — the function returned by `session.boot()`. Called from `onDestroy` (post-Phase 2). Clears the interval, removes the visibility listener, aborts the `AbortController`.
- **tiered lock** — the future capability to lock a single table by the host. Today's `lockTable` is binary (locked / unlocked). Phase 7 adds "lock all" with an undo toast.
- **time-to-first-byte** — the live URL's TTFB is bounded by Cloudflare's edge. The polling client's TTFB is irrelevant; SSE Phase 9 makes it irrelevant.
- **token usage (RapidI)** — `max_tokens: 700` in `rapidi.ts:55`. The brief is under 280 words. Phase 4 drops to `max_tokens: 480` to bound cost on the `fp8-fast` variant.
- **`tokenUnitLabel()`** — `src/lib/game/money.ts`. Returns the single chip value as a string (`'$10M'`).
- **`try/finally`** — every mutating endpoint uses this pattern. The `finally` resets `busy = false`. Post-Phase 7: replaced by `<svelte:boundary>` for partial UI failure.
- **type alias** — the `RoomState` and related types in `src/lib/game/types.ts` are the schema. A future Zod / Valibot schema would catch drift.

### U

- **`updateRoom(room, options?)` (proposed)** — the new mutation API in Phase 3. Replaces `setEnhancedBrief`, `setFinaleImage`, `setTableImage` with a single `updateRoom` that writes a single new snapshot.
- **`upsertHistory(room)`** — `src/lib/game/scoring.ts`. Idempotent insert-or-replace of the current round's snapshot. Called from `recompute`. Filters to R1-R5 (no snapshot for R0 / lobby).
- **use:countUp** (proposed) — Svelte 5 action in `src/lib/actions/count-up.ts`. Counts from old to new value over 280 ms. Use on every formatted `$` amount. **The action takes a raw number** (e.g. `use:countUp={total}`) — the formatted string inside the element is the *initial* value before the action takes over. Passing `use:countUp={formatUsdFull(total)}` (a string) would not work.
- **use:enhance** — SvelteKit's progressive-enhancement form action. **Not currently used.** Should replace every hand-rolled `fetch` + `try/finally` in the host page (Phase 7).
- **use:ripple** (proposed) — Svelte 5 action in `src/lib/actions/ripple.ts`. Material-style click ripple. Applied to every `<Button>` in Phase 5.
- **use:chipDrop** (proposed) — Svelte 5 action in `src/lib/actions/chip-drop.ts`. The single biggest visible win on the phone: animates a chip from the calling element to a target `HTMLElement` over 320 ms. The `to` field is a **function** (`to: () => pileRefs[p]`) not a raw `HTMLElement`, because the action runs *before* the `bind:this` ref resolves.
- **use:longPress** (proposed) — Svelte 5 action in `src/lib/actions/long-press.ts`. After 320 ms hold, calls `onstart`; then `onrepeat` every 100 ms while held; `onend` on release. Fires on `pointerdown` (touch + mouse) and `keydown` (Space/Enter for keyboard accessibility).
- **use:audio** (proposed) — Svelte 5 action in `src/lib/actions/audio.ts`. Plays a 1 ms AudioContext oscillator on click. **Requires a user gesture** (browser autoplay policy) — the first click creates the `AudioContext`. Use `kind: 'add' | 'remove'` to vary the frequency (880 Hz / 440 Hz).
- **use:haptic** (proposed) — see *haptic* in `$lib/actions/haptic.ts`. **Module-scoped**, not a `use:` directive. `haptic('add')` is `navigator.vibrate(8)`, `haptic('remove')` is `navigator.vibrate([5, 30, 5])`.
- **optimistic update** — the Svelte 5 pattern for server reconciliation. Apply the delta locally *before* the server responds, then await the server; revert on 409 (race lost) or on network error. The refactored `FunctionBoard.svelte` does this via `inflight = sign; await onDelta(...); inflight = null;` in a `try/finally`. See [FunctionBoard refactored — the drop-in].

### V

- **`Valibot` / `Zod`** — not used. The current "schema" is implicit (TypeScript types). A future migration to Valibot would catch drift at write time. Phase 11.
- **validation** — Phase 3 adds `^[a-zA-Z0-9-]{8,128}$` for `Idempotency-Key`. Phase 7 adds `<input type="color">` for persona colors and `<textarea>` for multi-line fields.
- **`variant` (Button)** — `'primary' | 'secondary' | 'teal' | 'outline' | 'ghost' | 'danger'`. The 6 button styles in `src/lib/components/Button.svelte`.
- **Vec7** — `src/lib/game/types.ts`. `type Vec7 = number[]`. A 7-element number vector. The shape of a priority vector.
- **verdict (roomInsights)** — `'Aligned' | 'Mixed' | 'Fractured' | '—'`. Computed from the CGI: `index >= 66` → "Aligned", `>= 40` → "Mixed", `> 0` → "Fractured", else `'—'`.
- **`verdicts(matrix, reach, functionVectors)`** — `src/lib/game/scoring.ts`. Returns `{ alignment, fault, blind }` (priority indices).
- **view transition** — Svelte 5 + browser API for cross-fade route changes. Added in `+layout.svelte` via `onNavigate` + `document.startViewTransition` (Phase 5).
- **`vibrate(10)`** — `navigator.vibrate(10)` on chip tap in `FunctionBoard.svelte:78`. A 10ms haptic. 8ms on tap is the Phase 5 polish. Submit seal: `vibrate([20, 50, 20])`.
- **`ViewImage` (proposed)** — see *ExpandImage*.

### W

- **`wait` (Scenario mode)** — the R1 mode. The board saves cumulative but doesn't seal.
- **webhook (proposed)** — for the LinkedIn share. The post-game share page could fire a webhook to a CRM (Zapier, Make) to log the share. Not in the current plan.
- **`winnersLosersByFunction(tables)`** — `src/lib/game/scoring.ts`. Returns per-function `{ winner, loser, runnerUp, total }`. Drives the "Winners & Losers" screen.
- **Workers AI** — the binding `AI` in `wrangler.jsonc`. Uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Falls back to numbers brief when unavailable.
- **`WorkspaceState`** — not used. The FutureWorkspace component owns its own state. A `<WorkspaceContext>` Svelte 5 context would let `FutureBrief` and `FutureRoomGen` share a "what's generating right now" state. Phase 7.
- **wrapped in `<svelte:boundary>`** — the Svelte 5 idiom for partial UI failure. Post-Phase 7: wrap FutureWorkspace body in a boundary.

### X

- **XSS** — not relevant. The codebase has no `innerHTML`, no `eval`, no `new Function`. All user input flows through Svelte's templated output. The `escape` in `app.html:9` is a Google Fonts URL, not user input. **No XSS surface.**

### Y

- **yarn / pnpm** — not used. The package manager is **Bun** (`bun.lock` v1).
- **yield (JS)** — used in `await this.tick()` and the SSE event loop. Standard async/await pattern. Don't use generator functions; Svelte 5 stores are async-aware.

### Z

- **`zoomed-out view`** — see *journey chart*. The 6th presenter screen proposed in Phase 8.

