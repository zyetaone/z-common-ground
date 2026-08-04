/**
 * Two pure functions the deck leans on that had no direct coverage.
 *
 * priorityMix drives every percentage the room sees. It uses largest-remainder
 * rounding, so the failure mode is subtle: shares that sum to 99 or 101 and a
 * "100% of room" table that visibly doesn't add up.
 *
 * upsertHistory is the integrity point for the whole evolution screen — it has
 * to upsert rather than append, or a re-advance would double a round and the
 * phase bars would read from a stale duplicate.
 */
import { describe, expect, it } from 'vitest';
import { priorityMix } from '$lib/game/brief';
import { upsertHistory } from '$lib/game/scoring';
import type { RoomState, RoundSnapshot } from '$lib/game/types';

describe('priorityMix', () => {
	it('sums to exactly 100 for an even split that does not divide cleanly', () => {
		// 7 equal shares = 14.285…% each. Naive rounding gives 7×14 = 98.
		const mix = priorityMix([10, 10, 10, 10, 10, 10, 10]);
		expect(mix.reduce((s, m) => s + m.pct, 0)).toBe(100);
	});

	it('sums to 100 across many awkward distributions', () => {
		const cases = [
			[30, 10, 10, 10, 10, 10, 10],
			[1, 1, 1, 1, 1, 1, 1],
			[3, 3, 3, 0, 0, 0, 1],
			[90, 10, 0, 0, 0, 0, 0],
			[110, 110, 100, 90, 80, 80, 60], // the live room
			[1, 2, 3, 4, 5, 6, 7]
		];
		for (const c of cases) {
			const total = priorityMix(c).reduce((s, m) => s + m.pct, 0);
			expect(total, `mix of ${c.join(',')} summed to ${total}`).toBe(100);
		}
	});

	it('gives every priority 0% when nothing is staked', () => {
		const mix = priorityMix([0, 0, 0, 0, 0, 0, 0]);
		expect(mix).toHaveLength(7);
		expect(mix.every((m) => m.pct === 0)).toBe(true);
	});

	it('never invents a share for an unfunded priority', () => {
		// A 0-token priority must read 0%, even when remainders are being
		// distributed — handing it a rounding point would claim money that
		// was never placed.
		const mix = priorityMix([10, 10, 10, 0, 0, 0, 0]);
		const unfunded = mix.filter((m) => m.tokens === 0);
		expect(unfunded).toHaveLength(4);
		expect(unfunded.every((m) => m.pct === 0)).toBe(true);
	});

	it('ranks the largest stake first', () => {
		const mix = priorityMix([10, 50, 20, 0, 0, 0, 0]);
		expect(mix[0].tokens).toBe(50);
	});
});

/** Minimal room shaped like the real one, enough for upsertHistory. */
function roomAt(phase: RoomState['phase'], round: number, history: RoundSnapshot[] = []) {
	return {
		phase,
		round,
		history,
		tables: [],
		aggregate: {
			matrix: [0, 0, 0, 0, 0, 0, 0],
			reach: [0, 0, 0, 0, 0, 0, 0],
			alignmentIndex: 0,
			alignment: 0,
			fault: 0,
			blind: 0,
			totalCoins: 0,
			tableCount: 0
		}
	} as unknown as RoomState;
}

describe('upsertHistory', () => {
	it('records nothing during lobby', () => {
		const room = roomAt('lobby', 0);
		upsertHistory(room);
		expect(room.history).toHaveLength(0);
	});

	it('replaces the snapshot for a round instead of appending a duplicate', () => {
		// The evolution screen reads one row per phase. Appending on a re-advance
		// would leave two entries for the same round and the bars would render
		// from whichever landed first.
		const room = roomAt('round', 2);
		upsertHistory(room);
		upsertHistory(room);
		upsertHistory(room);
		expect(room.history).toHaveLength(1);
		expect(room.history[0].round).toBe(2);
	});

	it('keeps history sorted by round however it is written', () => {
		const room = roomAt('round', 4);
		upsertHistory(room);
		room.round = 1;
		upsertHistory(room);
		room.round = 3;
		upsertHistory(room);
		expect(room.history.map((h) => h.round)).toEqual([1, 3, 4]);
	});

	it('still records at reveal and finale', () => {
		for (const phase of ['reveal', 'finale'] as const) {
			const room = roomAt(phase, 4);
			upsertHistory(room);
			expect(room.history, `${phase} should record`).toHaveLength(1);
		}
	});
});
