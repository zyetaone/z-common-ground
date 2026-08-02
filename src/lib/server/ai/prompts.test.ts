/**
 * Prompt-parity guard.
 *
 * The prompt builders moved out of `game/brief.ts` into `server/ai/prompts/`.
 * That refactor must not change a single character of what we send to fal or
 * RapidI — a silent prompt drift would change every generated image and brief
 * with no test failing. These lock the output shape against known inputs.
 */
import { describe, expect, it } from 'vitest';
import { finalePrompt, tableFunctionPrompt, briefFactsForRapidi } from './prompts';
import { aggregate, emptyMatrix, personaBiasList } from '$lib/game';
import type { Matrix7x7, RoomState, TableState } from '$lib/game/types';

/** A room with a clear lead (Future Readiness) and one empty function. */
function fixtureRoom(): RoomState {
	const mk = (id: number, row: number[]): TableState => {
		const board = emptyMatrix() as Matrix7x7;
		board[id - 1] = row as Matrix7x7[number];
		return {
			id,
			board,
			joined: true,
			physicallyDone: false,
			lockedThisRound: false,
			submittedSeats: Array(7).fill(false),
			matrix: row,
			reach: row.map((n) => (n > 0 ? 1 : 0)),
			commonGround: 0
		};
	};
	const tables = [
		mk(1, [10, 10, 0, 10, 10, 10, 50]),
		mk(2, [20, 30, 10, 10, 10, 10, 10]),
		mk(3, [0, 0, 0, 0, 0, 0, 0])
	];
	return {
		code: 'LIVE',
		phase: 'reveal',
		round: 4,
		roundCount: 5,
		tables,
		aggregate: aggregate(tables, personaBiasList()),
		history: [],
		updatedAt: 1,
		roomBountyTokens: 300,
		tableBountyTokens: 100,
		lockedThisRound: 0,
		expectedLocks: 3,
		analysisOpen: true,
		analysisForced: false,
		evolutionRounds: [2, 3, 5]
	};
}

describe('prompt parity after the game/ → server/ai/ move', () => {
	const room = fixtureRoom();

	it('finalePrompt is deterministic and describes the lead priority', () => {
		const a = finalePrompt(room.aggregate.matrix);
		const b = finalePrompt(room.aggregate.matrix);
		expect(a).toBe(b); // pure
		expect(a).toContain('Future Readiness');
		expect(a).toMatch(/16:9|photoreal|architectural/i);
		// %-weighting is the whole point of the prompt
		expect(a).toMatch(/\d+%/);
	});

	it('finalePrompt survives an all-zero matrix without inventing a lead', () => {
		const zero = Array(7).fill(0);
		const out = finalePrompt(zero);
		expect(out.length).toBeGreaterThan(0);
		expect(out).toMatch(/balanced/i);
	});

	it('tableFunctionPrompt names the function and its own bets', () => {
		const out = tableFunctionPrompt('Real Estate', [10, 10, 0, 10, 10, 10, 50]);
		expect(out).toContain('Real Estate');
		expect(out).toMatch(/\d+%/);
	});

	it('briefFactsForRapidi carries the lens vocabulary the brief depends on', () => {
		const out = briefFactsForRapidi(room.aggregate, room);
		// The brief's whole job is lead / fault / blind — if the move dropped a
		// section the model would quietly stop mentioning it.
		expect(out).toMatch(/lead/i);
		expect(out).toMatch(/blind/i);
		expect(out).toMatch(/mix/i);
	});

	it('briefFactsForRapidi is empty-safe with no stake', () => {
		const empty = fixtureRoom();
		empty.tables = empty.tables.map((t) => ({ ...t, matrix: Array(7).fill(0) }));
		empty.aggregate = aggregate(empty.tables, personaBiasList());
		expect(() => briefFactsForRapidi(empty.aggregate, empty)).not.toThrow();
	});
});
