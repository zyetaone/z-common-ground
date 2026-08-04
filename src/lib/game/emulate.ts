/**
 * Solo / demo play — pure generators for fake table boards.
 * Host “Emulate session” uses these so analysis can run without real players.
 */
import {
	CHIP_VALUE,
	roomPersonas,
	roomScenarios,
	sealTargetFor,
	sealTargetTokens,
	tableBountyTokens,
	tableSeatIndex
} from './config';
import { emptyMatrix, sum } from './scoring';
import { N_PRIORITIES } from './types';
import type { Matrix7x7, RoomState, Vec7 } from './types';

/** Mulberry32 — tiny deterministic RNG */
function rng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Allocate `total` tokens (multiple of CHIP_VALUE) across 7 priorities,
 * weighted by persona bias + noise. Guarantees exact total when total % CHIP_VALUE === 0.
 */
export function allocateWeightedChips(
	bias: Vec7,
	total: number,
	seed = Date.now()
): Vec7 {
	const chip = CHIP_VALUE;
	const targetChips = Math.max(0, Math.floor(total / chip));
	const row = Array(N_PRIORITIES).fill(0) as Vec7;
	if (targetChips === 0) return row;

	const rand = rng(seed);
	const weights = bias.map((b, i) => Math.max(0.15, (b ?? 0) + 0.35 + rand() * 1.4 + (i % 3) * 0.05));
	let wSum = weights.reduce((a, b) => a + b, 0) || 1;

	// First pass: floor shares
	let placed = 0;
	const floors = weights.map((w) => {
		const n = Math.floor((w / wSum) * targetChips);
		return n;
	});
	for (let i = 0; i < N_PRIORITIES; i++) {
		row[i] = floors[i] * chip;
		placed += floors[i];
	}
	// Remainder chips → highest fractional weight
	let rem = targetChips - placed;
	const order = weights
		.map((w, i) => ({ i, f: (w / wSum) * targetChips - floors[i] }))
		.sort((a, b) => b.f - a.f);
	for (let k = 0; k < rem; k++) {
		const i = order[k % order.length].i;
		row[i] += chip;
	}
	return row;
}

/** Full 7×7 board with only the function seat row filled. */
export function emulateTableBoard(
	tableId: number,
	totalTokens: number,
	room?: RoomState | null,
	seed = Date.now()
): Matrix7x7 {
	const seat = tableSeatIndex(tableId);
	const persona = roomPersonas(room)[seat];
	const bias = (persona?.bias ?? Array(N_PRIORITIES).fill(1)) as Vec7;
	const row = allocateWeightedChips(bias, totalTokens, seed + tableId * 97);
	const board = emptyMatrix();
	board[seat] = row;
	return board;
}

/**
 * Target standing total for emulation given round rules.
 *
 * Reads the round's rule from the scenario (sealTargetFor), not from its number.
 * This was the last copy of the round rules in the codebase and it disagreed:
 * R3 aimed at "leave 70% of standing", which only clears the ≥30% removal
 * target when chip rounding happens to land there. At a host-shrunk $70M wallet
 * it left 50 of 70 — a $20M cut against a $21M target — and the seal was
 * refused, so Emulate died mid-demo on the one round it is most needed.
 */
export function emulateTargetTotal(room: RoomState, tableId: number): number {
	const label = room.phase === 'round' ? room.round + 1 : 5;
	const seat = tableSeatIndex(tableId);
	const table = room.tables.find((t) => t.id === tableId);
	// Measure the board, not table.matrix. applySubmitTable takes `prev` from
	// table.board[seat], so reading anything else lets emulate aim at a target
	// the gate isn't scoring — and matrix is a recompute artefact that can lag.
	const standing = table ? sum(table.board[seat] ?? []) : 0;
	const wallet = tableBountyTokens(room);

	/** Round to a whole chip count, at least one chip. */
	const toChips = (v: number) => Math.max(CHIP_VALUE, Math.round(v / CHIP_VALUE) * CHIP_VALUE);

	const target = sealTargetFor(roomScenarios(room)[room.round]);
	const need = sealTargetTokens(target, { wallet, standing });

	if (target && need !== undefined) {
		if (target.kind === 'full') return need;
		if (target.kind === 'cap') return need;
		// Remove: cut at least `need`, rounded UP to a whole chip so rounding can
		// never leave us a chip short of the target.
		const cut = Math.ceil(need / CHIP_VALUE) * CHIP_VALUE;
		const base = standing > 0 ? standing : wallet;
		return Math.max(CHIP_VALUE, base - cut);
	}
	// Freeze-only rounds seal nothing, so any total under the wallet is valid.
	if (label === 1) return toChips(wallet * 0.3); // opening stake
	if (label === 4) return Math.min(wallet, standing + toChips(wallet * 0.2));
	return wallet;
}

/** Boards for every table at current phase targets. */
export function emulateRoomBoards(room: RoomState, seed = Date.now()): Array<{
	tableId: number;
	board: Matrix7x7;
	total: number;
}> {
	return room.tables.map((t) => {
		const total = emulateTargetTotal(room, t.id);
		const board = emulateTableBoard(t.id, total, room, seed);
		return { tableId: t.id, board, total };
	});
}
