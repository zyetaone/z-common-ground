/**
 * Global LIVE session — Svelte 5 runes module ($state / $derived, no $effect).
 * Poll never drops an update; advance applies returned room immediately.
 */
import type { RoomState, WorkspaceDesignKind } from '$lib/game/types';

export const SESSION = 'LIVE';

type AdvanceResult = {
	phase: string;
	round: number;
	boardsOpened?: boolean;
	room?: RoomState;
};
/** Faster refresh so phones unlock shortly after presenter advances. */
const INTERVAL = 500;
/** Longer than any healthy poll (measured ~320-420ms) and short enough that a
 *  stalled request costs a few ticks, not the session. */
const POLL_TIMEOUT = 4000;
/**
 * Room mutations are one D1 compare-and-swap; 15s is far beyond the worst
 * observed and still bounded. Without a bound, a single stalled POST hangs its
 * caller forever — and because mutate() holds `busy` for the whole call, the
 * UI stays disabled with no error and no way back but a reload. That is what
 * wedged the emulate run: 21 sequential POSTs, any one of which could stall.
 *
 * AI routes pass their own — a fal render legitimately takes minutes.
 */
const MUTATE_TIMEOUT = 15_000;
const AI_TIMEOUT = 300_000;

let room = $state.raw<RoomState | null>(null);
let connected = $state(false);
let busy = $state(false);
let error = $state('');
let timer: ReturnType<typeof setInterval> | null = null;
let booted = false;
/** Serialize polls so advance never skips a fetch. */
let pollChain: Promise<void> = Promise.resolve();
/**
 * Polls queued but not yet finished.
 *
 * The chain is serialized, but the interval fired into it unconditionally. Any
 * response slower than INTERVAL — a distant colo, a D1 write ahead of us in the
 * queue, a phone on venue wifi — enqueued faster than the chain drained, so the
 * backlog grew for as long as the slowness lasted and the tab spent the whole
 * time working through stale snapshots. That is the intermittent freeze.
 *
 * The interval now skips its tick when work is already pending. Explicit polls
 * (after a mutation, on visibility) still queue unconditionally — those callers
 * await a *fresh* read and must not be coalesced away.
 */
let pollsPending = 0;
/**
 * Set by session.cancelZyetaI() to abort the long AI pipeline.
 *
 * The run is a 2-4 minute chain of paid calls with no way out short of a
 * page reload, which loses the operator's place. The flag is checked between
 * stages and between table renders — the in-flight fetch is left to settle so
 * whatever it paid for is still persisted, we just stop starting new work.
 */
let zyetaiCancelled = false;

function applyRoom(next: RoomState | null | undefined) {
	if (!next || typeof next !== 'object') return;
	// Never apply an older snapshot over a newer one (out-of-order mutation
	// responses vs polls).
	if (room && (next.updatedAt ?? 0) < (room.updatedAt ?? 0)) return;
	// Nor an identical one. Ties used to "apply — same state either way", but
	// $state.raw notifies on reference, not value: a tie swapped in a new object
	// and invalidated every subscriber, so the whole deck re-derived
	// functionProfiles / roomInsights / roomRoundStory for a room that had not
	// changed. That is the `[Violation] setInterval handler took 52ms`.
	if (room && (next.updatedAt ?? 0) === (room.updatedAt ?? 0)) {
		connected = true;
		return;
	}
	// Always replace reference so $state.raw notifies subscribers
	room = next;
	connected = true;
	error = '';
}

async function post<T>(
	url: string,
	body?: unknown,
	opts?: { idempotent?: boolean; idempotencyKey?: string; timeoutMs?: number }
): Promise<T> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (opts?.idempotent !== false) {
		// Stable key for this call so retries/double-submit replay safely
		const key =
			opts?.idempotencyKey ??
			(typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
		headers['idempotency-key'] = key;
	}
	// No If-Match: concurrency is handled server-side by the compare-and-swap in
	// live.ts (persistIfUnchanged). A client-supplied version would only add a
	// second, weaker gate — and one no handler reads.
	//
	// One retry on network failure with the SAME idempotency key — if the first
	// attempt landed but the response was lost, the server replays the cached
	// response instead of re-executing (no double mutation, no double fal charge).
	for (let attempt = 0; attempt < 2; attempt++) {
		let r: Response;
		try {
			r = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body ?? {}),
				cache: 'no-store',
				// A timeout surfaces as an AbortError, which the retry below treats
				// like any network failure: replayed once with the SAME idempotency
				// key, so a request that did land is not applied twice.
				signal: AbortSignal.timeout(opts?.timeoutMs ?? MUTATE_TIMEOUT)
			});
		} catch (e) {
			if (attempt === 0) continue; // network error — safe to replay with same key
			throw e;
		}
		if (r.status === 409) {
			await poll();
			throw new Error('Room changed — refreshed. Please retry.');
		}
		if (!r.ok) {
			const err = await r.json().catch(() => ({ message: r.statusText }));
			throw new Error((err as { message?: string }).message ?? `HTTP ${r.status}`);
		}
		return r.json() as Promise<T>;
	}
	throw new Error('Request failed');
}

async function fetchStateOnce() {
	if (typeof window === 'undefined') return;
	try {
		// A fetch with no timeout can hang indefinitely — a stalled connection,
		// a phone leaving wifi, a Worker cold start behind a dead socket. Since
		// the interval now skips while a poll is pending, ONE hung request used
		// to wedge the loop forever: pollsPending never returned to 0, no tick
		// ever fired again, and the page sat on "Connecting…" with a healthy
		// server. The abort makes the chain self-healing — it fails, the counter
		// clears, the next tick retries.
		const r = await fetch(`/api/room/${SESSION}/state`, {
			cache: 'no-store',
			signal: AbortSignal.timeout(POLL_TIMEOUT),
			headers: room?.updatedAt ? { 'if-none-match': `W/"${room.updatedAt}"` } : {}
		});
		if (r.status === 304) {
			// Room unchanged since our snapshot — skip the body entirely.
			connected = true;
			return;
		}
		if (r.ok) {
			const data = (await r.json()) as RoomState;
			// Prefer newer or equal snapshots (updatedAt)
			if (!room || (data.updatedAt ?? 0) >= (room.updatedAt ?? 0)) {
				applyRoom(data);
			} else {
				connected = true;
			}
		} else {
			connected = false;
		}
	} catch {
		connected = false;
	}
}

/** Queue polls so concurrent calls still each fetch (no dropped updates). */
function poll(): Promise<void> {
	pollsPending += 1;
	pollChain = pollChain
		.then(fetchStateOnce)
		.catch(() => {})
		.finally(() => {
			pollsPending -= 1;
		});
	return pollChain;
}

/**
 * Every room mutation is the same four beats: clear the error, POST, adopt the
 * room the handler returned (or poll when it returned none), surface failures.
 *
 * `quiet` skips the busy flag — board taps and presence pings fire rapidly and
 * must not disable the UI mid-round; `fail` is the message used when the thrown
 * value isn't an Error. Always rethrows: callers that don't care wrap in
 * `.catch(() => {})`.
 */
async function mutate<T extends { room?: RoomState }>(
	path: string,
	body?: unknown,
	opts?: { fail?: string; quiet?: boolean }
): Promise<T> {
	error = '';
	if (!opts?.quiet) busy = true;
	try {
		const res = await post<T>(`/api/room/${SESSION}${path}`, body);
		if (res.room) applyRoom(res.room);
		else await poll();
		return res;
	} catch (e) {
		error = e instanceof Error ? e.message : (opts?.fail ?? 'Request failed');
		throw e;
	} finally {
		if (!opts?.quiet) busy = false;
	}
}

export const session = {
	get room() {
		return room;
	},
	get connected() {
		return connected;
	},
	get busy() {
		return busy;
	},
	get error() {
		return error;
	},
	get code() {
		return SESSION;
	},

	get phase() {
		return room?.phase ?? 'lobby';
	},
	get tables() {
		return room?.tables ?? [];
	},
	get analysisOpen() {
		return room?.analysisOpen ?? false;
	},
	get updatedAt() {
		return room?.updatedAt ?? 0;
	},
	get round() {
		return room?.round ?? 0;
	},

	/** Call once from layout onMount. */
	boot() {
		if (typeof window === 'undefined' || booted) return () => {};
		booted = true;
		// Poll first, and only create the room if the poll says there isn't one.
		//
		// This used to fire ensure() unconditionally on every page load. ensure()
		// is a WRITE, and D1 has a single primary (SIN) — a viewer on a distant
		// colo paid a cross-continent round trip, twice, because the idempotency
		// layer then stored another copy of the same ~7KB room body. Observed in
		// wrangler tail as wallTime 11.7s against cpuTime 2ms, outcome canceled:
		// the Worker was idle on I/O while the deck sat on "Connecting…".
		//
		// The room is created once per session and then exists for its lifetime,
		// so on virtually every load this write was pure latency for no change.
		void poll().then(() => {
			if (!room) session.ensure().catch(() => {});
		});
		timer = setInterval(() => {
			if (pollsPending === 0) poll();
		}, INTERVAL);
		// Refresh when tab becomes visible again
		const onVis = () => {
			if (document.visibilityState === 'visible') poll();
		};
		document.addEventListener('visibilitychange', onVis);
		return () => {
			if (timer) clearInterval(timer);
			timer = null;
			document.removeEventListener('visibilitychange', onVis);
			booted = false;
		};
	},

	async refresh() {
		await poll();
	},

	async ensure(opts?: { tableCount?: number; reset?: boolean }) {
		busy = true;
		error = '';
		try {
			const res = await post<{ room?: RoomState }>('/api/room', opts ?? {});
			if (res.room) applyRoom(res.room);
			else await poll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Session failed';
			throw e;
		} finally {
			busy = false;
		}
	},

	async advance() {
		const res = await mutate<AdvanceResult>(
			'/advance',
			{ from: { phase: session.phase, round: session.round } },
			{ fail: 'Advance failed' }
		);
		// Extra poll shortly after so multi-isolate cache settles for others
		setTimeout(() => {
			poll();
		}, 200);
		return res;
	},

	/** Presenter: step back one phase/round; re-open boards for corrections. */
	async retreat() {
		const res = await mutate<AdvanceResult>(
			'/retreat',
			{ from: { phase: session.phase, round: session.round } },
			{ fail: 'Retreat failed' }
		);
		setTimeout(() => {
			poll();
		}, 200);
		return res;
	},


	async setConfig(body: {
		analysisForced?: boolean;
		roomBountyTokens?: number;
		priorities?: string[];
		resetOverrides?: boolean;
	}) {
		await mutate('/config', body, { fail: 'Config failed' });
	},

	/** Persist host-edited priority labels (7 board options). */
	async setPriorities(labels: string[]) {
		return this.setConfig({ priorities: labels });
	},

	/** Clear persona / scenario / priority host overrides. */
	async resetGameConfig() {
		return this.setConfig({ resetOverrides: true });
	},

	async setPersona(seat: number, patch: Record<string, unknown>) {
		await mutate('/persona', { seat, patch }, { fail: 'Persona failed' });
	},

	async setScenario(round: number, patch: Record<string, unknown>) {
		await mutate('/scenario', { round, patch }, { fail: 'Scenario failed' });
	},

	async setTableCount(count: number) {
		await mutate('/table-count', { count }, { fail: 'Table count failed' });
	},

	/** Chip delta in $M (±CHIP_VALUE = ±10). Local draft path preferred on phone. */
	async boardDelta(tableId: number, seat: number, priority: number, delta: number) {
		await mutate(
			'/board',
			{ tableId, seat, priority, delta },
			{ quiet: true, fail: 'Update failed' }
		);
	},

	async clearCell(tableId: number, seat: number, priority: number) {
		await mutate(
			'/board/clear-cell',
			{ tableId, seat, priority },
			{ quiet: true, fail: 'Clear failed' }
		);
	},

	/**
	 * Write board. seal=true only on capture rounds R2·R3·R5.
	 * seal=false saves cumulative progress without locking (R1·R4).
	 */
	async submitTable(
		tableId: number,
		board: number[][],
		opts?: { seal?: boolean; /** skip busy flag (batch emulate) */ quiet?: boolean }
	) {
		return mutate<{ room?: RoomState; sealed?: boolean }>(
			'/lock',
			{ tableId, board, seal: opts?.seal !== false },
			{ quiet: opts?.quiet, fail: 'Submit failed' }
		);
	},

	async unlockTable(tableId: number) {
		await mutate('/unlock-table', { tableId }, { quiet: true, fail: 'Unlock failed' });
	},

	/** Player taps "Join Session" in lobby — shows presence to presenter. */
	async joinTable(tableId: number) {
		// Presence is best-effort — a failed join must not block the player.
		await mutate('/join', { tableId }, { quiet: true, fail: 'Join failed' }).catch(() => {});
	},

	/** Player taps "Freeze" — physical tokens on the board are final. */
	async tablePhysicallyDone(tableId: number) {
		await mutate('/physical-done', { tableId }, { quiet: true, fail: 'Freeze failed' }).catch(
			() => {}
		);
	},
	async lockTable(tableId: number) {
		await mutate('/lock', { tableId, seal: true }, { quiet: true, fail: 'Lock failed' });
	},

	/**
	 * Solo demo: fill every table with a bias-weighted random board for this round,
	 * join presence, freeze physical, and seal when the round is a capture round.
	 */
	async emulateDemoPlay(seed = Date.now()) {
		if (busy) return { ok: false as const, error: 'busy' as const };
		const { emulateRoomBoards, isCaptureRound } = await import('$lib/game');
		error = '';
		busy = true;
		try {
			await this.ensure({});
			// ensure's finally clears busy — hold it for the rest of the batch
			busy = true;
			let current = room;
			if (!current) throw new Error('No room');
			if (current.phase === 'lobby') {
				// quiet: advance() would clear the busy flag this batch is holding
				await mutate('/advance', {}, { quiet: true });
				current = room;
			}
			if (!current || current.phase !== 'round') {
				throw new Error('Emulate needs an open round — advance from lobby/reveal first.');
			}
			const roundLabel = current.round + 1;
			const seal = isCaptureRound(roundLabel, current);
			const plans = emulateRoomBoards(current, seed);
			for (const p of plans) {
				try {
					await this.joinTable(p.tableId);
				} catch {
					/* presence best-effort */
				}
				try {
					await this.tablePhysicallyDone(p.tableId);
				} catch {
					/* freeze best-effort */
				}
				await this.submitTable(p.tableId, p.board, { seal, quiet: true });
			}
			await poll();
			return { ok: true as const };
		} catch (e) {
			error = e instanceof Error ? e.message : 'Emulate failed';
			throw e;
		} finally {
			busy = false;
		}
	},


	/**
	 * Palette + : generate one room still only (no brief rewrite).
	 * Pushes onto roomConceptUrls via setFinaleImage.
	 */
	async generateRoomConcept() {
		if (busy) return { ok: false as const, error: 'busy' as const };
		busy = true;
		error = '';
		try {
			const res = await post<{
				url: string | null;
				imageError?: 'no_key' | 'failed';
				paletteSize?: number;
				room?: RoomState;
			}>(`/api/ai/room-concept`, { code: SESSION, t: Date.now() }, { timeoutMs: AI_TIMEOUT });
			if (res.room) applyRoom(res.room);
			else await poll();
			return { ok: true as const, ...res };
		} catch (e) {
			error = e instanceof Error ? e.message : 'Room concept failed';
			throw e;
		} finally {
			busy = false;
		}
	},

	/** Select primary Common Ground concept from palette. */
	async selectRoomConcept(url: string) {
		const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/room-concept`, {
			action: 'select',
			url
		});
		if (res.room) applyRoom(res.room);
		else await poll();
		return res;
	},

	/** Remove one room concept from the palette. */
	async removeRoomConcept(url: string) {
		const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/room-concept`, {
			action: 'remove',
			url
		});
		if (res.room) applyRoom(res.room);
		else await poll();
		return res;
	},

	/** Table-scoped fal render (mobile / function lens). */
	async generateTableRender(tableId: number) {
		busy = true;
		error = '';
		try {
			const res = await post<{
				url: string | null;
				imageError?: 'no_key' | 'failed';
				prompt?: string;
				tableId: number;
				functionName?: string;
				room?: RoomState;
			}>(`/api/ai/table-render`, { tableId }, { timeoutMs: AI_TIMEOUT });
			if (res.room) applyRoom(res.room);
			else await poll();
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Table render failed';
			throw e;
		} finally {
			busy = false;
		}
	},

	async generateBrief() {
		busy = true;
		error = '';
		try {
			const res = await post<{
				brief: string;
				briefSource: 'numbers' | 'rapidi';
				rapidi: boolean;
				room?: RoomState;
			}>(`/api/ai/brief`, { code: SESSION }, { timeoutMs: AI_TIMEOUT });
			if (res.room) applyRoom(res.room);
			else await poll();
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Brief failed';
			throw e;
		} finally {
			busy = false;
		}
	},

	/**
	 * Generate architectural workspace design sheets (collage, plan, section, elevation)
	 * from final brief + all concept reference images.
	 */
	async generateWorkspaceDesign(onProgress?: (msg: string) => void) {
		busy = true;
		error = '';
		try {
			onProgress?.('Generating workspace design from brief + refs…');
			const res = await post<{
				sheets: Array<{ kind: string; label: string; url: string }>;
				count: number;
				imageError?: 'no_key' | 'failed';
				room?: RoomState;
			}>(`/api/ai/workspace-design`, { code: SESSION }, { timeoutMs: AI_TIMEOUT });
			if (res.room) applyRoom(res.room);
			else await poll();
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Workspace design failed';
			throw e;
		} finally {
			busy = false;
			onProgress?.('');
		}
	},

	/**
	 * Generate a single architectural sheet by kind (design studio per-sheet
	 * generate/regen). Server upserts by kind — other sheets are untouched.
	 */
	async generateWorkspaceDesignSheet(kind: WorkspaceDesignKind) {
		busy = true;
		error = '';
		try {
			const res = await post<{
				kind?: WorkspaceDesignKind;
				sheets: Array<{ kind: string; label: string; url: string }>;
				count: number;
				imageError?: 'no_key' | 'failed';
				room?: RoomState;
			}>(`/api/ai/workspace-design`, { code: SESSION, kind }, { timeoutMs: AI_TIMEOUT });
			if (res.room) applyRoom(res.room);
			else await poll();
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Sheet generation failed';
			throw e;
		} finally {
			busy = false;
		}
	},

	/**
	 * ZyetaI concept pipeline — sequential stages (not parallel ad-hoc calls):
	 *
	 *   1 Lenses     → read stake shapes (poll)
	 *   2 Brief      → POST /api/ai/brief  (once)
	 *   3 Zones      → client map (no network)
	 *   4 Images     → room-concept, then each table-render one-by-one
	 *   5 Lookbook   → POST /api/ai/compose-brief (once, after images)
	 *
	 * Design sheets are a separate pipeline on /design (mode: 'design').
	 * Palette + uses generateRoomConcept() only (single stage).
	 */
	async generateZyetaIPackage(
		onProgress?: (msg: string) => void,
		opts?: {
			mode?: 'full' | 'brief' | 'images' | 'lookbook' | 'design';
			onStep?: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;
		}
	) {
		if (busy) return { ok: false as const, error: 'busy' };
		const mode = opts?.mode ?? 'full';
		busy = true;
		error = '';
		zyetaiCancelled = false;
		const report = (m: string) => onProgress?.(m);
		const step = (n: 1 | 2 | 3 | 4 | 5 | 6) => opts?.onStep?.(n);

		type ComposeRes = {
			brief: string;
			briefSource: 'numbers' | 'rapidi';
			rapidi: boolean;
			cardCount?: number;
			functionCards?: number;
			room?: RoomState;
		};
		type ImgRes = {
			url: string | null;
			imageError?: 'no_key' | 'failed';
			room?: RoomState;
		};

		let lastUrl: string | null = null;
		let lastImageError: 'no_key' | 'failed' | undefined;
		let lastBrief: string | undefined;
		let lastSource: 'numbers' | 'rapidi' | undefined;
		let lastRapidi: boolean | undefined;
		let cardCount: number | undefined;
		let functionCards: number | undefined;
		let designCount: number | undefined;
		/** Tables whose render failed — reported so the operator can retry just those. */
		const failedTables: number[] = [];
		/** Stages that failed. Each stage persists server-side as it completes, so a
		 *  later stage failing must not throw away the earlier ones. */
		const failedStages: string[] = [];

		/**
		 * Run one stage, keeping whatever the earlier stages already saved.
		 *
		 * Every stage writes to D1 as it completes, so throwing out of the middle
		 * of the pipeline discards nothing on the server but leaves the operator
		 * with one opaque error and no idea which stage died or what survived.
		 * Compose in particular is worth continuing past: the images are the
		 * expensive part and they are already paid for.
		 */
		async function stage(name: string, run: () => Promise<void>): Promise<void> {
			if (zyetaiCancelled) return;
			try {
				await run();
			} catch (e) {
				if (zyetaiCancelled) return; // an abort is not a failure
				failedStages.push(name);
				console.error(`[zyetai] stage "${name}" failed:`, e);
			}
		}

		// ── Stage helpers ──

		async function runBriefStage() {
			// 1 · Lenses — read current stake shapes
			step(1);
			report('Reading each function’s priority shape…');
			await poll();

			// 2 · Brief — single analysis pass (no compose yet)
			step(2);
			report('Writing the analysis brief…');
			const briefRes = await post<{
				brief: string;
				briefSource: 'numbers' | 'rapidi';
				rapidi: boolean;
				room?: RoomState;
			}>(`/api/ai/brief`, { code: SESSION }, { timeoutMs: AI_TIMEOUT });
			if (briefRes.room) applyRoom(briefRes.room);
			lastBrief = briefRes.brief;
			lastSource = briefRes.briefSource;
			lastRapidi = briefRes.rapidi;
		}

		async function runImageStage() {
			// 4 · Images — room first, then each function sequentially
			step(4);
			report('Rendering Common Ground room…');
			const roomImg = await post<ImgRes>(`/api/ai/room-concept`, {
				code: SESSION,
				t: Date.now()
			}, { timeoutMs: AI_TIMEOUT });
			if (roomImg.room) applyRoom(roomImg.room);
			lastUrl = roomImg.url;
			if (roomImg.imageError) lastImageError = roomImg.imageError;

			const tables = (room?.tables ?? []).filter((t) =>
				(t.matrix ?? []).some((n) => n > 0)
			);
			const pending = mode === 'images' ? tables.filter((t) => !t.imageUrl) : tables;
			if (pending.length === 0) {
				report('All function lenses already rendered…');
			}
			// One table must not sink the run. Each render is a paid fal call and
			// completed ones are already persisted, so throwing here would discard
			// the remaining tables and force a re-run that re-pays for every image
			// already made. See renderTablesTolerantly for the full rationale.
			const { renderTablesTolerantly } = await import('$lib/game');
			const outcome = await renderTablesTolerantly(
				pending.map((t) => t.id),
				async (tableId, i) => {
					report(`Rendering function lens ${i + 1} of ${pending.length}…`);
					return post<ImgRes>(`/api/ai/table-render`, { tableId }, { timeoutMs: AI_TIMEOUT });
				},
				(_id, tr) => {
					if (tr.room) applyRoom(tr.room);
					if (tr.imageError === 'no_key') lastImageError = 'no_key';
					else if (tr.imageError && !lastImageError) lastImageError = tr.imageError;
				},
				() => zyetaiCancelled
			);
			failedTables.push(...outcome.failedTables);
			await poll();
		}

		async function runComposeStage() {
			// 5 · Lookbook — compose once after images exist
			step(5);
			report('Composing lookbook brief…');
			const compose = await post<ComposeRes>(`/api/ai/compose-brief`, { code: SESSION }, { timeoutMs: AI_TIMEOUT });
			if (compose.room) applyRoom(compose.room);
			lastBrief = compose.brief ?? lastBrief;
			lastSource = compose.briefSource ?? lastSource;
			lastRapidi = compose.rapidi ?? lastRapidi;
			cardCount = compose.cardCount ?? cardCount;
			functionCards = compose.functionCards ?? functionCards;
		}

		try {
			// ── Design pipeline (separate page) ──
			if (mode === 'design') {
				await stage('drawings', async () => {
					step(6);
					report('Building plan · section · elevation · collage…');
					const design = await post<{
						sheets: unknown[];
						count: number;
						imageError?: 'no_key' | 'failed';
						room?: RoomState;
					}>(`/api/ai/workspace-design`, { code: SESSION }, { timeoutMs: AI_TIMEOUT });
					if (design.room) applyRoom(design.room);
					lastImageError = design.imageError;
					designCount = design.count;
				});
				await poll();
				return {
					ok: true as const,
					mode,
					url: lastUrl,
					imageError: lastImageError,
					brief: room?.enhancedBrief,
					briefSource: room?.briefSource,
					rapidi: undefined,
					cardCount,
					functionCards,
					designCount,
					failedTables,
					failedStages,
					cancelled: zyetaiCancelled
				};
			}

			// ═══ CONCEPT PIPELINE 1 → 5 ═══

			if (mode === 'full' || mode === 'brief') {
				await stage('brief', runBriefStage);
			}

			// 3 · Zones — pure client map from mix
			if (mode === 'full' || mode === 'brief' || mode === 'lookbook') {
				step(3);
				report('Mapping spatial zones from the mix…');
				await new Promise((r) => setTimeout(r, 280));
			}

			if (mode === 'full' || mode === 'images') {
				await stage('images', runImageStage);
			}

			if (mode === 'full' || mode === 'images' || mode === 'lookbook' || mode === 'brief') {
				await stage('lookbook', runComposeStage);
			}

			await poll();
			return {
				ok: true as const,
				mode,
				url: lastUrl,
				imageError: lastImageError,
				brief: lastBrief,
				briefSource: lastSource,
				rapidi: lastRapidi,
				cardCount,
				functionCards,
				designCount,
				failedTables,
				failedStages,
				cancelled: zyetaiCancelled
			};
		} catch (e) {
			error = e instanceof Error ? e.message : 'ZyetaI package failed';
			throw e;
		} finally {
			busy = false;
			onProgress?.('');
		}
	},

	/**
	 * Stop a running ZyetaI pipeline at the next stage/table boundary.
	 *
	 * The in-flight request is deliberately left to settle rather than aborted:
	 * it is already paid for and its server-side write is what persists the
	 * image. Cancelling only stops new work from starting.
	 */
	cancelZyetaI() {
		if (!busy) return false;
		zyetaiCancelled = true;
		return true;
	},

	/** Host: archive live AI photos then clear them from the room (not a full reset). */
	async archiveGeneratedImages() {
		busy = true;
		error = '';
		try {
			const res = await post<{ ok: boolean; room?: RoomState }>(
				`/api/room/${SESSION}/clear-images`
			);
			if (res.room) applyRoom(res.room);
			else await poll();
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Archive photos failed';
			throw e;
		} finally {
			busy = false;
		}
	},
	async updateBrief(text: string) {
		// Persist to the server so it survives polls and is visible to Design/Host.
		try {
			const res = await post<{
				brief?: string;
				briefSource?: 'numbers' | 'rapidi' | 'manual';
				room?: RoomState;
			}>('/api/ai/brief-edit', { brief: text, source: 'manual' }, { timeoutMs: AI_TIMEOUT });
			if (res.room) applyRoom(res.room);
			else await poll();
		} catch (e) {
			// No optimistic local write — a fake updatedAt would poison the
			// staleness guard and freeze the client on unsaved text. Resync instead.
			error = e instanceof Error ? e.message : 'Brief edit failed';
			await poll();
		}
	}
};
