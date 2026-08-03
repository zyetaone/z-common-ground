/**
 * Unit tests — pure phase + board rules (no Worker / Svelte).
 */
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_ROOM_BOUNTY_TOKENS,
	DEFAULT_TABLE_COUNT,
	MAX_WALLET_TOKENS,
	N_PRIORITIES,
	N_SEATS,
	PRIORITIES,
	ROUND_COUNT,
	SCENARIOS,
	roomScenarios,
	tableBountyTokens,
	aggregate,
	badgeForTable,
	emptyMatrix,
	personaBiasList,
	recomputeTable,
	allocateWeightedChips,
	functionProfile,
	roomRoundStory,
	surpriseToken,
	verdicts
} from '$lib/game';
import type { Matrix7x7, RoomState, RoundSnapshot, TableState, Vec7 } from '$lib/game/types';
import {
	activeTableCap,
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
		joined: false,
		physicallyDone: false,
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
	/** Standing $100M after R2 — R3 must cut $30M. */
	function r3Room(): RoomState {
		const room = makeRoom({ phase: 'round', round: 2 });
		stakeTable1(room, [40, 20, 20, 10, 10, 0, 0]);
		return room;
	}

	it('isRemoveRound true only on R3', () => {
		expect(isRemoveRound(makeRoom({ phase: 'round', round: 2 }))).toBe(true);
		expect(isRemoveRound(makeRoom({ phase: 'round', round: 1 }))).toBe(false);
	});

	it('isRemoveRound respects host scenario move override', () => {
		const room = makeRoom({ phase: 'round', round: 1 }); // default R2 = add
		room.scenarios = [];
		room.scenarios[1] = {
			round: 1,
			roundLabel: 2,
			title: 'R2 override',
			emoji: 'x',
			question: 'q',
			hint: 'h',
			mode: 'capture',
			move: 'remove',
			instruction: 'i'
		};
		expect(isRemoveRound(room)).toBe(true);
	});

	it('rejects positive delta on R3', () => {
		const room = r3Room();
		const ok = applyBoardDelta(room, 1, 0, 0, 10);
		expect(ok).toBe(false);
		expect(room.tables[0].board[0][0]).toBe(40);
	});

	it('allows subtract on R3', () => {
		const room = r3Room();
		const ok = applyBoardDelta(room, 1, 0, 0, -10);
		expect(ok).toBe(true);
		expect(room.tables[0].board[0][0]).toBe(30);
	});

	it('clamps boardSet above standing on R3', () => {
		const room = r3Room();
		const ok = applyBoardSet(room, 1, 0, 0, 99);
		expect(ok).toBe(true);
		expect(room.tables[0].board[0][0]).toBe(40); // clamped to standing
	});

	it('submit clamps increases vs standing then requires $30M cut', () => {
		const room = r3Room();
		const board = emptyMatrix();
		// tried to raise pri 0; clamp keeps 40; total still 100 → fail remove target
		board[0] = [50, 20, 20, 10, 10, 0, 0];
		const res = applySubmitTable(room, 1, board, { seal: true });
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error).toMatch(/removing \$30M/i);
	});

	it('submit seals when $30M removed (leave $70M)', () => {
		const room = r3Room();
		const board = emptyMatrix();
		board[0] = [30, 20, 10, 10, 0, 0, 0]; // 70 left, removed 30
		const res = applySubmitTable(room, 1, board, { seal: true });
		expect(res.ok).toBe(true);
		expect(res.sealed).toBe(true);
		expect(room.tables[0].lockedThisRound).toBe(true);
	});

	it('rejects wrong function seat', () => {
		const room = r3Room();
		expect(applyBoardDelta(room, 1, 3, 0, -10)).toBe(false);
	});
});

describe('R2 full budget seal', () => {
	it('rejects seal when total is not $100M', () => {
		const room = makeRoom({ phase: 'round', round: 1 });
		stakeTable1(room, [30, 20, 0, 0, 0, 0, 0]);
		const board = emptyMatrix();
		board[0] = [30, 20, 0, 0, 0, 0, 0];
		const res = applySubmitTable(room, 1, board, { seal: true });
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.error).toMatch(/full \$100M/i);
	});

	it('accepts seal at exactly $100M', () => {
		const room = makeRoom({ phase: 'round', round: 1 });
		stakeTable1(room, [40, 20, 20, 10, 10, 0, 0]);
		const board = emptyMatrix();
		board[0] = [40, 20, 20, 10, 10, 0, 0];
		const res = applySubmitTable(room, 1, board, { seal: true });
		expect(res.ok).toBe(true);
		expect(res.sealed).toBe(true);
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

	it('does not call a consensus priority a surprise', () => {
		// Regression: surpriseToken only looked at the individual persona's bias,
		// never at whether the rest of the room had funded the same priority. In a
		// real seeded session that made the deck contradict itself — screen 1 said
		// "Surprise: Real Estate leaned into Employee Experience" while screen 5
		// called Real Estate the most-aligned ally, on the priority all 7 functions
		// backed and the room's own lead.
		const bias = [
			[3, 0, 3, 0, 0, 0, 0], // f0: low bias on priority 1
			[3, 0, 3, 0, 0, 0, 0],
			[3, 0, 3, 0, 0, 0, 0],
			[3, 0, 3, 0, 0, 0, 0]
		] as unknown as Vec7[];
		// Every function puts most of its money on priority 1 — a room consensus.
		const consensusVectors = [
			[10, 60, 10, 0, 0, 0, 0],
			[10, 60, 10, 0, 0, 0, 0],
			[10, 60, 10, 0, 0, 0, 0],
			[10, 60, 10, 0, 0, 0, 0]
		] as unknown as Vec7[];
		const reach = [4, 4, 4, 0, 0, 0, 0] as unknown as Vec7;

		// Without reach the old rule flags one of them purely on persona bias.
		expect(surpriseToken(consensusVectors, bias)).toEqual({ seat: 0, priority: 1 });
		// With reach, a priority the whole room funded is not a surprise.
		expect(surpriseToken(consensusVectors, bias, reach)).toBeUndefined();
	});

	it('still flags a genuine outlier when the room did not follow', () => {
		const bias = [
			[3, 0, 3, 0, 0, 0, 0],
			[3, 3, 3, 0, 0, 0, 0],
			[3, 3, 3, 0, 0, 0, 0],
			[3, 3, 3, 0, 0, 0, 0]
		] as unknown as Vec7[];
		// Only f0 backs priority 5, and it is off-type for them.
		const vectors = [
			[20, 20, 10, 0, 0, 50, 0],
			[40, 30, 30, 0, 0, 0, 0],
			[40, 30, 30, 0, 0, 0, 0],
			[40, 30, 30, 0, 0, 0, 0]
		] as unknown as Vec7[];
		const reach = [4, 4, 4, 0, 0, 1, 0] as unknown as Vec7;
		expect(surpriseToken(vectors, bias, reach)).toEqual({ seat: 0, priority: 5 });
	});
});

describe('roomRoundStory — assumed / protected / reprioritised', () => {
	function snap(
		roundLabel: number,
		matrix: number[],
		alignment: number,
		cgi = 50
	): RoundSnapshot {
		return {
			round: roundLabel - 1,
			roundLabel,
			matrix: matrix as Vec7,
			portrait: emptyMatrix() as unknown as RoundSnapshot['portrait'],
			alignmentIndex: cgi,
			alignment,
			fault: 1,
			blind: 6,
			totalCoins: matrix.reduce((a, b) => a + b, 0)
		};
	}

	it('is empty until there is stake history', () => {
		const room = makeRoom({ phase: 'lobby' });
		const s = roomRoundStory(room);
		expect(s.ready).toBe(false);
		expect(s.assumed).toBeNull();
		expect(s.protected).toEqual([]);
	});

	it('reads assumed from R2 lead and protected/cut from R2→R3 share shift', () => {
		// R2: heavy on p0 (assumed) and p5
		// R3: cut p5 hard, hold p0 (protected)
		const r2 = [40, 10, 10, 10, 10, 40, 10];
		const r3 = [35, 8, 8, 8, 8, 5, 8]; // total 80 — p0 held, p5 crushed
		const room = makeRoom({
			phase: 'round',
			round: 3,
			history: [
				snap(2, r2, 0, 40),
				snap(3, r3, 0, 55)
			]
		});
		const s = roomRoundStory(room);
		expect(s.ready).toBe(true);
		expect(s.assumed?.round).toBe(2);
		expect(s.assumed?.name).toBeTruthy();
		expect(s.protected.some((p) => p.priority === 0)).toBe(true);
		expect(s.cut.some((p) => p.priority === 5)).toBe(true);
		expect(s.headline.length).toBeGreaterThan(10);
	});

	it('flags reprioritised gains from R3 → R5', () => {
		const r2 = [30, 20, 10, 10, 10, 10, 10];
		const r3 = [25, 15, 8, 8, 8, 8, 8];
		const r5 = [15, 10, 8, 8, 8, 8, 40]; // p6 rebuilt hard
		const room = makeRoom({
			phase: 'reveal',
			round: 4,
			history: [snap(2, r2, 0, 40), snap(3, r3, 0, 50), snap(5, r5, 6, 62)]
		});
		const s = roomRoundStory(room);
		expect(s.reprioritised.some((p) => p.priority === 6 && p.deltaPts > 0)).toBe(true);
	});
});

describe('emulate allocateWeightedChips', () => {
	// Backs the host console's "Emulate all tables" button. The allocator is
	// largest-remainder: floor every weighted share, then hand the leftover
	// chips to the biggest fractions. Both invariants below are easy to break
	// in a refactor and silently produce off-budget demo boards.
	it('sums exactly to target total', () => {
		const row = allocateWeightedChips([3, 1, 0, 1, 2, 0, 1], 100, 42);
		expect(row.reduce((a, b) => a + b, 0)).toBe(100);
		expect(row.every((v) => v % 10 === 0)).toBe(true);
	});

	it('hits the total across many seeds and budgets', () => {
		// The remainder loop is where an off-by-one hides — one seed can pass by
		// luck when the shares happen to floor evenly.
		for (const total of [10, 50, 100, 250, 700]) {
			for (let seed = 0; seed < 25; seed++) {
				const row = allocateWeightedChips([3, 1, 0, 1, 2, 0, 1], total, seed);
				expect(row.reduce((a, b) => a + b, 0)).toBe(total);
			}
		}
	});

	it('never allocates a negative or non-chip amount', () => {
		const row = allocateWeightedChips([0, 0, 0, 0, 0, 0, 0], 100, 7);
		expect(row.every((v) => v >= 0 && v % 10 === 0)).toBe(true);
		expect(row.reduce((a, b) => a + b, 0)).toBe(100);
	});

	it('returns an empty row for a zero budget', () => {
		expect(allocateWeightedChips([3, 1, 0, 1, 2, 0, 1], 0, 1)).toEqual([0, 0, 0, 0, 0, 0, 0]);
	});

	it('is deterministic for a given seed', () => {
		// The host may re-run Emulate; same seed must reproduce the same board.
		const a = allocateWeightedChips([3, 1, 0, 1, 2, 0, 1], 100, 99);
		const b = allocateWeightedChips([3, 1, 0, 1, 2, 0, 1], 100, 99);
		expect(a).toEqual(b);
	});
});

describe('functionProfile — personality scan from choices', () => {
	it('scores conviction and prefers from the table mix', () => {
		const room = makeRoom({ phase: 'round', round: 1 });
		// Table 1 (Real Estate): heavy innovation + future
		stakeTable1(room, [0, 0, 0, 10, 50, 10, 30]);
		recomputeTable(room.tables[0], room.aggregate.matrix);
		// need matrix on table — recomputeTable sets matrix from board
		const p = functionProfile(room, 1);
		expect(p).not.toBeNull();
		expect(p!.total).toBe(100);
		expect(p!.prefers[0]?.name).toBeTruthy();
		expect(p!.traits.find((t) => t.id === 'sure')?.score).toBeGreaterThanOrEqual(40);
		expect(p!.traits.find((t) => t.id === 'innovative')?.score).toBe(50);
		expect(p!.tags.length).toBeGreaterThan(0);
		expect(p!.headline.length).toBeGreaterThan(10);
		expect(p!.archetype.length).toBeGreaterThan(0);
	});
});

describe('budget-scaled seal targets (host-editable room budget)', () => {
	/** roomBountyTokens 210 → per-table wallet floor(210/7) = $30M. */
	function smallRoom(round: number): RoomState {
		return makeRoom({ phase: 'round', round, roomBountyTokens: 210 });
	}

	it('R2 seals at the reduced wallet ($30M), not the $100M default', () => {
		const room = smallRoom(1);
		stakeTable1(room, [20, 0, 0, 0, 0, 0, 0]);
		const short = emptyMatrix();
		short[0] = [20, 0, 0, 0, 0, 0, 0];
		const miss = applySubmitTable(room, 1, short, { seal: true });
		expect(miss.ok).toBe(false);
		if (!miss.ok) expect(miss.error).toMatch(/full \$30M/i);

		const full = emptyMatrix();
		full[0] = [10, 10, 10, 0, 0, 0, 0];
		const hit = applySubmitTable(room, 1, full, { seal: true });
		expect(hit.ok).toBe(true);
		expect(hit.sealed).toBe(true);
	});

	it('R3 seals at a 30% cut of the reduced standing ($9M of $30M)', () => {
		const room = smallRoom(2);
		stakeTable1(room, [10, 10, 10, 0, 0, 0, 0]); // standing $30M
		const lightCut = emptyMatrix();
		lightCut[0] = [10, 10, 2, 0, 0, 0, 0]; // removed $8M < ceil(30 × 0.3) = $9M
		const miss = applySubmitTable(room, 1, lightCut, { seal: true });
		expect(miss.ok).toBe(false);
		if (!miss.ok) expect(miss.error).toMatch(/removing \$9M/i);

		const fullCut = emptyMatrix();
		fullCut[0] = [10, 10, 1, 0, 0, 0, 0]; // removed exactly $9M
		const hit = applySubmitTable(room, 1, fullCut, { seal: true });
		expect(hit.ok).toBe(true);
		expect(hit.sealed).toBe(true);
	});

	it('R5 restructure cap scales to 90% of the wallet', () => {
		expect(activeTableCap(makeRoom({ phase: 'round', round: 4 }))).toBe(90); // default $100M wallet
		expect(activeTableCap(smallRoom(4))).toBe(27); // 90% of $30M

		const room = smallRoom(4);
		stakeTable1(room, [20, 0, 0, 0, 0, 0, 0]);
		expect(applyBoardDelta(room, 1, 0, 1, 10)).toBe(false); // 30 > 27 cap
		expect(applyBoardDelta(room, 1, 0, 1, 7)).toBe(true); // 27 = cap exactly
	});
});

describe('wallet ceiling (C1) — huge room budgets can never wedge the R2 seal', () => {
	it('wallet caps at 7 × 99 = 693 regardless of roomBountyTokens', () => {
		expect(MAX_WALLET_TOKENS).toBe(693);
		expect(tableBountyTokens(makeRoom({ roomBountyTokens: 9999 }))).toBe(693);
		expect(tableBountyTokens(makeRoom({ roomBountyTokens: 4851 }))).toBe(693);
		expect(tableBountyTokens(makeRoom({ roomBountyTokens: 700 }))).toBe(100); // default unchanged
	});

	it('R2 full-wallet seal stays reachable at the capped wallet', () => {
		const room = makeRoom({ phase: 'round', round: 1, roomBountyTokens: 9999 });
		const full = emptyMatrix();
		full[0] = [99, 99, 99, 99, 99, 99, 99]; // 693 = capped wallet exactly
		const hit = applySubmitTable(room, 1, full, { seal: true });
		expect(hit.ok).toBe(true);
		expect(hit.sealed).toBe(true);
	});

	it('applyBoardDelta clamps a cell at 99 (no silent submit truncation)', () => {
		const room = makeRoom({ phase: 'round', round: 1, roomBountyTokens: 9999 });
		for (let i = 0; i < 10; i++) applyBoardDelta(room, 1, 0, 0, 10); // wallet 693 — adds allowed
		expect(room.tables[0].board[0][0]).toBe(99);
	});
});

describe('badgeForTable — observed play from round history', () => {
	function snapWithPortrait(roundLabel: number, rows: number[][]): RoundSnapshot {
		const portrait = emptyMatrix() as Matrix7x7;
		rows.forEach((row, seat) => {
			if (row) portrait[seat] = row;
		});
		const matrix = Array(N_PRIORITIES).fill(0) as Vec7;
		for (const row of portrait) for (let i = 0; i < N_PRIORITIES; i++) matrix[i] += row[i] ?? 0;
		return {
			round: roundLabel - 1,
			roundLabel,
			matrix,
			portrait,
			alignmentIndex: 50,
			alignment: 0,
			fault: 1,
			blind: 6,
			totalCoins: matrix.reduce((a, b) => a + b, 0)
		};
	}

	it('names the priority the table held while the room cut it', () => {
		// R2: everyone splits 50/50 between p0 and p1.
		// R3: table 1 keeps p0 heavy; every other table cuts it hard.
		const r2rows = Array.from({ length: 7 }, () => [50, 50, 0, 0, 0, 0, 0]);
		const r3rows = Array.from({ length: 7 }, () => [10, 60, 0, 0, 0, 0, 0]);
		r3rows[0] = [50, 20, 0, 0, 0, 0, 0]; // table 1: p0 share 50% → 71%
		const room = makeRoom({
			phase: 'reveal',
			round: 4,
			history: [snapWithPortrait(2, r2rows), snapWithPortrait(3, r3rows)]
		});
		stakeTable1(room, [50, 20, 0, 0, 0, 0, 0]);
		recomputeTable(room.tables[0]);
		const badge = badgeForTable(room, 1);
		expect(badge.badge).toBe('Held ' + PRIORITIES[0]);
		expect(badge.badgePriority).toBe(0);
	});

	it('names the priority the table championed when nothing was protected', () => {
		// R3: the whole room (table 1 included) shifts toward p0, so no
		// priority satisfies "held while the room cut it".
		const r2rows = Array.from({ length: 7 }, () => [50, 50, 0, 0, 0, 0, 0]);
		const r3rows = Array.from({ length: 7 }, () => [60, 10, 0, 0, 0, 0, 0]);
		r3rows[0] = [50, 25, 0, 0, 0, 0, 0]; // p0 share grew — but the room's avg grew too
		const r5rows = Array.from({ length: 7 }, () => [60, 10, 0, 0, 0, 0, 0]);
		r5rows[0] = [10, 10, 80, 0, 0, 0, 0]; // table 1 rebuilt p2 hard
		const room = makeRoom({
			phase: 'finale',
			round: 4,
			history: [
				snapWithPortrait(2, r2rows),
				snapWithPortrait(3, r3rows),
				snapWithPortrait(5, r5rows)
			]
		});
		stakeTable1(room, [10, 10, 80, 0, 0, 0, 0]);
		recomputeTable(room.tables[0]);
		const badge = badgeForTable(room, 1);
		expect(badge.badge).toBe('Championed ' + PRIORITIES[2]);
		expect(badge.badgePriority).toBe(2);
	});

	it('falls back to the cumulative top priority before R3 history exists', () => {
		const room = makeRoom({ phase: 'round', round: 1 });
		stakeTable1(room, [40, 20, 20, 0, 0, 0, 0]);
		recomputeTable(room.tables[0]);
		const badge = badgeForTable(room, 1);
		expect(badge.badge).toBe('Held ' + PRIORITIES[0]);
		expect(badge.badgePriority).toBe(0);
		expect(badge.badgeShare).toBe(50);
	});
});

describe('scenario copy quotes the room wallet, not the $100M default', () => {
	// Regression: the phone showed "Physical board = full $100M" (static scenario
	// hint) directly above "Physical board - full $116M" (derived from state),
	// because roomBountyTokens is host-editable but the copy was hard-coded.
	it('rewrites the R2 hint to the actual per-table wallet', () => {
		const room = makeRoom({ tableBountyTokens: 116 });
		const r2 = roomScenarios(room)[1];
		expect(r2.hint).toContain('$116M');
		expect(r2.hint).not.toContain('$100M');
		expect(r2.modelRules).toContain('$116M');
	});

	it('leaves copy untouched at the default wallet', () => {
		const room = makeRoom({ tableBountyTokens: 100 });
		expect(roomScenarios(room)[1].hint).toBe(SCENARIOS[1].hint);
	});

	it('scales the R3 removal target with the wallet', () => {
		// 30% of a $50M wallet is $15M, not the default $30M.
		const room = makeRoom({ tableBountyTokens: 50 });
		const all = roomScenarios(room)
			.map((sc) => [sc.hint, sc.modelRules].filter(Boolean).join(' '))
			.join(' ');
		expect(all).not.toContain('$100M');
		expect(all).not.toContain('$30M');
	});

	it('preserves host-authored overrides', () => {
		const room = makeRoom({
			tableBountyTokens: 116,
			scenarios: [{ ...SCENARIOS[0], hint: 'Custom facilitator note' }] as never
		});
		expect(roomScenarios(room)[0].hint).toBe('Custom facilitator note');
	});
});
