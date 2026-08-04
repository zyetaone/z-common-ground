/**
 * Room fixtures for the rules tests. Extracted so the seal-flow test plays a
 * session against the same shape rules.test.ts asserts against, rather than
 * keeping a second copy that could drift from it.
 *
 * Not a `.test.ts` file so vitest treats it as a helper, and nothing in the app
 * imports it, so it never reaches the bundle.
 */
import {
	DEFAULT_ROOM_BOUNTY_TOKENS,
	DEFAULT_TABLE_COUNT,
	N_PRIORITIES,
	N_SEATS,
	ROUND_COUNT,
	emptyMatrix
} from '$lib/game';
import type { RoomState, TableState } from '$lib/game/types';

export function emptyTable(id: number): TableState {
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

export function makeRoom(partial?: Partial<RoomState>): RoomState {
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
