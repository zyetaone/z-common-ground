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
	personaBiasList,
	recomputeTable,
	tableBountyTokens,
	upsertHistory
} from '$lib/game';
import type { RoomState, TableState } from '$lib/game/types';
import { loadRoom, saveRoom } from './room-store';

/** One hosted session only — no multi-room codes. */
export const SESSION = 'LIVE';

function emptyTable(id: number): TableState {
	const t: TableState = {
		id,
		board: emptyMatrix(),
		lockedThisRound: false,
		submittedSeats: Array(N_SEATS).fill(false),
		matrix: Array(N_PRIORITIES).fill(0),
		reach: Array(N_PRIORITIES).fill(0),
		commonGround: 0
	};
	recomputeTable(t);
	return t;
}

function recompute(room: RoomState) {
	for (const t of room.tables) recomputeTable(t);
	room.aggregate = aggregate(room.tables, personaBiasList());
	for (const t of room.tables) recomputeTable(t, room.aggregate.matrix);
	room.lockedThisRound = room.tables.filter((t) => t.lockedThisRound).length;
	room.expectedLocks = room.tables.length;
	room.tableBountyTokens = tableBountyTokens(room);
	room.roundCount = ROUND_COUNT;
	if (room.round >= ROUND_COUNT) room.round = ROUND_COUNT - 1;
	room.analysisOpen = analysisOpen(room);
	const nextBrief = buildEnhancedBrief(room.aggregate);
	if (!nextBrief) {
		room.enhancedBrief = undefined;
		room.briefSource = undefined;
	} else if (room.briefSource !== 'llama') {
		room.enhancedBrief = nextBrief;
		room.briefSource = 'numbers';
	}
	if (room.phase !== 'finale' || room.history.length > 0) {
		upsertHistory(room);
	}
	room.updatedAt = Date.now();
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
	private syncing: Promise<boolean> | null = null;

	/**
	 * Pull the shared room from D1 (single primary — every colo agrees).
	 * Call before every read/mutate on the server.
	 * Returns whether a stored room existed (false = never created / empty DB).
	 */
	async sync(db: D1Database | undefined): Promise<boolean> {
		if (this.syncing) return this.syncing;
		this.syncing = (async () => {
			const stored = await loadRoom(db);
			if (!stored) return false;
			// D1 is authoritative — always adopt it (it holds every colo's writes).
			this.room = stored;
			return true;
		})().finally(() => {
			this.syncing = null;
		});
		return this.syncing;
	}

	/** Push current room to D1 so phones/presenter on any colo see advances. */
	async persist(db: D1Database | undefined): Promise<void> {
		if (this.room) await saveRoom(db, this.room);
	}

	/** Idempotent: always the one LIVE session. */
	ensure(tableCount = DEFAULT_TABLE_COUNT): RoomState {
		if (!this.room) this.room = makeRoom(tableCount);
		return this.room;
	}

	/** Reset the one session (host "new session"). */
	reset(tableCount?: number): RoomState {
		const n = tableCount ?? this.room?.tables.length ?? DEFAULT_TABLE_COUNT;
		this.room = makeRoom(n);
		return this.room;
	}

	/** Full snapshot for clients (after mutations). */
	snapshot(): RoomState {
		return this.ensure();
	}

	get(_code?: string): RoomState | undefined {
		return this.ensure();
	}

	/** Always 7 function tables (one persona each). Extra count ignored. */
	setTables(_code: string, count: number): RoomState {
		const room = this.ensure();
		const n = N_SEATS; // fixed — one table per function
		void count;
		while (room.tables.length < n) room.tables.push(emptyTable(room.tables.length + 1));
		while (room.tables.length > n) room.tables.pop();
		recompute(room);
		return room;
	}

	setConfig(
		_code: string,
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
	advance(_code?: string) {
		const room = this.ensure();
		const meta = applyAdvance(room);
		recompute(room);
		return { ...meta, room };
	}

	/** Presenter step back — rules pure. */
	retreat(_code?: string) {
		const room = this.ensure();
		const meta = applyRetreat(room);
		recompute(room);
		return { ...meta, room };
	}

	boardDelta(
		_code: string,
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
		_code: string,
		tableId: number,
		seat: number,
		priority: number,
		value: number
	): RoomState {
		const room = this.ensure();
		if (applyBoardSet(room, tableId, seat, priority, value)) recompute(room);
		return room;
	}

	clearCell(_code: string, tableId: number, seat: number, priority: number): RoomState {
		return this.boardSet(_code, tableId, seat, priority, 0);
	}

	/**
	 * Write table board (one function row). Seal only on capture rounds R2 · R3 · R5.
	 */
	submitTable(
		_code: string,
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
		_code: string,
		tableId: number,
		board?: number[][]
	): { room: RoomState; ok: boolean; error?: string } {
		return this.submitTable(_code, tableId, board, { seal: false });
	}

	lockTable(_code: string, tableId: number): RoomState {
		return this.submitTable(_code, tableId).room;
	}

	unlockTable(_code: string, tableId: number): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (table) {
			table.lockedThisRound = false;
			table.submittedSeats = Array(N_SEATS).fill(false);
		}
		recompute(room);
		return room;
	}

	unlockSeat(_code: string, tableId: number, seat: number): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (!table || seat < 0 || seat >= N_SEATS) return room;
		if (!table.submittedSeats) table.submittedSeats = Array(N_SEATS).fill(false);
		table.submittedSeats[seat] = false;
		table.lockedThisRound = false;
		recompute(room);
		return room;
	}

	setFinaleImage(_code: string, url: string): RoomState {
		const room = this.ensure();
		room.finaleImageUrl = url;
		room.updatedAt = Date.now();
		return room;
	}

	setTableImage(_code: string, tableId: number, url: string): RoomState {
		const room = this.ensure();
		const table = room.tables.find((t) => t.id === tableId);
		if (table) {
			table.imageUrl = url;
			room.updatedAt = Date.now();
		}
		return room;
	}

	setEnhancedBrief(
		_code: string,
		brief: string,
		source: 'numbers' | 'llama' = 'numbers'
	): RoomState {
		const room = this.ensure();
		if (!brief.trim()) {
			room.enhancedBrief = undefined;
			room.briefSource = undefined;
		} else {
			room.enhancedBrief = brief;
			room.briefSource = source;
		}
		room.updatedAt = Date.now();
		return room;
	}
}

export const store = new Store();

export function currentScenario(round: number) {
	return SCENARIOS[round] ?? SCENARIOS[ROUND_COUNT - 1];
}
