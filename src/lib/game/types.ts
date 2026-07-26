// ── Common Ground Phygital — table SPOC board + live analysis ──

export const PRIORITIES = [
	'Talent',
	'Employee Experience',
	'Employer Brand',
	'Productivity',
	'Innovation',
	'Cost / ROI',
	'Future Readiness'
] as const;
export type Priority = (typeof PRIORITIES)[number];
export const N_PRIORITIES = 7;

export type Vec7 = number[];
export type Matrix7x7 = Vec7[];

export type Phase = 'lobby' | 'round' | 'reveal' | 'finale';

export interface TableState {
	id: number;
	board: Matrix7x7;
	/** Whole-table lock (host). */
	lockedThisRound: boolean;
	/** Per-seat submit this round (index = seat 0..6). */
	submittedSeats: boolean[];
	/** This function's priority vector = board[functionSeat]. */
	matrix: Vec7;
	reach: Vec7;
	commonGround: number;
	/** fal render for this function table (mobile / analysis). */
	imageUrl?: string;
}

export interface Aggregate {
	matrix: Vec7;
	reach: Vec7;
	alignmentIndex: number;
	alignment: number;
	fault: number;
	blind: number;
	surprise?: { seat: number; priority: number };
	totalCoins: number;
	tableCount: number;
}

/** Frozen room state after a round (for evolution charts). */
export interface RoundSnapshot {
	/** 0-based round index. */
	round: number;
	/** 1-based label (R1…R5). */
	roundLabel: number;
	matrix: Vec7;
	/** Seat×priority totals across all tables. */
	portrait: Matrix7x7;
	alignmentIndex: number;
	alignment: number;
	fault: number;
	blind: number;
	surprise?: { seat: number; priority: number };
	totalCoins: number;
}

export interface RoomState {
	code: string;
	phase: Phase;
	round: number;
	roundCount: number;
	tables: TableState[];
	aggregate: Aggregate;
	/** Snapshots keyed by round index — updated live during the round, frozen on advance. */
	history: RoundSnapshot[];
	/** 1-based rounds featured on the evolution screen. */
	evolutionRounds: number[];
	analysisForced: boolean;
	analysisOpen: boolean;
	lockedThisRound: number;
	expectedLocks: number;
	/** Max tokens for the whole room (split across tables). */
	roomBountyTokens: number;
	/** floor(roomBountyTokens / tables) — max per table. */
	tableBountyTokens: number;
	finaleImageUrl?: string;
	/** Openable brief (numbers skeleton or Llama narrative). */
	enhancedBrief?: string;
	/** How enhancedBrief was produced. */
	briefSource?: 'numbers' | 'llama';
	updatedAt: number;
}

export interface Persona {
	seat: number;
	name: string;
	lens: string;
	color: string;
	bias: Vec7;
	mission: string;
	strength?: string;
	risk?: string;
}

/**
 * Board is cumulative across R1–R5 (physical tokens stay).
 * Each round is mostly add or remove on that standing.
 */
export type RoundMove = 'add' | 'remove';

export type RoundMode =
	/** R1 — first placement; wait for presenter → R2. */
	| 'wait'
	/** R2 / R3 / R5 — freeze cumulative total for analysis. */
	| 'capture'
	/** R4 — hold path to final capture. */
	| 'hold';

export interface Scenario {
	/** 0-based index. */
	round: number;
	/** 1-based label R1…R5. */
	roundLabel: number;
	title: string;
	emoji: string;
	question: string;
	hint: string;
	/** Flow role for this round. */
	mode: RoundMode;
	/** Dominant physical move this round (board still cumulative). */
	move: RoundMove;
	/** Short instruction shown on mobile + presenter. */
	instruction: string;
}

/**
 * Board cells store VALUE in $M (base unit = $1,000,000).
 * Physical chips: 🔴 $10M · 🔵 $5M · 🟢 $2M (Option D — 6 red + 4 blue + 10 green = $100M/table).
 * Per-table wallet = $100M (value 100); room = $700M (value 700).
 * Each function spends their $100M budget to find Common Ground across the room.
 */
export const TOKEN_VALUE_USD = 1_000_000;
