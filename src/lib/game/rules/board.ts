/**
 * Pure board write rules — one function row per table.
 * Mutates table.board; caller recompute.
 */
import {
	N_SEATS,
	isCaptureRound,
	r3RemoveTarget,
	r5CapForWallet,
	roomScenarios,
	tableBountyTokens,
	tableSeatIndex
} from '../config';
import { emptyMatrix } from '../scoring';
import { N_PRIORITIES } from '../types';
import type { RoomState, TableState, Vec7 } from '../types';

export { tableBountyTokens };

/** Wallet ceiling for the current round (R5 restructure caps at 90% of the wallet). */
export function activeTableCap(room: RoomState): number {
	const base = tableBountyTokens(room);
	if (room.phase === 'round' && room.round + 1 === 5) {
		return r5CapForWallet(base);
	}
	return base;
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
	row[priority] = Math.max(0, (row[priority] ?? 0) + delta);
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
	let next = Math.max(0, Math.min(99, Number.isFinite(rounded) ? rounded : 0));
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
		.map((n) => Math.max(0, Math.min(99, Math.round(Number(n) || 0)))) as Vec7;

	if (isRemoveRound(room)) {
		row = row.map((v, i) => Math.min(v, prev[i] ?? 0)) as Vec7;
	}

	const nextBoard = emptyMatrix();
	nextBoard[seat] = row;

	const standing = prev.reduce((a, b) => a + b, 0);
	const cap = isRemoveRound(room) ? Math.max(0, standing) : activeTableCap(room);
	const total = boardTokenSum(nextBoard);
	if (total > cap) {
		return {
			ok: false,
			error: isRemoveRound(room)
				? `R3 REMOVE only — cannot add. Holding ${standing} tok; submitted ${total}.`
				: `Over table bounty: ${total} tokens > ${cap} allowed (room total ${room.roomBountyTokens})`
		};
	}

	// Round targets (seal path only — physical facilitation mirrors these numbers).
	// Targets scale with the host-configured wallet, not the $100M default.
	if (seal && roundLabel === 2) {
		const need = tableBountyTokens(room);
		if (total !== need) {
			return {
				ok: false,
				error: `R2 requires the full $${need}M budget (you have $${total}M). Place every token, then seal.`
			};
		}
	}
	if (seal && roundLabel === 3 && isRemoveRound(room)) {
		const removed = standing - total;
		const target = r3RemoveTarget(standing);
		if (removed < target) {
			return {
				ok: false,
				error: `R3 requires removing $${target}M (you removed $${removed}M of $${standing}M). Cut more, then seal.`
			};
		}
	}

	table.board = nextBoard;
	if (seal) {
		table.lockedThisRound = true;
		table.submittedSeats = Array(N_SEATS).fill(false);
		table.submittedSeats[seat] = true;
	}
	return { ok: true, sealed: seal };
}
