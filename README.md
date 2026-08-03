# Common Ground — Phygital

Live session app for the physical Common Ground boardroom game.

**Physical boards + one SPOC phone per table + paged presenter analysis.**  
**Chips: 🔴 $10M · 🔵 $5M · 🟢 $2M — $100M per table (6+4+10).** No vision / camera. No questions on the phone.

Domain scoring and chart DNA come from [`../poc`](../poc); image gen reuses the fal.ai pattern from POC / z-corenet.

---

## Quick start

```bash
bun install
bun run dev          # http://localhost:5173
```

Optional (Future Workplace render) — same key as z-corenet:

```bash
# copy FAL_API_KEY from z-corenet/.env into phygital/.env
```

Deploy:

```bash
bun run build
wrangler deploy
# wrangler secret put FAL_API_KEY
```

---

## Session flow

**One session only** (`LIVE`). Home page **is** the join QR — no “host a session” step.

1. Open `/` — shows join QR · session auto-starts  
2. Players scan → `/play/LIVE` → **pick table** → full **table board** → **Submit**  
3. Optional: `/host/LIVE` · `/present/LIVE` (Next through 4 analysis screens)  
4. Hierarchy: **session → table** (no seats). Board is cumulative; checkpoints configurable.

`POST /api/room` is **idempotent**. Host can **Reset session** if needed.

---

## Presenter analysis (4 screens)

Paged like z-corenet: **← →** or **Space**, or `?screen=1…4`.

| # | Screen | Content |
|---|--------|---------|
| **1** | **The Room at a Glance** | All tables merged · combined 7×7 portrait · stake / alignment strip |
| **2** | **Priority Evolution** | Featured rounds **R2 · R3 · R5** · biggest movers · **who broke the pattern** (surprise) |
| **3** | **Winners & Losers** | Per **function**: top stake vs weakest column (pre-page for the brief) |
| **4** | **Future Workplace** | **%-weighted mix** (e.g. 28% Productivity · 15% Innovation…) · openable numbers brief · **one room render** |

### Future workplace / render

- Image prompt is built from the **room investment mix**, e.g.  
  *“Spatial composition MUST reflect: 28% productivity, 15% innovation…”*  
  Larger % → more floorplate / focal presence.
- **Open full brief** shows the AI-ready text with alignment index, mix, mandate, fault/blind, directives.
- **Generate room render** → `POST /api/ai/room-concept` → fal.ai (`nano-banana-2`). Graceful empty state if no API key. (The brief is composed separately via `POST /api/ai/compose-brief`.)
- Single render first; multi-image gallery is optional later.

Analysis is **hidden** until unlock rounds (or force), so the room can still look at physical boards first.

---

## Routes

| Route | Role |
|-------|------|
| `/` | Create session / open presenter by code |
| `/host/[code]` | Operator: tables, advance, analysis unlocks, force show |
| `/present/[code]` | Big-screen analysis (4 pages when open) |
| `/present/[code]/qrs` | **One room join QR** (+ optional per-table deep links) |
| `/play/[code]` | Mobile join: pick table → pick role |
| `/play/[code]/[table]/[seat]` | Seat board — place chips (🔴🔵🟢) |
| `/table/...` | Legacy → redirects into `/play` |
| `/boards/all`, `/board/[seat]` | Print physical function boards (QR → join) |

### API (JSON)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/room` | Create room `{ tableCount? }` |
| `GET /api/room/[code]/state` | Full `RoomState` snapshot |
| `POST .../advance` | Host phase / round |
| `POST .../table-count` | Resize tables to N (1..N_SEATS) |
| `POST .../config` | `{ analysisUnlocks?, analysisForced? }` |
| `POST .../board` | `{ tableId, seat, priority, delta: ±1 }` or `value` |
| `POST .../board/clear-cell` | Zero one cell |
| `POST .../lock` / `.../unlock-table` | Round lock |
| `POST /api/ai/room-concept` / `/api/ai/compose-brief` | fal render + RapidI brief respectively |

---

## Domain model

| Concept | Detail |
|---------|--------|
| **Priorities (7 cols)** | Talent · Employee Experience · Employer Brand · Productivity · Innovation · Cost/ROI · Future Readiness |
| **Seats (7 rows)** | Real Estate · Workplace Exp · Operations · Marketing · Finance · Biz Leaders · HR |
| **Chips** | 🔴 $10M · 🔵 $5M · 🟢 $2M · **$100M/table** (6+4+10). Cells store value in $M (`TOKEN_VALUE_USD = $1M`) |
| **Table** | Live `board[7][7]` · SPOC edits · lock per round |
| **Room** | Sum of tables → aggregate (alignment / fault / blind / surprise / CGI) |
| **History** | Per-round snapshots for evolution (updated live, frozen on advance) |
| **Rounds** | **5** (`ROUND_COUNT=5`; deck-aligned scenarios; copy on host only) |
| **Default unlocks** | Analysis open at **R2 · R3 · R5** |
| **Capture rounds** | **R2 · R3 · R5** — fixed (not host-configurable) |

Scoring / verdict language is shared with POC: **Common Ground Index**, **alignment**, **fault line**, **blind spot**, **surprise token**.

---

## Stack

- **SvelteKit 5** (runes) + **Tailwind CSS v4**
- **Cloudflare** adapter (`wrangler`)
- **In-memory** room store (booth MVP; multi-isolate → Durable Object / D1 later)
- **HTTP poll** ~1s (`roomStream`) — not WebSockets
- **`@fal-ai/client`** for workspace image (**AI powered by ZyetaI**)
- **`qrcode`** for join / present QRs

---

## Project layout

```
src/lib/game/           pure .ts domain
src/lib/server/         Worker store + fal (ZyetaI)
src/lib/state/          global .svelte.ts (session · play · present · host)
src/lib/components/     .svelte UI (+ co-located *.svelte.ts when needed)
  phone/                SeatBoard
  present/              RoomGlance · Evolution · Winners · Future + StageNav
  analytics/            PortraitMatrix
src/routes/             host · present · play · boards · api
```


---

## Related

| Path | Role |
|------|------|
| [`../poc`](../poc) | Full digital multiplayer game (chips, CEO, Act 2) — source of scoring/analytics/fal patterns |
| [`../03_Prototypes`](../03_Prototypes) | HTML prototypes (presenter-screen, design-brief, boards) |
| [`../01_Session-Deck`](../01_Session-Deck) | Session PPT |
| [`../CORE-IDEA.md`](../CORE-IDEA.md) · [`../GAME-DESIGN.md`](../GAME-DESIGN.md) | Product language |

---

## Out of scope (this app)

- Computer vision / photo board-read  
- AI CEO voice host  
- Per-player phone betting wallets (see `poc`)  
- Act 2 notes / clap-o-meter  
- Durable multi-region room state (documented gap)

---

## Mantra

**Alignment first. Spend second.**
