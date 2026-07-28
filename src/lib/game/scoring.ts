/** Scoring — one function per table; the function's vector is its board row. */
import type { Aggregate, Matrix7x7, RoomState, RoundSnapshot, TableState, Vec7 } from './types';
import { N_PRIORITIES, PRIORITIES } from './types';
import { PERSONAS, tableSeatIndex } from './config';

export const zeros = (): Vec7 => Array(N_PRIORITIES).fill(0);
export const sum = (v: Vec7) => v.reduce((a, b) => a + b, 0);

export function emptyMatrix(): number[][] {
	return Array.from({ length: 7 }, () => Array(N_PRIORITIES).fill(0));
}

export function cloneMatrix(m: number[][]): number[][] {
	return m.map((row) => row.slice());
}

function cosine(a: Vec7, b: Vec7): number {
	const dot = a.reduce((s, x, i) => s + x * b[i], 0);
	const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
	const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
	if (na === 0 || nb === 0) return 0;
	return dot / (na * nb);
}

export function commonGround(tableMatrix: Vec7, roomMatrix: Vec7): number {
	return Math.round(100 * cosine(tableMatrix, roomMatrix));
}

/**
 * Common Ground Index [0–100]: mean pairwise cosine similarity between the
 * functions' priority vectors. 100 = every function bets the same shape;
 * 0 = every function bets on different priorities (no overlap).
 */
export function commonGroundIndex(functionVectors: Vec7[]): number {
	const active = functionVectors.filter((v) => sum(v) > 0);
	if (active.length < 2) return 0; // no common ground to measure with <2 voices
	let acc = 0;
	let pairs = 0;
	for (let a = 0; a < active.length; a++) {
		for (let b = a + 1; b < active.length; b++) {
			acc += cosine(active[a], active[b]);
			pairs++;
		}
	}
	return Math.round(100 * (acc / pairs));
}

/**
 * Named lenses derived from first principles:
 *  - lead  = the priority the most functions rallied behind (reach, tiebreak $).
 *  - fault = the priority with the greatest spread across functions — some fund
 *            it heavily, others ignore it (max variance = the real divide).
 *  - blind = the least-funded priority — what the room collectively overlooked.
 */
export function verdicts(
	matrix: Vec7,
	reach: Vec7,
	functionVectors: Vec7[]
): { alignment: number; fault: number; blind: number } {
	let alignment = 0;
	for (let i = 1; i < N_PRIORITIES; i++) {
		if (reach[i] > reach[alignment] || (reach[i] === reach[alignment] && matrix[i] > matrix[alignment]))
			alignment = i;
	}

	let blind = 0;
	for (let i = 1; i < N_PRIORITIES; i++) if (matrix[i] < matrix[blind]) blind = i;

	// Fault line = max variance of function investment on a priority.
	const active = functionVectors.filter((v) => sum(v) > 0);
	const n = Math.max(1, active.length);
	let fault = alignment;
	let faultVar = -1;
	for (let i = 0; i < N_PRIORITIES; i++) {
		if (i === alignment) continue; // the rally point can't also be the divide
		const vals = active.map((v) => v[i] ?? 0);
		const mean = vals.reduce((s, x) => s + x, 0) / n;
		const variance = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
		if (variance > faultVar) {
			faultVar = variance;
			fault = i;
		}
	}
	return { alignment, fault, blind };
}

/**
 * Surprise = a function that put a real chunk (≥25%) of its money on an
 * off-type (low-bias ≤1) priority. Returns undefined when nobody broke type —
 * "no surprise" is a valid, honest outcome.
 */
export function surpriseToken(
	functionVectors: Vec7[],
	personaBias: Vec7[]
): { seat: number; priority: number } | undefined {
	let best: { seat: number; priority: number; score: number; offBias: number; share: number } | undefined;
	for (let f = 0; f < functionVectors.length; f++) {
		const v = functionVectors[f];
		const tot = sum(v);
		if (tot <= 0) continue;
		const bias = personaBias[f] ?? zeros();
		for (let i = 0; i < N_PRIORITIES; i++) {
			if (v[i] <= 0) continue;
			const offBias = 3 - Math.min(3, bias[i]); // 3 = they'd normally ignore it
			const share = v[i] / tot;
			const score = share * offBias * v[i];
			if (!best || score > best.score) best = { seat: f, priority: i, score, offBias, share };
		}
	}
	// Only a surprise if it's genuinely off-type and a meaningful share of their money.
	if (!best || best.offBias < 2 || best.share < 0.25) return undefined;
	return { seat: best.seat, priority: best.priority };
}

export function aggregate(tables: TableState[], personaBias: Vec7[]): Aggregate {
	const matrix = zeros();
	const reach = zeros();
	// One function per table → t.matrix IS that function's priority vector.
	const functionVectors = tables.map((t) => t.matrix.slice() as Vec7);
	for (const t of tables) {
		for (let i = 0; i < N_PRIORITIES; i++) {
			matrix[i] += t.matrix[i];
			reach[i] += t.reach[i];
		}
	}
	const v = verdicts(matrix, reach, functionVectors);
	return {
		matrix,
		reach,
		// CGI = mean pairwise cosine similarity between function vectors.
		alignmentIndex: commonGroundIndex(functionVectors),
		alignment: v.alignment,
		fault: v.fault,
		blind: v.blind,
		surprise: surpriseToken(functionVectors, personaBias),
		totalCoins: sum(matrix),
		tableCount: tables.length
	};
}

export function recomputeTable(t: TableState, roomMatrix?: Vec7) {
	// One function per table: its vector is just the function seat's board row.
	const fnSeat = tableSeatIndex(t.id);
	const row = (t.board[fnSeat] ?? zeros()).slice(0, N_PRIORITIES) as Vec7;
	t.matrix = row;
	t.reach = row.map((v) => (v > 0 ? 1 : 0)) as Vec7;
	t.commonGround = roomMatrix ? commonGround(t.matrix, roomMatrix) : 0;
}

/**
 * Analysis deck is presenter-driven during live rounds (force open),
 * always on in reveal/finale. Checkpoint unlocks no longer auto-lock the deck
 * so the presenter can advance R1→R5 and re-open boards each round.
 */
export function analysisOpen(
	room: Pick<RoomState, 'phase' | 'round' | 'analysisForced'>
): boolean {
	if (room.analysisForced) return true;
	if (room.phase === 'reveal' || room.phase === 'finale') return true;
	return false;
}

export function personaBiasList(): Vec7[] {
	return PERSONAS.map((p) => p.bias);
}

/** Room portrait: seat×priority sum across all tables. */
export function roomPortrait(tables: TableState[]): Matrix7x7 {
	const m: Matrix7x7 = Array.from({ length: 7 }, () => Array(N_PRIORITIES).fill(0) as Vec7);
	for (const t of tables) {
		for (let s = 0; s < 7; s++) {
			for (let p = 0; p < N_PRIORITIES; p++) {
				m[s][p] += t.board[s]?.[p] ?? 0;
			}
		}
	}
	return m;
}

export function snapshotFromRoom(room: RoomState): RoundSnapshot {
	const agg = room.aggregate;
	return {
		round: room.round,
		roundLabel: room.round + 1,
		matrix: agg.matrix.slice() as Vec7,
		portrait: roomPortrait(room.tables).map((row) => row.slice() as Vec7),
		alignmentIndex: agg.alignmentIndex,
		alignment: agg.alignment,
		fault: agg.fault,
		blind: agg.blind,
		surprise: agg.surprise ? { ...agg.surprise } : undefined,
		totalCoins: agg.totalCoins
	};
}

/** Upsert live snapshot for the current round into history. */
export function upsertHistory(room: RoomState) {
	if (room.phase !== 'round' && room.phase !== 'reveal' && room.phase !== 'finale') return;
	const snap = snapshotFromRoom(room);
	const idx = room.history.findIndex((h) => h.round === snap.round);
	if (idx >= 0) room.history[idx] = snap;
	else room.history.push(snap);
	room.history.sort((a, b) => a.round - b.round);
}

export interface FunctionOutcome {
	seat: number;
	name: string;
	color: string;
	winner: { priority: number; name: string; tokens: number };
	loser: { priority: number; name: string; tokens: number };
	/** Optional second-place for nuance. */
	runnerUp?: { priority: number; name: string; tokens: number };
	total: number;
}

/** SSOT for presenter insights deck — one shape for stage graphics. */
export function roomInsights(room: RoomState) {
	const a = room.aggregate;
	const index = a.alignmentIndex ?? 0;
	const tables = room.tables.map((t) => {
		const persona = PERSONAS[(t.id - 1) % PERSONAS.length] ?? PERSONAS[0];
		return {
			id: t.id,
			name: persona.name,
			color: persona.color,
			tokens: sum(t.matrix),
			commonGround: t.commonGround ?? 0,
			locked: t.lockedThisRound
		};
	});
	const journey = (room.history ?? [])
		.slice()
		.sort((h, b) => h.roundLabel - b.roundLabel)
		.map((h) => ({ r: h.roundLabel, total: h.totalCoins }));
	// Live point if not yet in history
	if (
		room.phase === 'round' &&
		a.totalCoins > 0 &&
		!journey.some((j) => j.r === room.round + 1)
	) {
		journey.push({ r: room.round + 1, total: a.totalCoins });
	}
	const maxJourney = Math.max(1, ...journey.map((j) => j.total), a.totalCoins);

	return {
		hasData: a.totalCoins > 0,
		index,
		stake: a.totalCoins,
		lead: PRIORITIES[a.alignment],
		fault: PRIORITIES[a.fault],
		blind: PRIORITIES[a.blind],
		blindTokens: a.matrix[a.blind] ?? 0,
		verdict:
			index >= 66 ? 'Aligned' : index >= 40 ? 'Mixed' : index > 0 ? 'Fractured' : '—',
		tables,
		journey,
		maxJourney,
		surprise: a.surprise
	};
}

/** Top winners & losers per function from the combined room portrait. */
export function winnersLosersByFunction(tables: TableState[]): FunctionOutcome[] {
	const portrait = roomPortrait(tables);
	return PERSONAS.map((persona, s) => {
		const row = portrait[s];
		const total = sum(row);
		const ranked = row
			.map((tokens, priority) => ({ priority, tokens, name: PRIORITIES[priority] }))
			.sort((a, b) => b.tokens - a.tokens || a.priority - b.priority);
		const winner = ranked[0] ?? { priority: 0, tokens: 0, name: PRIORITIES[0] };
		const loser = ranked[ranked.length - 1] ?? winner;
		const runnerUp = ranked[1] && ranked[1].tokens > 0 ? ranked[1] : undefined;
		return {
			seat: s,
			name: persona.name,
			color: persona.color,
			winner,
			loser,
			runnerUp,
			total
		};
	});
}
