/**
 * Global LIVE session — Svelte 5 runes module ($state / $derived, no $effect).
 * Poll never drops an update; advance applies returned room immediately.
 */
import type { RoomState, WorkspaceDesignKind } from '$lib/game/types';

export const SESSION = 'LIVE';
/** Faster refresh so phones unlock shortly after presenter advances. */
const INTERVAL = 500;

let room = $state.raw<RoomState | null>(null);
let connected = $state(false);
let busy = $state(false);
let error = $state('');
let timer: ReturnType<typeof setInterval> | null = null;
let booted = false;
/** Serialize polls so advance never skips a fetch. */
let pollChain: Promise<void> = Promise.resolve();
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
	// responses vs polls). Ties apply — same state either way.
	if (room && (next.updatedAt ?? 0) < (room.updatedAt ?? 0)) return;
	// Always replace reference so $state.raw notifies subscribers
	room = next;
	connected = true;
	error = '';
}

async function post<T>(
	url: string,
	body?: unknown,
	opts?: { idempotent?: boolean; idempotencyKey?: string }
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
				cache: 'no-store'
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
		const r = await fetch(`/api/room/${SESSION}/state`, {
			cache: 'no-store',
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
	pollChain = pollChain.then(fetchStateOnce).catch(() => {});
	return pollChain;
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
		session.ensure().catch(() => {});
		poll();
		timer = setInterval(() => {
			poll();
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
		busy = true;
		error = '';
		try {
			const res = await post<{
				phase: string;
				round: number;
				boardsOpened?: boolean;
				room?: RoomState;
			}>(`/api/room/${SESSION}/advance`);
			// Immediate UI update from response — don't wait for next poll
			if (res.room) applyRoom(res.room);
			else await poll();
			// Extra poll shortly after so multi-isolate cache settles for others
			setTimeout(() => {
				poll();
			}, 200);
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Advance failed';
			throw e;
		} finally {
			busy = false;
		}
	},

	/** Presenter: step back one phase/round; re-open boards for corrections. */
	async retreat() {
		busy = true;
		error = '';
		try {
			const res = await post<{
				phase: string;
				round: number;
				boardsOpened?: boolean;
				room?: RoomState;
			}>(`/api/room/${SESSION}/retreat`);
			if (res.room) applyRoom(res.room);
			else await poll();
			setTimeout(() => {
				poll();
			}, 200);
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Retreat failed';
			throw e;
		} finally {
			busy = false;
		}
	},


	async setConfig(body: {
		analysisForced?: boolean;
		roomBountyTokens?: number;
		priorities?: string[];
		resetOverrides?: boolean;
	}) {
		busy = true;
		try {
			const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/config`, body);
			if (res.room) applyRoom(res.room);
			else await poll();
		} finally {
			busy = false;
		}
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
		busy = true;
		try {
			const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/persona`, { seat, patch });
			if (res.room) applyRoom(res.room);
			else await poll();
		} finally {
			busy = false;
		}
	},

	async setScenario(round: number, patch: Record<string, unknown>) {
		busy = true;
		try {
			const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/scenario`, { round, patch });
			if (res.room) applyRoom(res.room);
			else await poll();
		} finally {
			busy = false;
		}
	},

	async setTableCount(count: number) {
		busy = true;
		try {
			const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/table-count`, { count });
			if (res.room) applyRoom(res.room);
			else await poll();
		} finally {
			busy = false;
		}
	},

	/** Chip delta in $M (±CHIP_VALUE = ±10). Local draft path preferred on phone. */
	async boardDelta(tableId: number, seat: number, priority: number, delta: number) {
		error = '';
		try {
			const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/board`, {
				tableId,
				seat,
				priority,
				delta
			});
			if (res.room) applyRoom(res.room);
			else await poll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Update failed';
			throw e;
		}
	},

	async clearCell(tableId: number, seat: number, priority: number) {
		error = '';
		try {
			const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/board/clear-cell`, {
				tableId,
				seat,
				priority
			});
			if (res.room) applyRoom(res.room);
			else await poll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Clear failed';
			throw e;
		}
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
		error = '';
		const quiet = !!opts?.quiet;
		if (!quiet) busy = true;
		try {
			const res = await post<{ room?: RoomState; sealed?: boolean }>(
				`/api/room/${SESSION}/lock`,
				{
					tableId,
					board,
					seal: opts?.seal !== false
				}
			);
			if (res.room) applyRoom(res.room);
			else await poll();
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Submit failed';
			throw e;
		} finally {
			if (!quiet) busy = false;
		}
	},

	async unlockTable(tableId: number) {
		const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/unlock-table`, {
			tableId
		});
		if (res.room) applyRoom(res.room);
		else await poll();
	},

	/** Player taps "Join Session" in lobby — shows presence to presenter. */
	async joinTable(tableId: number) {
		error = '';
		try {
			const res = await post<{ ok: boolean; room?: RoomState }>(
				`/api/room/${SESSION}/join`,
				{ tableId }
			);
			if (res.room) applyRoom(res.room);
			else await poll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Join failed';
		}
	},

	/** Player taps "Freeze" — physical tokens on the board are final. */
	async tablePhysicallyDone(tableId: number) {
		error = '';
		try {
			const res = await post<{ ok: boolean; room?: RoomState }>(
				`/api/room/${SESSION}/physical-done`,
				{ tableId }
			);
			if (res.room) applyRoom(res.room);
			else await poll();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Freeze failed';
		}
	},
	async lockTable(tableId: number) {
		const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/lock`, {
			tableId,
			seal: true
		});
		if (res.room) applyRoom(res.room);
		else await poll();
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
				// advance() also toggles busy — call via post path carefully
				const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/advance`, {});
				if (res.room) applyRoom(res.room);
				else await poll();
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
			}>(`/api/ai/room-concept`, { code: SESSION, t: Date.now() });
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
			}>(`/api/ai/table-render`, { tableId });
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
			}>(`/api/ai/brief`, { code: SESSION });
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
			}>(`/api/ai/workspace-design`, { code: SESSION });
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
			}>(`/api/ai/workspace-design`, { code: SESSION, kind });
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
			}>(`/api/ai/brief`, { code: SESSION });
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
			});
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
					return post<ImgRes>(`/api/ai/table-render`, { tableId });
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
			const compose = await post<ComposeRes>(`/api/ai/compose-brief`, { code: SESSION });
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
					}>(`/api/ai/workspace-design`, { code: SESSION });
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
			}>('/api/ai/brief-edit', { brief: text, source: 'manual' });
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
