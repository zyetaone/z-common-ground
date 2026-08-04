import {
	DEFAULT_ROOM_BOUNTY_TOKENS,
	DEFAULT_TABLE_BOUNTY_TOKENS,
	DEFAULT_TABLE_COUNT,
	EVOLUTION_ROUNDS,
	N_PRIORITIES,
	N_SEATS,
	ROUND_COUNT,
	SCENARIOS,
	aggregate,
	analysisOpen,
	applyAdvance,
	applyBoardDelta,
	applyBoardSet,
	applyRetreat,
	applySubmitTable,
	buildEnhancedBrief,
	emptyMatrix,
	PERSONAS,
	personaBiasList,
	recomputeTable,
	roomPersonas,
	tableBountyTokens,
	upsertHistory,
	collectLiveAsArchive,
	mergeArchive
} from '$lib/game';
import {
	PRIORITIES,
	type Persona,
	type RoomState,
	type Scenario,
	type TableState,
	type WorkspaceDesignSheet
} from '$lib/game/types';
import { loadRoom, saveRoom, saveRoomIfUnchanged } from './room-store';

/** One hosted session only — no multi-room codes. */
export const SESSION = 'LIVE';
const ARCHIVE_MAX = 48;

function pushArchive(room: RoomState, entries: ReturnType<typeof collectLiveAsArchive>) {
	if (entries.length === 0) return;
	room.imageArchive = mergeArchive(room.imageArchive, entries, ARCHIVE_MAX);
}

function stripLiveImages(room: RoomState) {
	room.finaleImageUrl = undefined;
	room.roomConceptUrls = undefined;
	room.workspaceDesigns = undefined;
	for (const t of room.tables) t.imageUrl = undefined;
}

const ROOM_CONCEPT_CAP = 8;

function pushRoomConcept(room: RoomState, url: string) {
	const prev = room.roomConceptUrls ?? [];
	const next = [url, ...prev.filter((u) => u !== url)].slice(0, ROOM_CONCEPT_CAP);
	room.roomConceptUrls = next;
	room.finaleImageUrl = url;
}

function emptyTable(id: number): TableState {
	const t: TableState = {
		id,
		board: emptyMatrix(),
		joined: false,
		physicallyDone: false,
		lockedThisRound: false,
		submittedSeats: Array(N_SEATS).fill(false),
		matrix: Array(N_PRIORITIES).fill(0),
		reach: Array(N_PRIORITIES).fill(0),
		commonGround: 0
	};
	recomputeTable(t);
	return t;
}

/** Monotonic timestamp — never issues the same ms twice, so the state
 *  endpoint's ETag can't collide for two mutations in one millisecond. */
function bump(room: RoomState) {
	room.updatedAt = Math.max(Date.now(), room.updatedAt + 1);
}

function recompute(room: RoomState) {
	for (const t of room.tables) recomputeTable(t);
	// Host persona overrides (bias/name) feed scoring + surprise
	const biases = roomPersonas(room).map((p) => p.bias);
	room.aggregate = aggregate(room.tables, biases);
	for (const t of room.tables) recomputeTable(t, room.aggregate.matrix);
	room.lockedThisRound = room.tables.filter((t) => t.lockedThisRound).length;
	room.expectedLocks = room.tables.length;
	room.tableBountyTokens = tableBountyTokens(room);
	room.roundCount = ROUND_COUNT;
	if (room.round >= ROUND_COUNT) room.round = ROUND_COUNT - 1;
	room.analysisOpen = analysisOpen(room);
	const nextBrief = buildEnhancedBrief(room.aggregate, room);
	if (!nextBrief) {
		room.enhancedBrief = undefined;
		room.briefSource = undefined;
	} else if (room.briefSource !== 'rapidi' && room.briefSource !== 'manual') {
		room.enhancedBrief = nextBrief;
		room.briefSource = 'numbers';
	}
	if (room.phase !== 'finale' || room.history.length > 0) {
		upsertHistory(room);
	}
	bump(room);
}

function makeRoom(tableCount = DEFAULT_TABLE_COUNT): RoomState {
	const n = Math.max(1, Math.min(20, tableCount));
	const tables = Array.from({ length: n }, (_, i) => emptyTable(i + 1));
	const room: RoomState = {
		code: SESSION,
		phase: 'lobby',
		round: 0,
		roundCount: ROUND_COUNT,
		tables,
		aggregate: aggregate(tables, personaBiasList()),
		history: [],
		evolutionRounds: [...EVOLUTION_ROUNDS],
		analysisForced: false,
		analysisOpen: false,
		lockedThisRound: 0,
		expectedLocks: n,
		roomBountyTokens: DEFAULT_ROOM_BOUNTY_TOKENS,
		tableBountyTokens: DEFAULT_TABLE_BOUNTY_TOKENS,
		updatedAt: Date.now()
	};
	recompute(room);
	return room;
}

class Store {
	/** Single session — not a multi-room map. */
	private room: RoomState | null = null;
	private syncing: Promise<{ existed: boolean; failed: boolean }> | null = null;

	/**
	 * Pull the shared room from D1 (single primary — every colo agrees).
	 * Call before every read/mutate on the server.
	 * Returns { existed, failed }: existed=false means no row (safe to seed);
	 * failed=true means the read errored or the blob was invalid — callers
	 * must NOT persist in that case (stale memory would roll back D1).
	 */
	async sync(db: D1Database | undefined): Promise<{ existed: boolean; failed: boolean }> {
		if (this.syncing) return this.syncing;
		this.syncing = (async () => {
			const loaded = await loadRoom(db);
			if (loaded.kind === 'failed') return { existed: false, failed: true };
			if (loaded.kind === 'empty') return { existed: false, failed: false };
			// D1 is authoritative — always adopt it (it holds every colo's writes).
			this.room = loaded.room;
			return { existed: true, failed: false };
		})().finally(() => {
			this.syncing = null;
		});
		return this.syncing;
	}

	/** Push current room to D1 so phones/presenter on any colo see advances. */
	async persist(db: D1Database | undefined): Promise<void> {
		if (this.room) await saveRoom(db, this.room);
	}

	/**
	 * Compare-and-swap persist — only writes when D1 still holds
	 * `expectedUpdatedAt`. Returns false when another isolate wrote first;
	 * caller re-syncs and retries (or 409s).
	 */
	async persistIfUnchanged(db: D1Database | undefined, expectedUpdatedAt: number): Promise<boolean> {
		if (!this.room) return true;
		return saveRoomIfUnchanged(db, this.room, expectedUpdatedAt);
	}

	/** Idempotent: always the one LIVE session. */
	ensure(tableCount = DEFAULT_TABLE_COUNT): RoomState {
		if (!this.room) this.room = makeRoom(tableCount);
		return this.room;
	}

	/** Reset the one session (host "new session"). Archives live photos first. */
	reset(tableCount?: number): RoomState {
		const n = tableCount ?? this.room?.tables.length ?? DEFAULT_TABLE_COUNT;
		const carry = [
			...collectLiveAsArchive(this.room),
			...(this.room?.imageArchive ?? [])
		];
		this.room = makeRoom(n);
		pushArchive(this.room, carry);
		return this.room;
	}

	/** Full snapshot for clients (after mutations). */
	snapshot(): RoomState {
		return this.ensure();
	}

	get(): RoomState | undefined {
		return this.ensure();
	}


	setConfig(
		patch: {
			analysisForced?: boolean;
			roomBountyTokens?: number;
		}
	): RoomState {
		const room = this.ensure();
		if (typeof patch.analysisForced === 'boolean') room.analysisForced = patch.analysisForced;
		if (typeof patch.roomBountyTokens === 'number' && patch.roomBountyTokens >= 1) {
			room.roomBountyTokens = Math.min(9999, Math.round(patch.roomBountyTokens));
		}
		recompute(room);
		return room;
	}

	/** Advance clock — rules pure; store recompute + room return. */
	advance() {
		const room = this.ensure();
		const meta = applyAdvance(room);
		recompute(room);
		return { ...meta, room };
	}

	/** Presenter step back — rules pure. */
	retreat() {
		const room = this.ensure();
		const meta = applyRetreat(room);
		recompute(room);
		return { ...meta, room };
	}

	boardDelta(
		tableId: number,
		seat: number,
		priority: number,
		delta: number
	): RoomState {
		const room = this.ensure();
		if (applyBoardDelta(room, tableId, seat, priority, delta)) recompute(room);
		return room;
	}

	boardSet(
		tableId: number,
		seat: number,
		priority: number,
		value: number
	): RoomState {
		const room = this.ensure();
		if (applyBoardSet(room, tableId, seat, priority, value)) recompute(room);
		return room;
	}

	clearCell(tableId: number, seat: number, priority: number): RoomState {
		return this.boardSet(tableId, seat, priority, 0);
	}

	/**
	 * Write table board (one function row). Seal only on capture rounds R2 · R3 · R5.
	 */
	submitTable(
		tableId: number,
		board?: number[][],
		opts?: { seal?: boolean }
	): { room: RoomState; ok: boolean; error?: string; sealed?: boolean } {
		const room = this.ensure();
		const result = applySubmitTable(room, tableId, board, opts);
		if (result.ok) recompute(room);
		return { room, ...result };
	}

	/** Save cumulative board without capture seal (R1 / R4). */
	saveTableBoard(
		tableId: number,
		board?: number[][]
	): { room: RoomState; ok: boolean; error?: string } {
		return this.submitTable(tableId, board, { seal: false });
	}

	lockTable(tableId: number): RoomState {
		return this.submitTable(tableId).room;
	}

	unlockTable(tableId: number): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (table) {
			table.lockedThisRound = false;
			table.submittedSeats = Array(N_SEATS).fill(false);
		}
		recompute(room);
		return room;
	}

	unlockSeat(tableId: number, seat: number): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (!table || seat < 0 || seat >= N_SEATS) return room;
		if (!table.submittedSeats) table.submittedSeats = Array(N_SEATS).fill(false);
		table.submittedSeats[seat] = false;
		table.lockedThisRound = false;
		recompute(room);
		return room;
	}

	/** Player taps "Join" in lobby — mark table presence. */
	tableJoin(tableId: number): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (table) {
			table.joined = true;
			recompute(room);
		}
		return room;
	}

	/** Player taps "Freeze" — physical tokens are placed, ready to match digital. */
	tablePhysicallyDone(tableId: number): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (table) {
			table.physicallyDone = true;
			recompute(room);
		}
		return room;
	}

	setFinaleImage(url: string): RoomState {
		const room = this.ensure();
		pushRoomConcept(room, url);
		bump(room);
		return room;
	}

	/** Select primary room concept from palette (no new generate). */
	selectRoomConcept(url: string): RoomState {
		const room = this.ensure();
		const list = room.roomConceptUrls ?? [];
		if (!list.includes(url) && room.finaleImageUrl !== url) return room;
		room.finaleImageUrl = url;
		// Keep selected first in palette order for UI
		room.roomConceptUrls = [url, ...list.filter((u) => u !== url)];
		bump(room);
		return room;
	}

	/** Remove one Common Ground concept from the palette. */
	removeRoomConcept(url: string): RoomState {
		const room = this.ensure();
		const list = (room.roomConceptUrls ?? []).filter((u) => u !== url);
		// Backfill the primary only when the removed url was the finale image.
		if (room.finaleImageUrl === url) {
			room.finaleImageUrl = list[0];
		}
		room.roomConceptUrls = list.length ? list : undefined;
		bump(room);
		return room;
	}

	/** Host updates a single persona (by seat index 0..6). Merges onto defaults. */
	setPersona(seat: number, patch: Partial<Persona>): RoomState {
		const room = this.ensure();
		if (!room.personas) room.personas = [];
		if (seat < 0 || seat >= N_SEATS) return room;
		const base = PERSONAS[seat];
		const prev = room.personas[seat] ?? {};
		room.personas[seat] = { ...base, ...prev, ...patch, seat };
		// Recompute so analysis (names/colors/bias) picks up overrides
		recompute(room);
		return room;
	}

	/** Host updates a single scenario (by round index 0..4). Merges onto defaults. */
	setScenario(round: number, patch: Partial<Scenario>): RoomState {
		const room = this.ensure();
		if (!room.scenarios) room.scenarios = [];
		if (round < 0 || round >= ROUND_COUNT) return room;
		const base = SCENARIOS[round];
		const prev = room.scenarios[round] ?? {};
		room.scenarios[round] = {
			...base,
			...prev,
			...patch,
			round,
			roundLabel: round + 1
		};
		// Mode/move affect capture + remove rules; bump via recompute for live consumers
		recompute(room);
		return room;
	}

	/**
	 * Host renames the 7 board options (priority labels). Persists to D1;
	 * analysis + phones poll the new names.
	 */
	setPriorities(labels: string[]): RoomState {
		const room = this.ensure();
		if (!Array.isArray(labels) || labels.length !== N_PRIORITIES) return room;
		room.priorities = labels.map((l, i) => {
			const t = String(l ?? '').trim();
			return t || PRIORITIES[i];
		});
		recompute(room);
		return room;
	}

	/** Clear host persona / scenario / priority overrides → config defaults. */
	resetGameConfig(): RoomState {
		const room = this.ensure();
		room.personas = undefined;
		room.scenarios = undefined;
		room.priorities = undefined;
		recompute(room);
		return room;
	}

	/** Host changes table count (1..N_SEATS). Resizes tables array. */
	setTableCount(count: number): RoomState {
		const room = this.ensure();
		const n = Math.max(1, Math.min(N_SEATS, Math.round(count)));
		while (room.tables.length < n) room.tables.push(emptyTable(room.tables.length + 1));
		while (room.tables.length > n) room.tables.pop();
		recompute(room);
		return room;
	}

	setTableImage(tableId: number, url: string): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (table) {
			table.imageUrl = url;
			bump(room);
		}
		return room;
	}

	/**
	 * Host “Clear photos”: archive live AI images, then strip them from the live room
	 * so phones/presenter start clean. Archive stays available on host.
	 */
	archiveGeneratedImages(): RoomState {
		const room = this.ensure();
		pushArchive(room, collectLiveAsArchive(room));
		stripLiveImages(room);
		bump(room);
		return room;
	}

	setEnhancedBrief(
		brief: string,
	source: 'numbers' | 'rapidi' | 'manual' = 'numbers'
): RoomState {
	const room = this.ensure();
	if (!brief.trim()) {
		room.enhancedBrief = undefined;
		room.briefSource = undefined;
	} else {
		room.enhancedBrief = brief;
		// 'manual' edits store the literal so the UI can badge the source distinctly,
		// but for downstream consumers it's the same as 'rapidi' (a curated narrative).
		room.briefSource = source;
	}
	bump(room);
	return room;
}

	/** Architectural workspace sheets (collage / plan / section / elevation). */
	setWorkspaceDesigns(sheets: WorkspaceDesignSheet[]): RoomState {
		const room = this.ensure();
		room.workspaceDesigns = sheets.length ? sheets : undefined;
		bump(room);
		return room;
	}

	/** Insert or replace one design sheet by kind — keeps the other sheets. */
	upsertWorkspaceDesign(sheet: WorkspaceDesignSheet): RoomState {
		const room = this.ensure();
		const list = (room.workspaceDesigns ?? []).filter((s) => s.kind !== sheet.kind);
		list.push(sheet);
		room.workspaceDesigns = list;
		bump(room);
		return room;
	}
}

export const store = new Store();

