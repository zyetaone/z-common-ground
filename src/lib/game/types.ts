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
	/** Has this table joined? (lobby presence — player taps "Join"). */
	joined: boolean;
		/** Player tapped "Freeze" — physical tokens are placed, ready to match digital. */
		physicallyDone: boolean;
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

/** Host photo archive entry — live URLs move here when cleared. */
export interface ArchivedImage {
	url: string;
	label: string;
	/** room = finale; table = per-function render */
	kind: 'room' | 'table';
	tableId?: number;
	archivedAt: number;
	/** YYYY-MM-DD session day (SSOT for host archive grouping). */
	sessionDate: string;
	/**
	 * One archive batch (e.g. LIVE-2026-07-31-143022).
	 * Same id = same “Archive & clear” action. Sort/group by this when present.
	 */
	sessionId?: string;
}

/** Architectural sheet generated from brief + concept reference images. */
export type WorkspaceDesignKind =
	| 'collage'
	| 'plan'
	| 'section'
	| 'elevation'
	| 'concept';

export interface WorkspaceDesignSheet {
	kind: WorkspaceDesignKind;
	label: string;
	url: string;
	/** Prompt used (for regen / audit). */
	prompt?: string;
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
	/** Primary Common Ground room concept (latest / selected). */
	finaleImageUrl?: string;
	/**
	 * Palette of Common Ground room concept variants (Look page +/−).
	 * Feeds workspace design refs. Includes finaleImageUrl when set.
	 */
	roomConceptUrls?: string[];
	/**
	 * Cleared AI photos land here so host can still save/download them.
	 * Survives clear-photos and session reset (capped in store).
	 */
	imageArchive?: ArchivedImage[];
	/**
	 * Architectural workspace designs generated from brief + reference drawings.
	 * Plans, sections, elevations, central collage — after "Generate workspace design".
	 */
	workspaceDesigns?: WorkspaceDesignSheet[];
	/** Openable brief (numbers skeleton or RapidI narrative). */
	briefSource?: 'numbers' | 'rapidi' | 'manual';
	enhancedBrief?: string;
	updatedAt: number;
	/** Host-editable runtime overrides for scenarios (R1–R5). Falls back to config.ts defaults. */
	scenarios?: Scenario[];
	/** Host-editable runtime overrides for personas. Falls back to config.ts defaults. */
	personas?: Persona[];
	/**
	 * Host-editable priority labels (length 7). Board options + analysis names.
	 * Falls back to PRIORITIES when missing/empty slot.
	 */
	priorities?: string[];
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
	/** Single-word brand hashtag for the persona. Format: #PascalCase, ≤18 chars (excl. #). */
	hashtag?: string;
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
	/** Mechanical constraints — what the game enforces (cap, direction, freeze requirement). */
	modelRules?: string;
	/** Step-by-step physical+digital flow for this round (numbered). */
	actions?: string;
	/** Facilitator narrative — "why this round matters" — read aloud by presenter. */
	experience?: string;
}

/**
 * Board cells store VALUE in $M (base unit = $1,000,000).
 * Physical chip is a single $10M denomination (CHIP_VALUE). Table wallet $100M; room $700M.
 * Budget arc: R2 full 100 → R3 remove 30 → R4 +20 → R5 restructure cap 90 (see config).
 */
export const TOKEN_VALUE_USD = 1_000_000;
