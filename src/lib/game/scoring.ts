/** Scoring — one function per table; the function's vector is its board row. */
import type { Aggregate, Matrix7x7, Persona, RoomState, RoundSnapshot, TableState, Vec7 } from './types';
import { N_PRIORITIES, PRIORITIES } from './types';
import { PERSONAS, ROUND_COUNT, roomPersonas, roomPriorities, tableBountyTokens, tableSeatIndex } from './config';
import { formatUsd } from './money';

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
 *
 * `reach` (functions backing each priority) is used to disqualify consensus:
 * if most of the room funded the same priority, one persona's low bias doesn't
 * make it surprising. Without this the deck contradicts itself — the same
 * function gets called the most-aligned ally on screen 5 and a surprise on
 * screen 1, for backing the priority every function backed.
 */
export function surpriseToken(
	functionVectors: Vec7[],
	personaBias: Vec7[],
	reach?: Vec7
): { seat: number; priority: number } | undefined {
	let best: { seat: number; priority: number; score: number; offBias: number; share: number } | undefined;
	const active = functionVectors.filter((v) => sum(v) > 0).length;
	// Consensus threshold: backed by more than half the funded room.
	const consensus = Math.max(2, Math.ceil(active / 2));
	for (let f = 0; f < functionVectors.length; f++) {
		const v = functionVectors[f];
		const tot = sum(v);
		if (tot <= 0) continue;
		const bias = personaBias[f] ?? zeros();
		for (let i = 0; i < N_PRIORITIES; i++) {
			if (v[i] <= 0) continue;
			if (reach && (reach[i] ?? 0) >= consensus) continue; // the room agreed — not a surprise
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
		surprise: surpriseToken(functionVectors, personaBias, reach),
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
	/** 0–100: share of this function’s portfolio on its #1 priority (conviction / focus). */
	conviction: number;
	/** 0–100: how evenly spread (100 = flat across all funded priorities). Inverse of finicky. */
	spread: number;
}

/** SSOT for presenter insights deck — one shape for stage graphics. */
export function roomInsights(room: RoomState) {
	const a = room.aggregate;
	const index = a.alignmentIndex ?? 0;
	const personas = roomPersonas(room);
	const names = roomPriorities(room);
	const tables = room.tables.map((t) => {
		const persona = personas[(t.id - 1) % personas.length] ?? personas[0];
		return {
			id: t.id,
			name: persona.name,
			color: persona.color,
			tokens: sum(t.matrix),
			commonGround: t.commonGround ?? 0,
			locked: t.lockedThisRound
		};
	});
	// Journey = CGI over rounds (alignment story), not total $ spent (everyone ends near the same wallet)
	const journey = (room.history ?? [])
		.slice()
		.sort((h, b) => h.roundLabel - b.roundLabel)
		.map((h) => ({ r: h.roundLabel, cgi: h.alignmentIndex, lead: names[h.alignment] ?? '—' }));
	if (
		room.phase === 'round' &&
		a.totalCoins > 0 &&
		!journey.some((j) => j.r === room.round + 1)
	) {
		journey.push({
			r: room.round + 1,
			cgi: index,
			lead: names[a.alignment] ?? '—'
		});
	}
	const maxJourney = Math.max(1, ...journey.map((j) => j.cgi), index);

	const hist = (room.history ?? []).slice().sort((x, y) => x.roundLabel - y.roundLabel);
	const first = hist[0];
	const arc =
		first && a.totalCoins > 0
			? {
					startCgi: first.alignmentIndex,
					endCgi: index,
					startLead: names[first.alignment] ?? '—',
					endLead: names[a.alignment] ?? '—',
					line: arcLine(first.alignmentIndex, index, names[first.alignment], names[a.alignment])
				}
			: null;

	return {
		hasData: a.totalCoins > 0,
		index,
		stake: a.totalCoins,
		lead: names[a.alignment] ?? PRIORITIES[a.alignment],
		fault: names[a.fault] ?? PRIORITIES[a.fault],
		blind: names[a.blind] ?? PRIORITIES[a.blind],
		blindTokens: a.matrix[a.blind] ?? 0,
		verdict:
			index >= 66 ? 'Aligned' : index >= 40 ? 'Mixed' : index > 0 ? 'Fractured' : '—',
		tables,
		journey,
		maxJourney,
		surprise: a.surprise,
		/** Host-overridden priority label for the surprise bet, when present. */
		surprisePriority: a.surprise
			? (names[a.surprise.priority] ?? PRIORITIES[a.surprise.priority])
			: undefined,
		priorityNames: names,
		arc
	};
}

function arcLine(startCgi: number, endCgi: number, startLead: string, endLead: string): string {
	const d = endCgi - startCgi;
	const cgiBit =
		d > 8 ? `Alignment rose ${startCgi}→${endCgi}` : d < -8 ? `Alignment fell ${startCgi}→${endCgi}` : `Alignment held ~${endCgi}`;
	const leadBit =
		startLead && endLead && startLead !== endLead
			? `lead shifted ${startLead} → ${endLead}`
			: `lead stayed ${endLead || '—'}`;
	return `${cgiBit}; ${leadBit}.`;
}

/** Per-function mix story — where they put weight, not who spent more (wallet is common). */
export function winnersLosersByFunction(
	tables: TableState[],
	room?: RoomState | null
): FunctionOutcome[] {
	const portrait = roomPortrait(tables);
	const personas = roomPersonas(room);
	const names = roomPriorities(room);
	return personas.map((persona, s) => {
		const row = portrait[s] ?? Array(N_PRIORITIES).fill(0);
		const total = sum(row);
		const ranked = row
			.map((tokens, priority) => ({
				priority,
				tokens,
				name: names[priority] ?? PRIORITIES[priority]
			}))
			.sort((a, b) => b.tokens - a.tokens || a.priority - b.priority);
		const winner = ranked[0] ?? { priority: 0, tokens: 0, name: names[0] ?? PRIORITIES[0] };
		const funded = ranked.filter((x) => x.tokens > 0);
		const loser =
			funded.length > 1
				? funded[funded.length - 1]
				: (ranked[ranked.length - 1] ?? winner);
		const runnerUp = ranked[1] && ranked[1].tokens > 0 ? ranked[1] : undefined;
		const conviction = total > 0 ? Math.round((winner.tokens / total) * 100) : 0;
		// Shannon-ish evenness: more equal funded priorities → higher spread
		const nFunded = Math.max(1, funded.length);
		const entropy =
			total > 0
				? funded.reduce((acc, x) => {
						const p = x.tokens / total;
						return acc - (p > 0 ? p * Math.log(p) : 0);
					}, 0)
				: 0;
		const maxEnt = Math.log(nFunded) || 1;
		const spread = total > 0 ? Math.round((entropy / maxEnt) * 100) : 0;
		return {
			seat: s,
			name: persona.name,
			color: persona.color,
			winner,
			loser,
			runnerUp,
			total,
			conviction,
			spread
		};
	});
}

// ── Function personality / profile (from their wallet choices) ───────────────

/** Priority indices matching PRIORITIES[] — used for trait slices. */
const PRI = {
	talent: 0,
	experience: 1,
	brand: 2,
	productivity: 3,
	innovation: 4,
	cost: 5,
	future: 6
} as const;

export interface FunctionProfileTrait {
	id: string;
	label: string;
	/** 0–100 score from the table’s portfolio */
	score: number;
	/** One-line facilitator gloss */
	hint: string;
}

export interface FunctionProfile {
	tableId: number;
	seat: number;
	name: string;
	color: string;
	lens: string;
	mission: string;
	/** The function's declared edge and its blind side, straight from the persona.
	 *  Authored copy, not derived — this is what the function is *for*, against
	 *  which their actual spending reads as consistent or surprising.
	 *  Optional: hosts can edit personas and may clear these. */
	strength?: string;
	risk?: string;
	total: number;
	commonGround: number;
	/** Ranked mix with % of their wallet */
	mix: Array<{ priority: number; name: string; tokens: number; pct: number }>;
	prefers: Array<{ name: string; pct: number }>;
	avoids: Array<{ name: string; pct: number }>;
	/** Radar / bars */
	traits: FunctionProfileTrait[];
	/** Short personality tags for chips */
	tags: string[];
	/** Read-aloud headline */
	headline: string;
	/** 3–5 bullets for the deep dive */
	bullets: string[];
	isSurprise: boolean;
	/** Archetype one-liner */
	archetype: string;
}

/**
 * Personality scan of one table from its board choices + room alignment.
 * Pure — no DOM. Presenter cards open this as a deep-dive profile.
 */
export function functionProfile(room: RoomState, tableId: number): FunctionProfile | null {
	const seat = tableSeatIndex(tableId);
	const table = room.tables.find((t) => t.id === tableId);
	if (!table) return null;

	const personas = roomPersonas(room);
	const persona = personas[seat] ?? personas[0];
	const names = roomPriorities(room);
	const row = (table.matrix?.length ? table.matrix : roomPortrait(room.tables)[seat]) ?? zeros();
	const total = sum(row);
	const roomMatrix = room.aggregate.matrix;
	const cg = table.commonGround ?? (total > 0 ? commonGround(row, roomMatrix) : 0);

	const mix = row
		.map((tokens, priority) => ({
			priority,
			name: names[priority] ?? PRIORITIES[priority],
			tokens,
			pct: total > 0 ? Math.round((tokens / total) * 100) : 0
		}))
		.sort((a, b) => b.tokens - a.tokens || a.priority - b.priority);

	const prefers = mix.filter((m) => m.pct > 0).slice(0, 3);
	const avoids = [...mix].filter((m) => m.pct === 0 || m.pct <= 5).slice(-3).reverse();

	const conviction = total > 0 ? Math.round(((mix[0]?.tokens ?? 0) / total) * 100) : 0;
	const funded = mix.filter((m) => m.tokens > 0);
	const nFunded = Math.max(1, funded.length);
	const entropy =
		total > 0
			? funded.reduce((acc, x) => {
					const p = x.tokens / total;
					return acc - (p > 0 ? p * Math.log(p) : 0);
				}, 0)
			: 0;
	const breadth = total > 0 ? Math.round((entropy / (Math.log(nFunded) || 1)) * 100) : 0;

	const share = (i: number) => (total > 0 ? Math.round(((row[i] ?? 0) / total) * 100) : 0);
	const innovation = share(PRI.innovation);
	const future = share(PRI.future);
	const commercial = share(PRI.cost);
	const people = Math.min(100, share(PRI.talent) + share(PRI.experience) + share(PRI.brand));

	// Type-fit: cosine of portfolio vs persona bias vector
	const bias = persona.bias ?? zeros();
	const typeFit = total > 0 ? Math.round(100 * cosine(row, bias as Vec7)) : 0;

	const traits: FunctionProfileTrait[] = [
		{
			id: 'sure',
			label: 'Sure',
			score: conviction,
			hint:
				conviction >= 45
					? 'Concentrated bet — high conviction on one priority.'
					: conviction >= 28
						? 'Clear lead priority, some spread around it.'
						: 'Diffused stake — no single sure bet.'
		},
		{
			id: 'breadth',
			label: 'Breadth',
			score: breadth,
			hint:
				breadth >= 70
					? 'Portfolio style — many priorities funded.'
					: breadth >= 40
						? 'Selective spread across a few bets.'
						: 'Narrow — few funded priorities.'
		},
		{
			id: 'aligned',
			label: 'Aligned',
			score: cg,
			hint:
				cg >= 66
					? 'Close to the room mix — Common Ground ally.'
					: cg >= 40
						? 'Partly with the room, partly independent.'
						: 'Diverges from the room pattern.'
		},
		{
			id: 'innovative',
			label: 'Innovative',
			score: innovation,
			hint:
				innovation >= 25
					? 'Heavy on Innovation — future-making posture.'
					: innovation >= 12
						? 'Some innovation stake in the mix.'
						: 'Light on Innovation this session.'
		},
		{
			id: 'onType',
			label: 'On-type',
			score: typeFit,
			hint:
				typeFit >= 60
					? 'Stayed close to their function bias.'
					: typeFit >= 35
						? 'Mixed type-fit — some off-lens bets.'
						: 'Broke type — funded against their usual lens.'
		},
		{
			id: 'future',
			label: 'Future-facing',
			score: future,
			hint:
				future >= 25
					? 'Strong Future Readiness weight.'
					: future >= 12
						? 'Some future stake.'
						: 'Near-term over five-year readiness.'
		}
	];

	const tags: string[] = [];
	if (conviction >= 45) tags.push('Sure-handed');
	else if (conviction < 25 && breadth >= 55) tags.push('Explorer');
	if (innovation >= 22) tags.push('Innovative');
	if (future >= 22) tags.push('Future-facing');
	if (commercial >= 22) tags.push('Commercial');
	if (people >= 35) tags.push('People-first');
	if (cg >= 66) tags.push('Room-aligned');
	else if (cg < 35 && total > 0) tags.push('Independent');
	if (typeFit >= 60) tags.push('On-type');
	else if (typeFit < 35 && total > 0) tags.push('Broke type');
	if (breadth >= 70) tags.push('Portfolio');
	if (nFunded <= 2 && total > 0) tags.push('Focused');

	const surprise = room.aggregate.surprise;
	const isSurprise = !!surprise && surprise.seat === seat;
	if (isSurprise) tags.push('Surprise');

	const top = prefers[0];
	// Pick the persona's *expected lead* (max of their bias vector) — the role they "should" play.
	// Comparing actual top vs expected lead reveals whether they broke type.
	const expectedLeadName = names[bias.indexOf(Math.max(...bias))] ?? top?.name ?? '—';
	const matchedBias = top?.name === expectedLeadName;
	// Archetype is driven by SHAPE (conviction + breadth + type-fit) and *behavior* (matched bias or not).
	// Each persona gets a distinct role based on how they actually played.
	const archetype =
		total <= 0
			? 'No stake yet'
			: !matchedBias && typeFit < 50
				? `Broke type — sided with ${top?.name ?? '?'}`
				: conviction >= 50 && breadth < 35 && typeFit >= 70
					? `True to ${expectedLeadName}`
					: conviction >= 45 && innovation >= 20
						? 'Bold innovator'
						: breadth >= 70 && conviction < 25
							? 'Balanced generalist'
							: people >= 40
								? 'People champion'
								: future >= 25
									? 'Future-forward'
									: commercial >= 30
										? 'Commercial pragmatist'
										: conviction >= 35
											? `True to ${expectedLeadName}`
											: `Curious about ${top?.name ?? '?'}`;

	const headline =
		total <= 0
			? `${persona.name} has not placed stake yet.`
			: `${persona.name} is ${archetype.toLowerCase()} — lead ${top?.name ?? '—'} at ${top?.pct ?? 0}% of their wallet · alignment ${cg}/100.`;

	const bullets: string[] = [];
	if (top) bullets.push(`Prefers ${top.name} (${top.pct}% of their ${formatUsd(tableBountyTokens(room))} shape).`);
	if (prefers[1]) bullets.push(`Also backs ${prefers[1].name}${prefers[2] ? ` and ${prefers[2].name}` : ''}.`);
	const zero = mix.filter((m) => m.tokens === 0).map((m) => m.name);
	if (zero.length) bullets.push(`Leaves ${zero.slice(0, 3).join(', ')} empty.`);
	bullets.push(
		conviction >= 40
			? `Sure: ${conviction}% of weight on their #1 — concentrated conviction.`
			: `Sure score ${conviction}% — stake is spread rather than a single bet.`
	);
	bullets.push(
		cg >= 50
			? `Aligned ${cg}/100 with the room mix.`
			: `Independent ${cg}/100 vs room — their shape diverges.`
	);
	if (isSurprise && surprise) {
		bullets.push(
			`Surprise: broke type on ${names[surprise.priority] ?? PRIORITIES[surprise.priority]}.`
		);
	} else if (typeFit < 40 && total > 0) {
		bullets.push(`On-type only ${typeFit}/100 — choices sit off their usual lens.`);
	}

	return {
		tableId,
		seat,
		name: persona.name,
		color: persona.color,
		lens: persona.lens,
		mission: persona.mission,
		strength: persona.strength,
		risk: persona.risk,
		total,
		commonGround: cg,
		mix,
		prefers,
		avoids: avoids.filter((a) => a.pct <= 5),
		traits,
		tags: tags.slice(0, 6),
		headline,
		bullets: bullets.slice(0, 5),
		isSurprise,
		archetype
	};
}

/** Profiles for every table with stake (or all tables). */
export function functionProfiles(room: RoomState): FunctionProfile[] {
	return room.tables
		.map((t) => functionProfile(room, t.id))
		.filter((p): p is FunctionProfile => p != null);
}

// ── Round story (assumed → protected → reprioritised) ──────────────────────

export type RoundBeatRole = 'assumed' | 'full-stake' | 'protected' | 'rebuild' | 'final';

export interface RoundBeat {
	/** 1-based round label */
	r: number;
	role: RoundBeatRole;
	/** Facilitator label */
	label: string;
	lead: string;
	cgi: number;
	/** Snapshot exists (frozen or live for current round) */
	hasData: boolean;
}

export interface PriorityShift {
	priority: number;
	name: string;
	/** Percentage-point change in room mix share */
	deltaPts: number;
}

/**
 * What the rounds showed — pure read of history + live aggregate.
 * R1/R2 = assumed · R3 = protected under cut · R4/R5 = reprioritised rebuild.
 */
export interface RoundStoryResult {
	ready: boolean;
	beats: RoundBeat[];
	assumed: { name: string; round: number } | null;
	protected: PriorityShift[];
	cut: PriorityShift[];
	reprioritised: PriorityShift[];
	/** Symmetric to reprioritised — priorities that LOST share from R3→later. */
	deprioritised: PriorityShift[];
	headline: string;
	bullets: string[];
}

export function roomRoundStory(room: RoomState): RoundStoryResult {
	const ROLE: Record<number, { role: RoundBeatRole; label: string }> = {
		1: { role: 'assumed', label: 'Assumed' },
		2: { role: 'full-stake', label: 'Full stake' },
		3: { role: 'protected', label: 'Protected' },
		4: { role: 'rebuild', label: 'Rebuild' },
		5: { role: 'final', label: 'Reprioritised' }
};

	const names = roomPriorities(room);

	const byLabel = new Map<number, RoundSnapshot>();
	for (const h of room.history ?? []) {
		if ((h.totalCoins ?? 0) > 0) byLabel.set(h.roundLabel, h);
	}
	// Live point for current round if not frozen yet
	if (
		(room.phase === 'round' || room.phase === 'reveal' || room.phase === 'finale') &&
		room.aggregate.totalCoins > 0
	) {
		const liveLabel = room.round + 1;
		if (!byLabel.has(liveLabel) || room.phase === 'round') {
			byLabel.set(liveLabel, {
				round: liveLabel - 1,
				roundLabel: liveLabel,
				matrix: room.aggregate.matrix.slice() as Vec7,
				portrait: roomPortrait(room.tables).map((row) => row.slice() as Vec7),
				alignmentIndex: room.aggregate.alignmentIndex,
				alignment: room.aggregate.alignment,
				fault: room.aggregate.fault,
				blind: room.aggregate.blind,
				surprise: room.aggregate.surprise ? { ...room.aggregate.surprise } : undefined,
				totalCoins: room.aggregate.totalCoins
			});
		}
	}

	const beats: RoundBeat[] = [1, 2, 3, 4, 5].map((r) => {
		const snap = byLabel.get(r);
		const meta = ROLE[r];
		return {
			r,
			role: meta.role,
			label: meta.label,
			lead: snap ? (names[snap.alignment] ?? PRIORITIES[snap.alignment] ?? '—') : '—',
			cgi: snap?.alignmentIndex ?? 0,
			hasData: !!snap
		};
	});

	const withData = beats.filter((b) => b.hasData);
	if (withData.length === 0) {
		return {
			ready: false,
			beats,
			assumed: null,
			protected: [],
			cut: [],
			reprioritised: [] as PriorityShift[],
			deprioritised: [] as PriorityShift[],
			headline: 'Play through the rounds — assumed, protected, and reprioritised will land here.',
			bullets: []
		};
	}

	// Assumed = lead at first full-ish stake (prefer R2, else earliest)
	const assumeSnap = byLabel.get(2) ?? byLabel.get(1) ?? [...byLabel.values()].sort((a, b) => a.roundLabel - b.roundLabel)[0];
	const assumed = assumeSnap
		? {
				name: names[assumeSnap.alignment] ?? PRIORITIES[assumeSnap.alignment] ?? '—',
				round: assumeSnap.roundLabel
			}
		: null;

	const r2 = byLabel.get(2);
	const r3 = byLabel.get(3);
	const later =
		byLabel.get(5) ??
		byLabel.get(4) ??
		(room.phase !== 'round' || room.round >= 3
			? byLabel.get(room.round + 1)
			: undefined);

	const protectedList: PriorityShift[] = [];
	const cutList: PriorityShift[] = [];
	if (r2 && r3) {
		const s2 = shareVec(r2.matrix);
		const s3 = shareVec(r3.matrix);
		const deltas = s2.map((p2, i) => ({
			priority: i,
			name: names[i] ?? PRIORITIES[i],
			deltaPts: Math.round((s3[i] - p2) * 10) / 10
		}));
		// Protected: held share (±2pts) or gained under the cut, with real weight at R3
		const held = deltas
			.filter((d) => (r3.matrix[d.priority] ?? 0) > 0 && d.deltaPts >= -2)
			.sort((a, b) => (s3[b.priority] ?? 0) - (s3[a.priority] ?? 0) || b.deltaPts - a.deltaPts)
			.slice(0, 3);
		protectedList.push(...held);
		// Cut: largest share drops
		const cut = deltas
			.filter((d) => d.deltaPts < -2)
			.sort((a, b) => a.deltaPts - b.deltaPts)
			.slice(0, 3);
		cutList.push(...cut);
	}
	const reprioritised: PriorityShift[] = [];
	let deprioritised: PriorityShift[] = [];
	if (r3 && later && later.roundLabel > 3) {
		const s3 = shareVec(r3.matrix);
		const sL = shareVec(later.matrix);
		const all: PriorityShift[] = s3.map((p3, i) => ({
			priority: i,
			name: names[i] ?? PRIORITIES[i],
			deltaPts: Math.round((sL[i] - p3) * 10) / 10
		}));
		const gains = all.filter((d) => d.deltaPts >= 3).sort((a, b) => b.deltaPts - a.deltaPts).slice(0, 3);
		const losses = all.filter((d) => d.deltaPts <= -3).sort((a, b) => a.deltaPts - b.deltaPts).slice(0, 3);
		reprioritised.push(...gains);
		deprioritised.push(...losses);
	}

	const parts: string[] = [];
	if (assumed) parts.push(`Assumed ${assumed.name} at R${assumed.round}`);
	if (protectedList[0]) parts.push(`protected ${protectedList[0].name} under the cut`);
	if (cutList[0]) parts.push(`cut ${cutList[0].name}`);
	if (reprioritised[0]) parts.push(`reprioritised ${reprioritised[0].name} by R${later?.roundLabel ?? 5}`);
	const headline =
		parts.length > 0
			? `${parts[0]}${parts.length > 1 ? '; ' : ''}${parts.slice(1).join('; ')}.`
			: withData.length === 1
				? `R${withData[0].r} lead is ${withData[0].lead} — more rounds will show what gets protected and rebuilt.`
				: `Lead moved ${withData[0].lead} → ${withData[withData.length - 1].lead} across the session.`;

	const bullets: string[] = [];
	if (assumed) bullets.push(`R${assumed.round} assumption: ${assumed.name} led the room’s first full shape.`);
	if (protectedList.length && r3) {
		bullets.push(
			`R3 protected: ${protectedList.map((p) => p.name).join(', ')} held weight when wallets shrank.`
		);
	}
	if (cutList.length) {
		bullets.push(`R3 cut: ${cutList.map((p) => `${p.name} (${p.deltaPts}pts)`).join(', ')}.`);
	}
	if (reprioritised.length && later) {
		bullets.push(
			`R${later.roundLabel} rebuild: ${reprioritised.map((p) => `${p.name} +${p.deltaPts}pts`).join(', ')}.`
		);
	}
	if (withData.length >= 2) {
		const a = withData[0];
		const b = withData[withData.length - 1];
		if (a.cgi !== b.cgi || a.lead !== b.lead) {
			bullets.push(`Alignment ${a.cgi}→${b.cgi}/100 · lead ${a.lead} → ${b.lead}.`);
		}
	}

	const ready = !!r2 || !!r3 || withData.length >= 2;
	const result: RoundStoryResult = {
		ready,
		beats,
		assumed,
		protected: protectedList,
		cut: cutList,
		reprioritised,
		deprioritised,
		headline,
		bullets: bullets.slice(0, 4)
	};
	return result;
}
export interface TableBadge {
	hashtag: string;
	badge: string;
	badgePriority: number | null;
	badgeShare: number;
}

export function badgeForTable(
	room: RoomState,
	tableId: number,
	persona?: Persona | null
): TableBadge {
	const personas = persona ? [persona] : roomPersonas(room);
	const seat = tableSeatIndex(tableId);
	const p = personas[seat] ?? personas[0];
	const hashtag = p?.hashtag ?? '#YourFunction';

	const names = roomPriorities(room);
	const table = room.tables.find((t) => t.id === tableId);
	const portrait = roomPortrait(room.tables);
	const seatPortrait = portrait[seat] ?? zeros();
	const row = table?.matrix?.length ? table.matrix : seatPortrait;
	const total = sum(row as Vec7);
	if (total <= 0) {
		return { hashtag, badge: 'No stake', badgePriority: null, badgeShare: 0 };
	}
	const name = (i: number) => names[i] ?? PRIORITIES[i] ?? '?';

	// Observed play: the badge should name what the table actually did across
	// the rounds, not just its biggest cumulative pile.
	const byLabel = new Map((room.history ?? []).map((h) => [h.roundLabel, h]));
	const r2 = byLabel.get(2);
	const r3 = byLabel.get(3);
	const later = byLabel.get(5) ?? byLabel.get(4);

	const seatRow = (snap?: RoundSnapshot): Vec7 | null => {
		const r = snap?.portrait?.[seat];
		return r && sum(r as Vec7) > 0 ? (r as Vec7) : null;
	};
	/** Average per-function share of a priority across the room, in points. */
	const roomAvgShare = (snap: RoundSnapshot, priority: number): number => {
		let n = 0;
		let acc = 0;
		for (const fnRow of snap.portrait ?? []) {
			const t = sum(fnRow as Vec7);
			if (t <= 0) continue;
			acc += ((fnRow[priority] ?? 0) / t) * 100;
			n++;
		}
		return n > 0 ? acc / n : 0;
	};

	if (r2 && r3) {
		const row2 = seatRow(r2);
		const row3 = seatRow(r3);
		if (row2 && row3) {
			// Held the line: the table's share held or grew R2 → R3 while the
			// room's average share for that priority fell under the cut.
			const t2 = sum(row2);
			const t3 = sum(row3);
			let held: { priority: number; share: number } | null = null;
			for (let i = 0; i < N_PRIORITIES; i++) {
				const s2 = ((row2[i] ?? 0) / t2) * 100;
				const s3 = ((row3[i] ?? 0) / t3) * 100;
				if (s3 <= 0 || s3 < s2) continue;
				if (roomAvgShare(r3, i) >= roomAvgShare(r2, i)) continue;
				if (!held || s3 > held.share) held = { priority: i, share: s3 };
			}
			if (held) {
				return {
					hashtag,
					badge: 'Held ' + name(held.priority),
					badgePriority: held.priority,
					badgeShare: Math.round(held.share)
				};
			}
			// Reprioritised champion: largest R3 → R5 share gain (≥ 3pts, the
			// same threshold roomRoundStory uses for reprioritised).
			if (later && later.roundLabel > 3) {
				const rowL = seatRow(later);
				if (rowL) {
					const tL = sum(rowL);
					let champ: { priority: number; gain: number; share: number } | null = null;
					for (let i = 0; i < N_PRIORITIES; i++) {
						const s3 = ((row3[i] ?? 0) / t3) * 100;
						const sL = ((rowL[i] ?? 0) / tL) * 100;
						const gain = sL - s3;
						if (gain < 3) continue;
						if (!champ || gain > champ.gain) champ = { priority: i, gain, share: sL };
					}
					if (champ) {
						return {
							hashtag,
							badge: 'Championed ' + name(champ.priority),
							badgePriority: champ.priority,
							badgeShare: Math.round(champ.share)
						};
					}
				}
			}
		}
	}

	// Fallback (no R3 history yet): top of the cumulative matrix.
	let topPriority = 0;
	let topTokens = 0;
	for (let i = 0; i < row.length; i++) {
		const v = row[i] ?? 0;
		if (v > topTokens) {
			topTokens = v;
			topPriority = i;
		}
	}
	const share = Math.round((topTokens / total) * 100);
	return {
		hashtag,
		badge: 'Held ' + name(topPriority),
		badgePriority: topPriority,
		badgeShare: share
	};
}


export function shareVec(matrix: number[]): number[] {
	const t = sum(matrix as Vec7);
	if (t <= 0) return matrix.map(() => 0);
	return matrix.map((v) => ((v ?? 0) / t) * 100);
}
