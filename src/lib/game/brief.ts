import {
	DESIGN_LONG,
	DESIGN_SHORT,
	PRIORITY_COLORS,
	PRIORITY_DESIGN_ATTRS,
	SPACE,
	roomPersonas,
	roomPriorities,
	tableBountyTokens,
	FALLBACK_COLOR
} from './config';
import { formatUsd } from './money';
import { PRIORITIES } from './types';
import type { Aggregate, RoomState } from './types';
import { functionProfile, roomInsights, roomRoundStory, sum } from './scoring';

/** Wallet label for narrative copy — actual per-table budget when room is known.
 *  Shared by the domain brief and the AI prompt builders. */
export function walletLabel(room?: RoomState | null): string {
	return room ? formatUsd(tableBountyTokens(room)) : '$100M';
}

export interface PriorityMix {
	priority: number;
	name: string;
	pct: number;
	tokens: number;
	space: string;
	design: string;
	color: string;
	attrs: Readonly<(typeof PRIORITY_DESIGN_ATTRS)[number]>;
}

function mixEntry(
	priority: number,
	tokens: number,
	pct: number,
	labels: readonly string[] = PRIORITIES
): PriorityMix {
	return {
		priority,
		name: labels[priority] ?? PRIORITIES[priority],
		pct,
		tokens,
		space: SPACE[priority],
		design: DESIGN_LONG[priority],
		color: PRIORITY_COLORS[priority],
		attrs: PRIORITY_DESIGN_ATTRS[priority]
	};
}

/** Exact percentage mix for program + image prompt (sums to 100 when total > 0). */
export function priorityMix(matrix: number[], labels: readonly string[] = PRIORITIES): PriorityMix[] {
	const total = sum(matrix as number[]);
	if (total <= 0) {
		return PRIORITIES.map((_, priority) => mixEntry(priority, 0, 0, labels));
	}
	const raw = matrix.map((tokens, priority) => ({
		priority,
		tokens,
		pct: (tokens / total) * 100
	}));
	const floored = raw.map((r) => ({ ...r, pct: Math.floor(r.pct) }));
	let rem = 100 - floored.reduce((s, r) => s + r.pct, 0);
	const order = [...raw.keys()].sort(
		(a, b) => raw[b].pct - Math.floor(raw[b].pct) - (raw[a].pct - Math.floor(raw[a].pct))
	);
	for (let i = 0; i < order.length && rem > 0; i++, rem--) {
		floored[order[i]].pct += 1;
	}
	return floored
		.map((r) => mixEntry(r.priority, r.tokens, r.pct, labels))
		.sort((a, b) => b.pct - a.pct || b.tokens - a.tokens);
}

const nonZero = (mix: PriorityMix[]) => mix.filter((m) => m.pct > 0);

/** Spatial zone on the floorplate — derived from $ mix (SSOT for expand UI + prompts). */
export interface WorkspaceZone {
	priority: number;
	name: string;
	/** Short zone program label (DESIGN_SHORT) */
	zone: string;
	/** Longer SPACE program */
	space: string;
	pct: number;
	tokens: number;
	color: string;
	/** Top zones preferred for floorplate emphasis */
	preferred: boolean;
	/** Mood / materials for branding */
	mood: string;
	materials: string;
	colourBias: string;
}

/**
 * Zones from a priority vector — preferred = lead + any zone ≥12% (or top 3 if sparse).
 */
export function workspaceZonesFromMatrix(
	matrix: number[],
	labels: readonly string[] = PRIORITIES
): WorkspaceZone[] {
	const mix = nonZero(priorityMix(matrix, labels));
	if (!mix.length) return [];
	const preferredSet = new Set<number>();
	const lead = mix[0];
	if (lead) preferredSet.add(lead.priority);
	for (const m of mix) {
		if (m.pct >= 12) preferredSet.add(m.priority);
	}
	if (preferredSet.size < 2) {
		for (const m of mix.slice(0, 3)) preferredSet.add(m.priority);
	}
	return mix.map((m) => ({
		priority: m.priority,
		name: m.name,
		zone: DESIGN_SHORT[m.priority] ?? m.name,
		space: m.space,
		pct: m.pct,
		tokens: m.tokens,
		color: m.color,
		preferred: preferredSet.has(m.priority),
		mood: m.attrs.mood,
		materials: m.attrs.materials,
		colourBias: m.attrs.colorBias
	}));
}

/** Facilitator / expand copy — complete multi-zone workplace layout. */
export function workspaceLayoutBrief(
	zones: WorkspaceZone[],
	opts: { kind: 'room' | 'function'; name: string; brandColor?: string; budgetLabel?: string }
): string {
	if (!zones.length) return 'No stake yet — zones appear when priorities land.';
	const pref = zones.filter((z) => z.preferred);
	const secondary = zones.filter((z) => !z.preferred);
	const layout = pref.map((z) => `${z.pct}% ${z.zone}`).join(' · ');
	const brand =
		opts.kind === 'room'
			? 'Brand palette: Zyeta teal + gold accents on Common Ground floorplate.'
			: `Brand colour ${opts.brandColor ?? 'persona'} frames this function’s zones.`;
	const parts = [
		opts.kind === 'room'
			? `Common Ground workplace layout — combined room mix.`
			: `${opts.name} workplace layout — their full ${opts.budgetLabel ?? '$100M'} lens (not the room average).`,
		`Preferred zones (largest floorplate share): ${layout || '—'}.`,
		pref[0]
			? `Dominant zone: ${pref[0].zone} (${pref[0].pct}%) — materials ${pref[0].materials}; mood ${pref[0].mood}; colour bias ${pref[0].colourBias}.`
			: '',
		secondary.length
			? `Secondary zones: ${secondary.map((z) => `${z.zone} ${z.pct}%`).join(', ')}.`
			: 'All weight sits in preferred zones.',
		brand,
		`Complete floorplate reads as a multi-zone interior: larger shares own light, materials, and circulation; thinner shares stay secondary rooms.`
	];
	return parts.filter(Boolean).join(' ');
}

/** "28% future readiness, 21% talent" — shared by the domain brief and AI prompts. */
export function compositionLine(mix: PriorityMix[]): string {
	const m = nonZero(mix);
	return m.length
		? m.map((x) => `${x.pct}% ${x.name.toLowerCase()}`).join(', ')
		: 'balanced collaboration and focus';
}


/** Numbers-only skeleton brief. Empty when no stake — never invent a mandate. */
export function buildEnhancedBrief(agg: Aggregate, room?: RoomState | null): string {
	if (agg.totalCoins <= 0) return '';
	const labels = roomPriorities(room);
	const personas = roomPersonas(room);
	const mix = priorityMix(agg.matrix, labels);
	const prog = spatialProgramFromAggregate(agg, room);
	const lines = [
		`COMMON GROUND — EACH FUNCTION HAD ${walletLabel(room)} · WHERE WOULD THEY SPEND IT?`,
		`Thesis: same wallet per function. Analysis = shape of priorities. CGI ${agg.alignmentIndex}/100.`,
		``,
		`WHERE THE ${walletLabel(room)} WALLETS WENT (room mix)`,
		...nonZero(mix).map(
			(m) =>
				`· ${m.pct}% ${m.name} — ${formatUsd(m.tokens)} of room weight → ${m.space} · ${m.attrs.keywords.join(', ')}`
		),
		``,
		`MANDATE`,
		prog.mandate,
		``,
		`LEAD / FAULT / BLIND`,
		prog.lead,
		prog.resolve,
		prog.blind,
		``,
		`WHAT THAT LOOKS LIKE (spatial + attributes)`,
		...nonZero(mix).map(
			(m) =>
				`${m.pct}% · ${m.name}: ${m.design}. Mood ${m.attrs.mood}. Quietness: ${m.attrs.quietness}. Colour bias: ${m.attrs.colorBias}.`
		)
	];
	if (agg.surprise) {
		const seat = personas[agg.surprise.seat]?.name ?? 'A function';
		const pri = labels[agg.surprise.priority] ?? PRIORITIES[agg.surprise.priority] ?? 'a priority';
		lines.push(``, `SURPRISE`, `${seat} broke type by funding ${pri} — not their usual bias.`);
	}
	return lines.join('\n');
}

/**
 * Product thesis — single story for home, phone, presenter, AI.
 * Each function had the full $100M. Same budget. Different priorities.
 * Analysis finds Common Ground; AI shows what that mix looks like.
 */
export const THESIS = {
	wallet: 'Every function has the same $100M wallet.',
	prompt: 'If your function controlled the whole budget — where would you put it?',
	commonGround: 'Where those $100M bets overlap is Common Ground.',
	lookLike: 'Stats shape the room. AI shows what that mix looks like — for the room and for each function.',
	/** Shared empty-state copy — charts/panels only; no essay. */
	empty: 'Waiting for priorities…'
} as const;

/**
 * Presenter analysis deck — pattern recognition only (5 screens).
 * Concepts → /present/LIVE/look · Architectural set → /present/LIVE/design
 */
export const DECK_SCREENS = [
	{ title: 'Function Group Matrix', short: 'Matrix' },
	{ title: 'Priority Breakdown', short: 'Breakdown' },
	{ title: 'How the room evolved', short: 'Evolution' },
	{ title: 'What each function did', short: 'Moves' },
	{ title: 'Per function', short: 'Functions' }
] as const;

export function roomThesis(room: RoomState | null | undefined) {
	const i = room ? roomInsights(room) : null;
	const story = room ? roomRoundStory(room) : null;
	const hasData = !!i?.hasData;
	const wallet = walletLabel(room);
	const readAloud = !hasData || !i
		? `${THESIS.prompt} ${THESIS.wallet}`
		: story?.ready
			? `${story.headline} End shape: ${i.lead} leads; ${i.fault} divides; ${i.blind} overlooked. CGI ${i.index}/100 — ${i.verdict}.`
			: `Each function spent from the same ${wallet}. The room’s shape: ${i.lead} leads; ${i.fault} is the divide; ${i.blind} is overlooked. Common Ground Index ${i.index}/100 — ${i.verdict}.`;
	const shapeLine = hasData && i
		? `${i.lead} is where most ${wallet} wallets landed · ${i.fault} splits the room · ${i.blind} is underweighted.`
		: THESIS.prompt;
	return {
		...THESIS,
		wallet: room ? `Every function has the same ${wallet} wallet.` : THESIS.wallet,
		commonGround: room
			? `Where those ${wallet} bets overlap is Common Ground.`
			: THESIS.commonGround,
		hasData,
		readAloud,
		shapeLine,
		cgiLine: hasData && i ? `Common Ground ${i.index}/100 · ${i.verdict}` : 'Common Ground — waiting for stakes',
		lookLine: THESIS.lookLike
	};
}

export function spatialProgramFromAggregate(agg: Aggregate, room?: RoomState | null) {
	const labels = roomPriorities(room);
	const mix = priorityMix(agg.matrix, labels);
	const hasStake = agg.totalCoins > 0;
	const align = labels[agg.alignment] ?? PRIORITIES[agg.alignment];
	const fault = labels[agg.fault] ?? PRIORITIES[agg.fault];
	const blind = labels[agg.blind] ?? PRIORITIES[agg.blind];
	const alignPct = mix.find((m) => m.priority === agg.alignment)?.pct ?? 0;

	return {
		hasStake,
		mandate: hasStake
			? `If every function had ${walletLabel(room)}: the room put ${alignPct}% of its weight on ${align}. Imagine that workplace — floorplate for ${SPACE[agg.alignment].toLowerCase()}.`
			: '',
		program: mix.map((m) => ({
			priority: m.priority,
			name: m.name,
			pct: m.pct,
			space: m.space,
			tokens: m.tokens,
			money: formatUsd(m.tokens),
			color: m.color,
			keywords: m.attrs.keywords
		})),
		lead: hasStake
			? `Lead priority — ${align} (${alignPct}% of room mix).`
			: '',
		resolve: hasStake ? `Fault line — ${fault} (functions disagree).` : '',
		blind: hasStake
			? `Overlooked — ${blind} (underweighted room-wide).`
			: '',
		features: mix
			.filter((r) => r.tokens > 0)
			.slice(0, 5)
			.map((r) => DESIGN_SHORT[r.priority]),
		alignmentIndex: agg.alignmentIndex,
		compositionLine: nonZero(mix)
			.map((m) => `${m.pct}% ${m.name} (${formatUsd(m.tokens)})`)
			.join(' · ')
	};
}

/** Per-function vs room-mix lens: what the main room image combines vs each function’s bet. */
export interface FunctionLensDiff {
	tableId: number;
	name: string;
	color: string;
	/** Priorities strong in both room mix and this function (combined into main image). */
	combined: string[];
	/** Priorities this function pushed harder than the room (their image emphasis). */
	functionLead: string[];
	/** Priorities the room mix holds that this function underweighted. */
	roomLead: string[];
	/** One-line ZyetaI note for expand / brief. */
	note: string;
}

const DELTA = 8; // percentage points — material difference

/**
 * Compare each function’s $100M shape to the room mix.
 * Used when opening a function image: “what’s in the room render vs this lens”.
 */
export function functionLensDiffs(room: RoomState): FunctionLensDiff[] {
	const labels = roomPriorities(room);
	const personas = roomPersonas(room);
	const roomMix = priorityMix(room.aggregate.matrix, labels);
	const roomPct = labels.map((_, i) => roomMix.find((m) => m.priority === i)?.pct ?? 0);

	return room.tables
		.map((t) => {
			const seat = Math.max(0, t.id - 1);
			const persona = personas[seat] ?? personas[0];
			const fnMix = priorityMix(t.matrix ?? [], labels);
			const total = sum(t.matrix ?? []);
			const combined: string[] = [];
			const functionLead: string[] = [];
			const roomLead: string[] = [];

			for (let i = 0; i < labels.length; i++) {
				const fp = fnMix.find((m) => m.priority === i)?.pct ?? 0;
				const rp = roomPct[i] ?? 0;
				const name = labels[i] ?? PRIORITIES[i];
				if (fp >= 10 && rp >= 10) combined.push(`${name} (${fp}% · room ${rp}%)`);
				if (fp - rp >= DELTA) functionLead.push(`${name} +${fp - rp}pts vs room`);
				if (rp - fp >= DELTA && rp >= 8) roomLead.push(`${name} (room ${rp}% · fn ${fp}%)`);
			}

			const noteParts: string[] = [];
			if (functionLead.length)
				noteParts.push(`This lens pushes: ${functionLead.map((s) => s.split(' +')[0]).join(', ')}.`);
			if (combined.length)
				noteParts.push(`Combined in the room image: ${combined.map((s) => s.split(' (')[0]).join(', ')}.`);
			if (roomLead.length)
				noteParts.push(`Room holds more of: ${roomLead.map((s) => s.split(' (')[0]).join(', ')}.`);
			if (!noteParts.length)
				noteParts.push(
					total > 0
						? 'This function tracks the room mix closely — little unique emphasis.'
						: 'No stake yet.'
				);

			return {
				tableId: t.id,
				name: persona?.name ?? `Table ${t.id}`,
				color: persona?.color ?? FALLBACK_COLOR,
				combined,
				functionLead,
				roomLead,
				note: noteParts.join(' ')
			};
		})
		.filter((d) => {
			const t = room.tables.find((x) => x.id === d.tableId);
			return sum(t?.matrix ?? []) > 0;
		});
}

/** Append lens comparison block to a brief string (idempotent strip+rewrite).
 *  If `brief` is empty, falls back to the composed complete brief from cards.
 *  If cards don't exist yet (no renders), returns the brief unchanged. */
export function withLensSection(brief: string, room: RoomState): string {
	const cards = designCardsFromRoom(room);
	// No renders yet → nothing to compare; return the brief untouched.
	if (cards.length === 0) return brief;
	// Empty brief → return the composed complete brief from cards.
	if (!brief.trim()) return composeCompleteBriefFromCards(cards, room);
	const diffs = functionLensDiffs(room);
	if (!diffs.length) return brief;
	const marker = 'LENS VS ROOM IMAGE';
	const body = diffs.map((d) => `· ${d.name}: ${d.note}`).join('\n');
	const section = `\n\n${marker}\n(Room render = combined mix. Each function image = that ${walletLabel(room)} lens.)\n${body}`;
	const stripped = brief.replace(/\n\nLENS VS ROOM IMAGE[\s\S]*$/i, '').trimEnd();
	return stripped + section;
}

/**
 * Structured design card — reverse-engineered from the stake mix that drove a render.
 * (Image URL is attached when present; the JSON is the design DNA, not pixel vision.)
 */
export interface DesignCard {
	kind: 'room' | 'function';
	tableId?: number;
	functionName: string;
	/** Persona / brand colour for the card */
	color?: string;
	imageUrl?: string | null;
	mix: Array<{
		priority: string;
		pct: number;
		tokens: number;
		design: string;
		keywords: string[];
		materials: string;
		mood: string;
		colourBias: string;
		quietness: string;
	}>;
	lead: string;
	leadPct: number;
	spatial: string;
	/** vs room mix — only on function cards */
	vsRoom?: {
		pushes: string[];
		shares: string[];
		underweights: string[];
		note: string;
	};
	/** Preferred spatial zones (floorplate program) */
	zones?: Array<{ zone: string; name: string; pct: number; preferred: boolean; color: string }>;
	/** Feature / DBR requirements derived from mix */
	requirements?: string[];
	/** Analytics + personality (functions); room CGI on room card */
	analytics?: {
		commonGround?: number;
		archetype?: string;
		tags?: string[];
		traits?: Array<{ id: string; label: string; score: number }>;
		prefers?: string[];
		headline?: string;
		cgi?: number;
		verdict?: string;
	};
}

function requirementsFromMix(
	mix: Array<{ priority: string; pct: number; design: string; keywords: string[] }>
): string[] {
	return mix.slice(0, 5).map((m) => {
		const share =
			m.pct >= 25 ? 'primary' : m.pct >= 12 ? 'secondary' : 'support';
		return `${share.toUpperCase()} · ${m.pct}% floorplate for ${m.priority}: ${m.design} (${m.keywords.slice(0, 3).join(', ')})`;
	});
}

function cardFromVector(
	kind: 'room' | 'function',
	name: string,
	vector: number[],
	labels: string[],
	opts?: {
		tableId?: number;
		imageUrl?: string | null;
		vsRoom?: DesignCard['vsRoom'];
		color?: string;
		analytics?: DesignCard['analytics'];
	}
): DesignCard {
	const mix = nonZero(priorityMix(vector, labels));
	const top = mix[0];
	const zones = workspaceZonesFromMatrix(vector, labels).map((z) => ({
		zone: z.zone,
		name: z.name,
		pct: z.pct,
		preferred: z.preferred,
		color: z.color
	}));
	return {
		kind,
		tableId: opts?.tableId,
		functionName: name,
		color: opts?.color,
		imageUrl: opts?.imageUrl ?? null,
		mix: mix.map((m) => ({
			priority: m.name,
			pct: m.pct,
			tokens: m.tokens,
			design: m.design,
			keywords: [...m.attrs.keywords],
			materials: m.attrs.materials,
			mood: m.attrs.mood,
			colourBias: m.attrs.colorBias,
			quietness: m.attrs.quietness
		})),
		lead: top?.name ?? '—',
		leadPct: top?.pct ?? 0,
		spatial: mix
			.slice(0, 4)
			.map((m) => `${m.pct}% ${m.design}`)
			.join('; '),
		vsRoom: opts?.vsRoom,
		zones,
		requirements: requirementsFromMix(
			mix.map((m) => ({
				priority: m.name,
				pct: m.pct,
				design: m.design,
				keywords: [...m.attrs.keywords]
			}))
		),
		analytics: opts?.analytics
	};
}

/** Reverse-engineer room + each function render into JSON design cards (+ analytics / persona). */
export function designCardsFromRoom(room: RoomState): DesignCard[] {
	const labels = roomPriorities(room);
	const personas = roomPersonas(room);
	const cards: DesignCard[] = [];
	const insights = roomInsights(room);

	if (room.aggregate.totalCoins > 0) {
		cards.push(
			cardFromVector('room', 'Room (combined mix)', room.aggregate.matrix, labels, {
				imageUrl: room.finaleImageUrl,
				color: '#1F8B78',
				analytics: {
					cgi: insights.index,
					verdict: insights.verdict,
					headline: insights.arc?.line,
					prefers: insights.hasData
						? [`Lead ${insights.lead}`, `Fault ${insights.fault}`, `Blind ${insights.blind}`]
						: undefined
				}
			})
		);
	}

	const diffs = functionLensDiffs(room);
	const diffById = Object.fromEntries(diffs.map((d) => [d.tableId, d]));

	for (const t of room.tables) {
		const total = sum(t.matrix ?? []);
		if (total <= 0) continue;
		const seat = Math.max(0, t.id - 1);
		const persona = personas[seat] ?? personas[0];
		const d = diffById[t.id];
		const prof = functionProfile(room, t.id);
		cards.push(
			cardFromVector('function', persona?.name ?? `Table ${t.id}`, t.matrix, labels, {
				tableId: t.id,
				imageUrl: t.imageUrl,
				color: persona?.color,
				vsRoom: d
					? {
							pushes: d.functionLead,
							shares: d.combined,
							underweights: d.roomLead,
							note: d.note
						}
					: undefined,
				analytics: prof
					? {
							commonGround: prof.commonGround,
							archetype: prof.archetype,
							tags: prof.tags,
							traits: prof.traits.map((tr) => ({
								id: tr.id,
								label: tr.label,
								score: tr.score
							})),
							prefers: prof.prefers.map((p) => `${p.name} ${p.pct}%`),
							headline: prof.headline
						}
					: undefined
			})
		);
	}
	return cards;
}

/** Drawing set: every generated image in presentation order (room palette → functions). */
export function drawingSetFromRoom(
	room: RoomState
): Array<{ url: string; label: string; kind: 'room' | 'function'; tableId?: number; color: string }> {
	const out: Array<{
		url: string;
		label: string;
		kind: 'room' | 'function';
		tableId?: number;
		color: string;
	}> = [];
	const roomUrls = roomConceptPalette(room);
	roomUrls.forEach((url, i) => {
		out.push({
			url,
			label: roomUrls.length > 1 ? `Common Ground · ${i + 1}` : 'Common Ground · room',
			kind: 'room',
			color: '#1F8B78'
		});
	});
	const personas = roomPersonas(room);
	for (const t of room.tables) {
		if (!t.imageUrl) continue;
		const p = personas[Math.max(0, t.id - 1)] ?? personas[0];
		out.push({
			url: t.imageUrl,
			label: `T${t.id} · ${p?.name ?? 'Function'}`,
			kind: 'function',
			tableId: t.id,
			color: p?.color ?? '#B8932E'
		});
	}
	return out;
}

/** Common Ground room concept palette (unique, primary first). */
export function roomConceptPalette(room: RoomState): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	const push = (u?: string) => {
		const s = typeof u === 'string' ? u.trim() : '';
		if (!s || seen.has(s)) return;
		seen.add(s);
		out.push(s);
	};
	// Selected primary first
	push(room.finaleImageUrl);
	for (const u of room.roomConceptUrls ?? []) push(u);
	// Legacy: only finale set, no palette array yet
	return out;
}

/**
 * Prompts for architectural workspace design sheets.
 * Generated after brief is final — collages reference concept images into plan/section/elevation.
 */
/** Canonical sheet set for the workspace design studio — kind + label SSOT
 *  (client uses this for the per-sheet rail; prompts are built below).
 *  Single hero frame: the entire workspace concept in one image, no in-image text. */
export const WORKSPACE_SHEET_SPECS: Array<{
	kind: import('./types').WorkspaceDesignKind;
	label: string;
}> = [{ kind: 'concept', label: 'Entire workspace concept' }];

export function workspaceDesignSheets(
	room: RoomState
): Array<{ kind: import('./types').WorkspaceDesignKind; label: string; prompt: string }> {
	const brief = (room.enhancedBrief ?? '').slice(0, 900).replace(/\s+/g, ' ').trim();
	const labels = roomPriorities(room);
	const zones = workspaceZonesFromMatrix(room.aggregate.matrix, labels);
	const pref = zones
		.filter((z) => z.preferred)
		.map((z) => `${z.pct}% ${z.zone}`)
		.join('; ');
	const mix = compositionLine(priorityMix(room.aggregate.matrix, labels));
	const briefBit = brief
		? `Design brief excerpt (honour this): ${brief}`
		: 'Design from the Common Ground priority mix only.';

	return [
		{
			kind: 'concept',
			label: WORKSPACE_SHEET_SPECS[0]!.label,
			prompt: [
				'ZyetaI · Common Ground — ONE single architectural hero frame that captures the ENTIRE future workplace design concept.',
				'One image only: the complete multi-zone workplace in a single coherent view — a sweeping wide interior with cutaway depth (or a soft axonometric) that shows every zone at once.',
				`Priority mix: ${mix}.`,
				`Preferred zones: ${pref || 'balanced multi-zone'}.`,
				briefBit,
				'Zone sizes, focal materials, and light follow the money: higher-% priorities own the largest, most focal areas; lower-% read as smaller secondary moments — all visible together in one frame.',
				'Use the attached reference images as material, furniture, lighting, and zone-mood guidance — blend them into ONE coherent space, not a grid of separate pictures.',
				'Coherent language: warm timber, soft textiles, matte metal, cinematic natural light, Zyeta teal (#1F8B78) and gold (#B8932E) as subtle accents only.',
				'People using the space naturally — meeting, collaborating, focused work — never staring at camera.',
				'Wide 16:9 presentation frame, 2K clarity.',
				'No text anywhere in the image: no title blocks, no labels, no annotation, no captions, no charts, no logos, no watermarks — pure architecture.'
			].join(' ')
		}
	];
}

/** Numbers-only complete brief from design cards (AI fallback) — architectural DBR shape. */
export function composeCompleteBriefFromCards(cards: DesignCard[], room: RoomState): string {
	if (!cards.length) return '';
	const roomCard = cards.find((c) => c.kind === 'room');
	const fnCards = cards.filter((c) => c.kind === 'function');
	const i = roomInsights(room);
	const story = roomRoundStory(room);
	const lines: string[] = [
		`ZYETAI ARCHITECTURAL BRIEF — COMMON GROUND`,
		`Reverse-engineered from ${walletLabel(room)} priority choices · room image = recombined mix · function images = lenses + personality.`,
		``,
		`01 · EXECUTIVE SUMMARY`,
		i.hasData
			? `Common Ground Index ${i.index}/100 (${i.verdict}). Lead ${i.lead}. Fault ${i.fault}. Blind ${i.blind}.`
			: 'No stake yet.',
		roomCard
			? `Room prioritises ${roomCard.lead} at ${roomCard.leadPct}% — spatial: ${roomCard.spatial}.`
			: '',
		story.ready ? `Round story: ${story.headline}` : '',
		``,
		`02 · ROOM DESIGN REQUIREMENTS (DBR)`
	];
	if (roomCard?.requirements?.length) {
		for (const r of roomCard.requirements) lines.push(`· ${r}`);
	} else if (roomCard) {
		for (const m of roomCard.mix) {
			lines.push(
				`· ${m.pct}% ${m.priority} → ${m.design} · ${m.keywords.join(', ')} · mood ${m.mood}`
			);
		}
	} else {
		lines.push('· (no room card)');
	}
	if (roomCard?.zones?.length) {
		lines.push(``, `02b · PREFERRED ZONES`);
		for (const z of roomCard.zones.filter((x) => x.preferred)) {
			lines.push(`· ${z.pct}% ${z.zone} (${z.name})`);
		}
	}

	lines.push(``, `03 · FUNCTION LENSES (JSON + analytics + personality)`);
	for (const c of fnCards) {
		lines.push(``, `### ${c.functionName}${c.imageUrl ? ' · drawing ready' : ''}`);
		lines.push(`Lead: ${c.lead} ${c.leadPct}%`);
		lines.push(`Mix: ${c.mix.map((m) => `${m.pct}% ${m.priority}`).join('; ')}`);
		if (c.analytics?.archetype) lines.push(`Personality: ${c.analytics.archetype}`);
		if (c.analytics?.tags?.length) lines.push(`Tags: ${c.analytics.tags.join(', ')}`);
		if (c.analytics?.commonGround != null)
			lines.push(`Alignment to room: ${c.analytics.commonGround}/100`);
		if (c.analytics?.traits?.length)
			lines.push(
				`Traits: ${c.analytics.traits.map((t) => `${t.label} ${t.score}`).join(' · ')}`
			);
		if (c.vsRoom?.note) lines.push(`vs room: ${c.vsRoom.note}`);
		if (c.requirements?.length) {
			lines.push(`Requirements:`);
			for (const r of c.requirements.slice(0, 4)) lines.push(`  · ${r}`);
		}
	}

	lines.push(``, `04 · RECOMBINATION`);
	lines.push(
		'Room drawing merges shared priorities. Unique function pushes appear on that function’s drawing only, unless the room mix agrees.'
	);
	if (i.arc?.line) {
		lines.push(``, `05 · ROOM ARC`, i.arc.line);
	}
	lines.push(``, `06 · OPEN QUESTION`);
	lines.push(
		`If you built only the room drawing, what does ${i.hasData ? i.blind : 'the blind spot'} lose — and which function would fight to put it back?`
	);
	return lines.filter((l) => l !== undefined && l !== '').join('\n');
}
