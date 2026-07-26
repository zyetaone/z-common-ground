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
		t.submittedSeats = Array(N_SEATS).fill(false);
	}
	room.analysisForced = false;
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
		captured = isCaptureRound(leavingLabel);
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
