/**
 * Pure phase machine — mutates room in place (caller recompute + persist).
 * Single LIVE game: lobby → R1–R5 → reveal → finale.
 */
import { N_SEATS, ROUND_COUNT, isCaptureRound } from '../config';
import { upsertHistory } from '../scoring';
import type { Phase, RoomState } from '../types';

export function reopenBoards(room: RoomState): void {
	for (const t of room.tables) {
		t.lockedThisRound = false;
		t.physicallyDone = false;
		t.submittedSeats = Array(N_SEATS).fill(false);
	}
	room.analysisForced = false;
}

/** The clock position a caller believed the room was on when it asked to move. */
export type StepFrom = { phase?: string; round?: number } | undefined;

/**
 * Does the caller's view of the clock still match the room?
 *
 * This is the replay guard for advance/retreat. The client retries once on
 * network failure with the same Idempotency-Key, but the room body is ~10KB
 * and the idempotency cache refuses anything over 2KB — so a lost response
 * would re-execute the step and move the room TWO rounds. A mismatch means
 * something already moved it (usually the first attempt, which did land), so
 * the retry must not move it again.
 *
 * An absent `from` opts out — older clients and manual calls still work.
 */
export function stepIsCurrent(cur: Pick<RoomState, 'phase' | 'round'>, from: StepFrom): boolean {
	if (!from) return true;
	return cur.phase === from.phase && cur.round === from.round;
}

export type AdvanceResult = {
	phase: Phase;
	round: number;
	boardsOpened: boolean;
	captured: boolean;
};

/** Advance clock. Boards never wiped. */
export function applyAdvance(room: RoomState): AdvanceResult {
	let boardsOpened = false;
	let captured = false;

	if (room.phase === 'lobby') {
		room.phase = 'round';
		room.round = 0;
		reopenBoards(room);
		boardsOpened = true;
	} else if (room.phase === 'round') {
		const leavingLabel = room.round + 1;
		upsertHistory(room);
		captured = isCaptureRound(leavingLabel, room);
		reopenBoards(room);
		boardsOpened = true;
		if (room.round < ROUND_COUNT - 1) {
			room.round += 1;
		} else {
			room.phase = 'reveal';
		}
	} else if (room.phase === 'reveal') {
		room.phase = 'finale';
	}

	return {
		phase: room.phase,
		round: room.round,
		boardsOpened,
		captured
	};
}

export type RetreatResult = {
	phase: Phase;
	round: number;
	boardsOpened: boolean;
};

/** Presenter correction — step back; reopen seals; chips stay. */
export function applyRetreat(room: RoomState): RetreatResult {
	let boardsOpened = false;

	if (room.phase === 'finale') {
		room.phase = 'reveal';
	} else if (room.phase === 'reveal') {
		room.phase = 'round';
		room.round = ROUND_COUNT - 1;
		reopenBoards(room);
		boardsOpened = true;
	} else if (room.phase === 'round') {
		if (room.round > 0) {
			room.round -= 1;
		} else {
			room.phase = 'lobby';
			room.round = 0;
		}
		reopenBoards(room);
		boardsOpened = true;
	}
	// lobby: no-op

	// Drop snapshots for rounds we've stepped back past, so the evolution/reveal
	// screens never show data for a round that hasn't been re-played yet.
	room.history = room.history.filter((h) => h.round <= room.round);

	return {
		phase: room.phase,
		round: room.round,
		boardsOpened
	};
}
