/**
 * Pure board write rules — one function row per table.
 * Mutates table.board; caller recompute.
 */
import {
	MAX_CELL_TOKENS,
	N_SEATS,
	isCaptureRound,
	roomScenarios,
	sealTargetFor,
	sealTargetTokens,
	tableBountyTokens,
	tableSeatIndex
} from '../config';
import { emptyMatrix } from '../scoring';
import { N_PRIORITIES } from '../types';
import type { RoomState, SealTarget, TableState, Vec7 } from '../types';

export { tableBountyTokens };

/** The budget rule in force right now, or undefined outside a round. */
export function activeSealTarget(room: RoomState): SealTarget | undefined {
	if (room.phase !== 'round') return undefined;
	return sealTargetFor(roomScenarios(room)[room.round]);
}

/** Everything the budget rules need, without a RoomState — so the phone can ask too. */
export type BoardRule = {
	target: SealTarget | undefined;
	/** Per-table wallet in $M. */
	wallet: number;
	/** Board total when the round opened (what a remove round measures against). */
	standing: number;
	removeOnly: boolean;
	roundLabel: number;
};

/**
 * Ceiling on the board total right now.
 *
 * The phone used to compute `removeOnly ? max(standing, total) : ...` while the
 * server used plain `standing`, so a draft could look legal on the phone and be
 * refused at seal. One function, one answer.
 */
export function boardCap(r: BoardRule): number {
	if (r.removeOnly) return Math.max(0, r.standing);
	if (r.target?.kind === 'cap') {
		return sealTargetTokens(r.target, { wallet: r.wallet, standing: r.standing }) ?? r.wallet;
	}
	return r.wallet;
}

/**
 * Why this board cannot be submitted, or null when it can.
 *
 * SSOT for three call sites that each carried their own copy: the server's seal
 * check, the phone's `r2Ready`/`r3Ready` derivations, and the submit button's
 * `disabled`. The client renders exactly the sentence the server would refuse
 * with, so the two can no longer say different things about the same board.
 */
export function sealBlocker(r: BoardRule & { total: number; seal: boolean }): string | null {
	const cap = boardCap(r);
	if (r.total > cap) {
		return r.removeOnly
			? `Remove only — cannot add. Holding $${r.standing}M; submitted $${r.total}M.`
			: `Over table budget: $${r.total}M > $${cap}M allowed.`;
	}
	if (!r.seal || !r.target) return null;

	const need = sealTargetTokens(r.target, { wallet: r.wallet, standing: r.standing });
	if (need === undefined) return null;
	if (r.target.kind === 'full' && r.total !== need) {
		return `R${r.roundLabel} requires the full $${need}M budget (you have $${r.total}M). Place every token, then seal.`;
	}
	if (r.target.kind === 'remove' && r.standing - r.total < need) {
		const removed = r.standing - r.total;
		return `R${r.roundLabel} requires removing $${need}M (you removed $${removed}M of $${r.standing}M). Cut more, then seal.`;
	}
	return null;
}

/** Read the rule in force for a table straight off the room. */
export function boardRuleFor(room: RoomState, standing: number): BoardRule {
	return {
		target: activeSealTarget(room),
		wallet: tableBountyTokens(room),
		standing,
		removeOnly: isRemoveRound(room),
		roundLabel: room.phase === 'round' ? room.round + 1 : 0
	};
}

/**
 * Wallet ceiling for the current round — the scenario's `cap` target when it has
 * one (R5 restructures to 90%), otherwise the full wallet.
 */
export function activeTableCap(room: RoomState): number {
	// Delegates to boardCap so the add path and the seal path can't disagree.
	// standing/removeOnly are the add-path values: this is the ceiling for
	// placing, and a remove round refuses adds outright in applyBoardDelta.
	return boardCap({
		target: activeSealTarget(room),
		wallet: tableBountyTokens(room),
		standing: 0,
		removeOnly: false,
		roundLabel: room.phase === 'round' ? room.round + 1 : 0
	});
}

/**
 * May this draft delta land? One predicate for the three phone call sites that
 * used to each carry their own copy — the row's `±`, the tap handler, and the
 * button's disabled state. When they disagreed, the `+` rendered enabled and
 * silently did nothing.
 *
 * Note the server's own delta endpoint is stricter: `applyBoardDelta` refuses
 * every add in a remove round, because it has no notion of the round-open
 * baseline. Put-back reaches the server through the draft + submit path, where
 * `applySubmitTable` clamps each cell to its previous value.
 */
export function canDraftDelta(o: {
	removeOnly: boolean;
	/** Current value of the cell being changed. */
	current: number;
	/** Value that cell held when the round opened (remove rounds only). */
	baseline: number;
	delta: number;
	/** Wallet headroom left on the board (adds only). */
	remaining: number;
}): boolean {
	if (!Number.isFinite(o.delta) || o.delta === 0) return false;
	// A removal has to fit in the cell. `current > 0` would be wrong: a cell
	// holding less than a chip (host set-value paths can make one) would enable
	// the minus, and the draft would then refuse to go negative — an enabled
	// button that does nothing, which is the bug this predicate exists to kill.
	if (o.delta < 0) return o.current + o.delta >= 0;
	// Remove rounds: an add is only ever a put-back, never past the round's start.
	if (o.removeOnly) return o.current + o.delta <= o.baseline;
	return o.delta <= o.remaining;
}

export function boardTokenSum(board: number[][]): number {
	let n = 0;
	for (const row of board) for (const c of row) n += c;
	return n;
}

/** Host scenario move is SSOT (default R3 = remove). */
export function isRemoveRound(room: RoomState): boolean {
	if (room.phase !== 'round') return false;
	return roomScenarios(room)[room.round]?.move === 'remove';
}

export function canEditTable(
	room: RoomState,
	table: TableState | undefined,
	seat?: number
): table is TableState {
	if (!table || table.lockedThisRound) return false;
	if (seat !== undefined && table.submittedSeats?.[seat]) return false;
	return room.phase === 'lobby' || room.phase === 'round';
}

/** Active function seat for table, or null if seat is wrong. */
export function functionSeatOrNull(tableId: number, seat: number): number | null {
	const fn = tableSeatIndex(tableId);
	return seat === fn ? fn : null;
}

export function applyBoardDelta(
	room: RoomState,
	tableId: number,
	seat: number,
	priority: number,
	delta: number
): boolean {
	const table = room.tables.find((t) => t.id === tableId);
	const fnSeat = functionSeatOrNull(tableId, seat);
	if (fnSeat === null) return false;
	if (!canEditTable(room, table, seat)) return false;
	if (!Number.isInteger(priority) || priority < 0 || priority >= N_PRIORITIES) return false;
	if (!Number.isFinite(delta) || delta === 0) return false;
	if (isRemoveRound(room) && delta > 0) return false;
	// Enforce the table wallet on the primary tap-to-place path (adds only) —
	// the cap used to live only on the seldom-hit seal path, so over-budget
	// totals reached analytics and got frozen into history.
	if (delta > 0) {
		const cap = activeTableCap(room);
		if (boardTokenSum(table.board) + delta > cap) return false;
	}

	const row = table.board[fnSeat].slice();
	row[priority] = Math.max(0, Math.min(MAX_CELL_TOKENS, (row[priority] ?? 0) + delta));
	table.board[fnSeat] = row;
	return true;
}

export function applyBoardSet(
	room: RoomState,
	tableId: number,
	seat: number,
	priority: number,
	value: number
): boolean {
	const table = room.tables.find((t) => t.id === tableId);
	const fnSeat = functionSeatOrNull(tableId, seat);
	if (fnSeat === null) return false;
	if (!canEditTable(room, table, seat)) return false;
	if (!Number.isInteger(priority) || priority < 0 || priority >= N_PRIORITIES) return false;

	const cur = table.board[fnSeat][priority] ?? 0;
	const rounded = Math.round(Number(value));
	let next = Math.max(0, Math.min(MAX_CELL_TOKENS, Number.isFinite(rounded) ? rounded : 0));
	if (isRemoveRound(room) && next > cur) next = cur;
	// Clamp so the whole board can never exceed the active wallet.
	const otherSum = boardTokenSum(table.board) - cur;
	next = Math.min(next, Math.max(0, activeTableCap(room) - otherSum));

	const row = table.board[fnSeat].slice();
	row[priority] = next;
	table.board[fnSeat] = row;
	return true;
}

export type SubmitTableResult =
	| { ok: true; sealed: boolean }
	| { ok: false; error: string; sealed?: boolean };

/**
 * Apply full row for table's function seat. Optionally seal on capture rounds.
 */
export function applySubmitTable(
	room: RoomState,
	tableId: number,
	board: number[][] | undefined,
	opts?: { seal?: boolean }
): SubmitTableResult {
	const table = room.tables.find((t) => t.id === tableId);
	if (!table) return { ok: false, error: 'Table not found' };
	if (room.phase !== 'lobby' && room.phase !== 'round') {
		return { ok: false, error: 'Not accepting submissions' };
	}
	if (table.lockedThisRound) return { ok: true, sealed: true };

	const roundLabel = room.phase === 'round' ? room.round + 1 : 0;
	const wantSeal = opts?.seal !== false;
	const canSeal = room.phase === 'round' && isCaptureRound(roundLabel, room);
	const seal = wantSeal && canSeal;

	if (wantSeal && !canSeal) {
		return {
			ok: false,
			error: `Submit/capture only on capture rounds (now ${room.phase === 'round' ? `R${roundLabel}` : room.phase})`
		};
	}

	const seat = tableSeatIndex(tableId);
	const source = board && Array.isArray(board) ? board : table.board;
	const prev = (table.board[seat] ?? Array(N_PRIORITIES).fill(0)).slice(0, N_PRIORITIES) as Vec7;
	let row = (source[seat] ?? Array(N_PRIORITIES).fill(0))
		.slice(0, N_PRIORITIES)
		.map((n) => Math.max(0, Math.min(MAX_CELL_TOKENS, Math.round(Number(n) || 0)))) as Vec7;

	if (isRemoveRound(room)) {
		row = row.map((v, i) => Math.min(v, prev[i] ?? 0)) as Vec7;
	}

	const nextBoard = emptyMatrix();
	nextBoard[seat] = row;

	const standing = prev.reduce((a, b) => a + b, 0);
	const total = boardTokenSum(nextBoard);
	// One predicate, shared with the phone — see sealBlocker.
	const blocker = sealBlocker({ ...boardRuleFor(room, standing), total, seal });
	if (blocker) return { ok: false, error: blocker };

	table.board = nextBoard;
	if (seal) {
		table.lockedThisRound = true;
		table.submittedSeats = Array(N_SEATS).fill(false);
		table.submittedSeats[seat] = true;
	}
	return { ok: true, sealed: seal };
}
