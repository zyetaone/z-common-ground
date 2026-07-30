/**
 * Global LIVE session — Svelte 5 runes module ($state / $derived, no $effect).
 * Poll never drops an update; advance applies returned room immediately.
 */
import type { RoomState } from '$lib/game/types';

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

function applyRoom(next: RoomState | null | undefined) {
	if (!next || typeof next !== 'object') return;
	// Always replace reference so $state.raw notifies subscribers
	room = next;
	connected = true;
	error = '';
}

async function post<T>(url: string, body?: unknown): Promise<T> {
	const r = await fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body ?? {}),
		cache: 'no-store'
	});
	if (!r.ok) {
		const err = await r.json().catch(() => ({ message: r.statusText }));
		throw new Error((err as { message?: string }).message ?? `HTTP ${r.status}`);
	}
	return r.json() as Promise<T>;
}

async function fetchStateOnce() {
	if (typeof window === 'undefined') return;
	try {
		const r = await fetch(`/api/room/${SESSION}/state?t=${Date.now()}`, {
			cache: 'no-store',
			headers: { pragma: 'no-cache', 'cache-control': 'no-cache' }
		});
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

	async setTables(count: number) {
		busy = true;
		try {
			const res = await post<{ room?: RoomState }>(`/api/room/${SESSION}/tables`, { count });
			if (res.room) applyRoom(res.room);
			else await poll();
		} finally {
			busy = false;
		}
	},

	async setConfig(body: {
		analysisForced?: boolean;
		roomBountyTokens?: number;
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

	async boardDelta(tableId: number, seat: number, priority: number, delta: 1 | -1) {
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
	async submitTable(tableId: number, board: number[][], opts?: { seal?: boolean }) {
		error = '';
		busy = true;
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
			busy = false;
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

	async generateFinale() {
		busy = true;
		error = '';
		try {
			const res = await post<{
				url: string | null;
				imageError?: 'no_key' | 'failed';
				prompt?: string;
				brief?: string;
				briefSource?: 'numbers' | 'llama';
				llama?: boolean;
				room?: RoomState;
			}>(`/api/ai/finale`, {
				code: SESSION
			});
			if (res.room) applyRoom(res.room);
			else await poll();
			return res;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Generate failed';
			throw e;
		} finally {
			busy = false;
		}
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
				briefSource: 'numbers' | 'llama';
				llama: boolean;
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
	updateBrief(text: string) {
		if (room) {
			room = {
				...room,
				enhancedBrief: text,
				updatedAt: Date.now()
			};
		}
	}
};
