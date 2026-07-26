/**
 * Unit tests — pure phase + board rules (no Worker / Svelte).
 */
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ROOM_BOUNTY_TOKENS,
	DEFAULT_TABLE_COUNT,
	N_PRIORITIES,
	N_SEATS,
	ROUND_COUNT,
	aggregate,
	emptyMatrix,
	personaBiasList,
	recomputeTable,
	surpriseToken,
	verdicts
} from '$lib/game';
import type { RoomState, RoundSnapshot, TableState, Vec7 } from '$lib/game/types';
import {
	applyAdvance,
	applyBoardDelta,
	applyBoardSet,
	applyRetreat,
	applySubmitTable,
	isRemoveRound
} from './index';

function emptyTable(id: number): TableState {
	return {
		id,
		board: emptyMatrix(),
		lockedThisRound: false,
		submittedSeats: Array(N_SEATS).fill(false),
		matrix: Array(N_PRIORITIES).fill(0),
		reach: Array(N_PRIORITIES).fill(0),
		commonGround: 0
	};
}

function makeRoom(partial?: Partial<RoomState>): RoomState {
	const tables = Array.from({ length: DEFAULT_TABLE_COUNT }, (_, i) => emptyTable(i + 1));
	const base: RoomState = {
		code: 'LIVE',
		phase: 'lobby',
		round: 0,
		roundCount: ROUND_COUNT,
		tables,
		aggregate: {
			matrix: Array(N_PRIORITIES).fill(0),
			reach: Array(N_PRIORITIES).fill(0),
			alignmentIndex: 0,
			alignment: 0,
			fault: 0,
			blind: 0,
			totalCoins: 0,
			tableCount: DEFAULT_TABLE_COUNT
		},
		history: [],
		evolutionRounds: [2, 3, 5],
		analysisForced: false,
		analysisOpen: false,
		lockedThisRound: 0,
		expectedLocks: DEFAULT_TABLE_COUNT,
		roomBountyTokens: DEFAULT_ROOM_BOUNTY_TOKENS,
		tableBountyTokens: 100,
		updatedAt: Date.now()
	};
	return { ...base, ...partial, tables: partial?.tables ?? tables };
}

/** Put tokens on table 1 function seat (seat 0). */
function stakeTable1(room: RoomState, amounts: number[]) {
	const t = room.tables[0];
	const row = Array(N_PRIORITIES).fill(0);
	amounts.forEach((v, i) => {
		row[i] = v;
	});
	t.board[0] = row;
}

describe('applyAdvance', () => {
	it('lobby → R1 and opens boards', () => {
		const room = makeRoom();
		room.tables[0].lockedThisRound = true;
		const r = applyAdvance(room);
		expect(r.phase).toBe('round');
		expect(r.round).toBe(0);
		expect(r.boardsOpened).toBe(true);
		expect(room.tables[0].lockedThisRound).toBe(false);
	});

	it('R1 → R2 … R5 → reveal → finale', () => {
		const room = makeRoom({ phase: 'round', round: 0 });
		applyAdvance(room);
		expect(room.round).toBe(1);
		// jump to last round
		room.round = ROUND_COUNT - 1;
		const leave = applyAdvance(room);
		expect(leave.phase).toBe('reveal');
		expect(leave.captured).toBe(true); // R5 is capture
		const fin = applyAdvance(room);
		expect(fin.phase).toBe('finale');
	});

	it('does not wipe board tokens on advance', () => {
		const room = makeRoom({ phase: 'round', round: 0 });
		stakeTable1(room, [2, 0, 1, 0, 0, 0, 0]);
		applyAdvance(room);
		expect(room.tables[0].board[0][0]).toBe(2);
		expect(room.tables[0].board[0][2]).toBe(1);
	});
});

describe('applyRetreat', () => {
	it('finale → reveal → R5 → … → lobby', () => {
		const room = makeRoom({ phase: 'finale', round: ROUND_COUNT - 1 });
		applyRetreat(room);
		expect(room.phase).toBe('reveal');
		applyRetreat(room);
		expect(room.phase).toBe('round');
		expect(room.round).toBe(ROUND_COUNT - 1);
		// back to R1
		while (room.round > 0) applyRetreat(room);
		applyRetreat(room);
		expect(room.phase).toBe('lobby');
	});
});

describe('R3 remove rules', () => {
	function r3Room(): RoomState {
		// round index 2 = R3 (0-based)
		const room = makeRoom({ phase: 'round', round: 2 });
		stakeTable1(room, [3, 2, 0, 0, 0, 0, 0]);
		return room;
	}

	it('isRemoveRound true only on R3', () => {
		expect(isRemoveRound(makeRoom({ phase: 'round', round: 2 }))).toBe(true);
		expect(isRemoveRound(makeRoom({ phase: 'round', round: 1 }))).toBe(false);
	});

	it('rejects positive delta on R3', () => {
		const room = r3Room();
		const ok = applyBoardDelta(room, 1, 0, 0, 1);
		expect(ok).toBe(false);
		expect(room.tables[0].board[0][0]).toBe(3);
	});

	it('allows subtract on R3', () => {
		const room = r3Room();
		const ok = applyBoardDelta(room, 1, 0, 0, -1);
		expect(ok).toBe(true);
		expect(room.tables[0].board[0][0]).toBe(2);
	});

	it('clamps boardSet above standing on R3', () => {
		const room = r3Room();
		const ok = applyBoardSet(room, 1, 0, 0, 9);
		expect(ok).toBe(true);
		expect(room.tables[0].board[0][0]).toBe(3); // clamped
	});

	it('submit rejects increases vs standing', () => {
		const room = r3Room();
		const board = emptyMatrix();
		board[0] = [5, 2, 0, 0, 0, 0, 0]; // tried to add on pri 0
		const res = applySubmitTable(room, 1, board, { seal: true });
		expect(res.ok).toBe(true);
		// clamped to min(5,3)=3
		expect(room.tables[0].board[0][0]).toBe(3);
	});

	it('submit over standing total fails if row somehow exceeds cap after clamp', () => {
		const room = r3Room();
		// valid decrease
		const board = emptyMatrix();
		board[0] = [1, 1, 0, 0, 0, 0, 0];
		const res = applySubmitTable(room, 1, board, { seal: true });
		expect(res.ok).toBe(true);
		expect(res.sealed).toBe(true);
		expect(room.tables[0].lockedThisRound).toBe(true);
	});

	it('rejects wrong function seat', () => {
		const room = r3Room();
		// table 1 function seat is 0; seat 3 is wrong
		expect(applyBoardDelta(room, 1, 3, 0, -1)).toBe(false);
	});
});

describe('table wallet cap on the live path (G1) — $100M / chip values', () => {
	it('rejects a chip that would exceed the $100M wallet', () => {
		const room = makeRoom({ phase: 'round', round: 0 }); // R1, add round
		stakeTable1(room, [95, 0, 0, 0, 0, 0, 0]); // $95M placed
		expect(applyBoardDelta(room, 1, 0, 1, 10)).toBe(false); // +$10M red → $105M, reject
		expect(applyBoardDelta(room, 1, 0, 1, 5)).toBe(true); // +$5M blue → exactly $100M
		expect(applyBoardDelta(room, 1, 0, 2, 2)).toBe(false); // +$2M green → $102M, reject
		expect(room.tables[0].board[0][1]).toBe(5);
	});

	it('boardSet clamps so the board never exceeds the wallet', () => {
		const room = makeRoom({ phase: 'round', round: 0 });
		stakeTable1(room, [60, 0, 0, 0, 0, 0, 0]); // $60M placed, $40M left
		applyBoardSet(room, 1, 0, 1, 200); // ask for $200M on another cell
		expect(room.tables[0].board[0][1]).toBe(40); // clamped to remaining budget
	});

	it('rejects a NaN priority (G2)', () => {
		const room = makeRoom({ phase: 'round', round: 0 });
		expect(applyBoardDelta(room, 1, 0, Number('x'), 10)).toBe(false);
		expect(applyBoardSet(room, 1, 0, Number(undefined), 5)).toBe(false);
	});
});

describe('retreat prunes forward-round history (G3)', () => {
	it('drops snapshots for rounds stepped back past', () => {
		const room = makeRoom({ phase: 'reveal', round: ROUND_COUNT - 1 });
		room.history = [0, 1, 2, 3, 4].map((r) => ({ round: r }) as unknown as RoundSnapshot);
		applyRetreat(room); // reveal → R5 (round 4), keeps 0..4
		expect(room.history.map((h) => h.round)).toEqual([0, 1, 2, 3, 4]);
		applyRetreat(room); // R5 → R4 (round 3), drops round 4
		expect(room.history.map((h) => h.round)).toEqual([0, 1, 2, 3]);
	});
});

describe('alignment index denominator (A1)', () => {
	it('a unanimous room scores near 100, not throttled to ~14', () => {
		const room = makeRoom({ phase: 'round', round: 0 });
		// every table's function seat puts all its tokens on the same priority
		room.tables.forEach((t, i) => {
			const row = Array(N_PRIORITIES).fill(0);
			row[3] = 5;
			t.board[i] = row;
			recomputeTable(t);
		});
		const agg = aggregate(room.tables, personaBiasList());
		expect(agg.alignmentIndex).toBe(100);
	});

	it('a fully-split room scores low', () => {
		const room = makeRoom({ phase: 'round', round: 0 });
		room.tables.forEach((t, i) => {
			const row = Array(N_PRIORITIES).fill(0);
			row[i % N_PRIORITIES] = 5; // each table a different priority
			t.board[i] = row;
			recomputeTable(t);
		});
		const agg = aggregate(room.tables, personaBiasList());
		expect(agg.alignmentIndex).toBeLessThan(30);
	});
});

describe('ground-up lenses', () => {
	const mkMatrixReach = (fns: number[][]) => {
		const matrix = Array(N_PRIORITIES).fill(0);
		const reach = Array(N_PRIORITIES).fill(0);
		for (const v of fns) for (let i = 0; i < N_PRIORITIES; i++) {
			matrix[i] += v[i];
			if (v[i] > 0) reach[i] += 1;
		}
		return { matrix: matrix as Vec7, reach: reach as Vec7 };
	};

	it('lead = broadly backed; fault = the narrowly-heavy divide (max variance, not the lead)', () => {
		const fns = [
			[30, 0, 0, 0, 0, 40, 0],
			[30, 0, 0, 0, 0, 40, 0],
			[30, 0, 0, 0, 0, 0, 0],
			[30, 0, 0, 0, 0, 0, 0]
		] as unknown as Vec7[];
		const { matrix, reach } = mkMatrixReach(fns as unknown as number[][]);
		const v = verdicts(matrix, reach, fns);
		expect(v.alignment).toBe(0); // priority 0 backed by all four
		expect(v.fault).toBe(5); // priority 5: two heavy, two zero → the split
	});

	it('surprise fires only when a function goes ≥25% off its bias', () => {
		const bias = [
			[3, 3, 3, 0, 0, 0, 0],
			[0, 0, 0, 3, 3, 3, 3]
		] as unknown as Vec7[];
		// on-type: every function funds only its high-bias priorities → no surprise
		const onType = [
			[40, 30, 30, 0, 0, 0, 0],
			[0, 0, 0, 25, 25, 25, 25]
		] as unknown as Vec7[];
		expect(surpriseToken(onType, bias)).toBeUndefined();
		// f0 dumps 50% on priority 5 (its bias there is 0) → surprise
		const offType = [
			[20, 20, 10, 0, 0, 50, 0],
			[0, 0, 0, 25, 25, 25, 25]
		] as unknown as Vec7[];
		expect(surpriseToken(offType, bias)).toEqual({ seat: 0, priority: 5 });
	});
});
