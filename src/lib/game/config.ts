import { PRIORITIES, type Persona, type Scenario, type Vec7 } from './types';

export const PERSONAS: Persona[] = [
	{
		seat: 0,
		name: 'Real Estate',
		lens: 'Optimise portfolio & reduce footprint',
		color: '#E0A458',
		bias: [0, 0, 1, 1, 0, 3, 2],
		mission: 'Reduce footprint. Optimise portfolio.',
		strength: 'Strong portfolio optimization & footprint efficiency.',
		risk: 'May constrain growth or space flexibility.',
		hashtag: '#FootprintShrinker'
	},
	{
		seat: 1,
		name: 'HR',
		lens: 'Optimise people & employee engagement',
		color: '#E0665A',
		bias: [3, 2, 1, 0, 0, 0, 0],
		mission: 'Increase employee engagement. Optimise people.',
		strength: 'Excellent employee proposition.',
		risk: 'Limited financial justification.',
		hashtag: '#PeopleOptimizer'
	},
	{
		seat: 2,
		name: 'IT',
		lens: 'Optimise technology & AI adoption',
		color: '#3FB6A2',
		bias: [1, 3, 1, 1, 1, 0, 1],
		mission: 'Accelerate AI adoption. Optimise technology.',
		strength: 'Highly future-focused.',
		risk: 'Workplace experience may become overly technology-centric.',
		hashtag: '#AIAdopter'
	},
	{
		seat: 3,
		name: 'Finance',
		lens: 'Optimise cost & commercial discipline',
		color: '#5AA9E6',
		bias: [1, 0, 0, 1, 0, 3, 1],
		mission: 'Reduce operating cost by 20%. Optimise cost.',
		strength: 'Strong commercial discipline.',
		risk: 'Under-investment in people and innovation.',
		hashtag: '#CostDisciplinarian'
	},
	{
		seat: 4,
		name: 'Operations',
		lens: 'Optimise resilience & execution speed',
		color: '#7E8CE0',
		bias: [0, 0, 0, 2, 1, 2, 3],
		mission: 'Improve resilience. Optimise resilience.',
		strength: 'High operational resilience & speed.',
		risk: 'Focus on immediate continuity may delay strategic transformation.',
		hashtag: '#ResilienceBuilder'
	},
	{
		seat: 5,
		name: 'Marketing',
		lens: 'Optimise brand & employer proposition',
		color: '#E574B0',
		bias: [2, 1, 3, 0, 1, 0, 0],
		mission: 'Strengthen employer brand. Optimise brand.',
		strength: 'Strong employer brand & market positioning.',
		risk: 'Emphasis on brand perception over functional efficiency.',
		hashtag: '#BrandBuilder'
	},
	{
		seat: 6,
		name: 'C-Suite',
		lens: 'Optimise enterprise value & growth',
		color: '#C9A227',
		bias: [2, 0, 0, 2, 2, 0, 2],
		mission: 'Increase enterprise value. Optimise enterprise value.',
		strength: 'Maximizes total enterprise value.',
		risk: 'High-level focus may obscure department-level friction.',
		hashtag: '#EnterpriseOptimizer'
	}
];

export const N_SEATS = PERSONAS.length;

/**
 * Priority palette — the chart encoding, not brand chrome.
 *
 * Tuned for a projected stacked bar seen from across a room. Two pairs used to
 * collide: Experience/Future at dE 15 and Brand/Innovation at dE 20 for normal
 * vision, and Talent/Brand fell to dE 9 under deuteranopia (~6% of men), which
 * made adjacent segments read as one block. Every pair is now >=25 dE apart
 * under deuteranopia and >=40 for normal vision, while each hue stays within
 * dE 18 of its original so the set still reads as the same considered palette.
 *
 * Cost / ROI keeps its exact red: that colour is load-bearing elsewhere
 * (danger, the R3 cut round, the fault chip) and must not drift.
 *
 * Every fill also carries a 9px dark-ink percentage label in the stacked bars,
 * so each one must clear 4.5:1 against --color-ink. That is the binding
 * constraint on Innovation, the darkest of the set.
 */
export const PRIORITY_COLORS = [
	'#cccaeb',
	'#1e9ca2',
	'#d386eb',
	'#e3c659',
	'#4588e4',
	'#e0554b',
	'#9dcb92'
] as const;

/**
 * Design attributes when money lands on a priority (SSOT for brief + image prompts).
 * Higher stake → these keywords dominate materials, mood, and program language.
 * Index matches PRIORITIES[] / PRIORITY_COLORS[] (0=Talent, 6=Future Readiness).
 */
export const PRIORITY_DESIGN_ATTRS = [
	{
		// 0 · Talent — activated arrival, recruitment-grade amenities
		keywords: [
			'talent magnets',
			'activated arrival experience',
			'amenities — gym, recreation, food offerings',
			'recruitment-grade finishes',
			'high-performer focus'
		],
		materials: 'premium finishes, polished stone, refined timber, hospitality-grade upholstery',
		mood: 'aspirational, sharp, opportunity-forward — the workplace sells itself at the door',
		colorBias: 'cool sky accents, crisp whites, brand teal moments',
		quietness: 'moderate — focused zones with soft conversation'
	},
	{
		// 1 · Employee Experience — sunlight, biophilia, game/relax rooms
		keywords: [
			'wellness',
			'ergonomics',
			'human-centric',
			'psychological safety',
			'sunlight-filled spaces',
			'biophilic design — plants, natural materials, daylight',
			'mindfulness zones — massage pods, quiet zones, meditation',
			'game rooms and relax rooms — meta, playful, social',
			'activated employee journey'
		],
		materials: 'soft textiles, biophilic plants, warm timber, acoustic felt, natural stone',
		mood: 'calm, restorative, caring, lightly playful',
		colorBias: 'soft teals, sage, warm neutrals, sun-warmed cream',
		quietness: 'high — quiet rooms, library tone, soft footfall'
	},
	{
		// 2 · Employer Brand — logo, AV screens, EGD on walls
		keywords: [
			'brand showcase',
			'arrival moment',
			'client theatre',
			'employer story',
			'logo presence at every threshold',
			'AV screens running company content',
			'environmental graphics (EGD) — decals, wall wraps, brand moments',
			'signature arrival experience'
		],
		materials: 'statement lighting, feature walls, curated furniture, branded wayfinding',
		mood: 'expressive, hospitable, photogenic, recognisable',
		colorBias: 'brand-forward jewel tones, gold accents, signature palette',
		quietness: 'low–moderate — lively reception energy'
	},
	{
		// 3 · Productivity — work settings, scrum rooms, pods
		keywords: [
			'focus density',
			'workflow speed',
			'deep work',
			'execution',
			'varied work settings — open desks, focus pods, collaboration rooms',
			'scrum-friendly collaboration environments',
			'meeting variety — huddle rooms, boardrooms, video rooms',
			'rooms + pods mix',
			'tech tools integrated into every workstation',
			'property-efficient layouts'
		],
		materials: 'clean workstations, acoustic panels, matte surfaces, writable glass',
		mood: 'efficient, uncluttered, purposeful, energetic when collaborative',
		colorBias: 'muted golds, charcoal, cool grey',
		quietness: 'high in focus bays; controlled collaboration edges'
	},
	{
		// 4 · Innovation — War Room, Idea Hubs, Quiet Focus Zones
		// Deliberately worded away from Productivity: that priority owns steady
		// output at a desk, this one owns making and testing. Sharing "pods /
		// desks / tech / focus" made the two mixes render as the same room.
		keywords: [
			'prototyping benches and maker tables',
			'wet and dry labs',
			'agile scrum corners with movable walls',
			'experimentation and rapid testing',
			'War Room — high-intensity decision and response space',
			'Idea Hubs — ideation lounges with writable everything',
			'retreat nooks for solo thinking between builds',
			'exposed prototyping kit, screens and half-built work on display'
		],
		materials: 'writable surfaces, modular furniture, tech-integrated desks, exposed services',
		mood: 'experimental, agile, high-creativity, interactive',
		colorBias: 'periwinkle, electric accents on cream',
		quietness: 'mixed — quiet focus + lively make zones'
	},
	{
		// 5 · Cost / ROI
		keywords: [
			'commercial discipline',
			'efficiency',
			'lean footprint',
			'multi-use spaces',
			'value engineering',
			'measured square-footage per role'
		],
		materials: 'durable composites, modular demountable walls, standardized fit-out',
		mood: 'disciplined, clean, rational, adaptable',
		colorBias: 'cool greys, steel blue, slate',
		quietness: 'controlled — standardized acoustic dampening'
	},
	{
		// 6 · Future Readiness
		keywords: [
			'AI-ready infrastructure',
			'digital media walls',
			'raised access floors',
			'sensor-ready ceilings',
			'flexible demountable partitions',
			'overnight reconfigurability'
		],
		materials: 'smart glass, integrated LED displays, modular aluminum framing, cable-access flooring',
		mood: 'forward-looking, adaptive, high-tech, seamless',
		colorBias: 'cyan, deep indigo, clean white',
		quietness: 'adaptive — acoustic dampening on demand'
	}
] as const;

/**
 * Index-matched with PRIORITIES[] (0=Talent, 1=Employee Experience, …, 6=Future Readiness).
 *  These strings drive the brief's "where the money goes" narrative and the prompt
 *  for the per-priority portion of the visual render.
 */
export const SPACE = [
	'Talent-magnet arrival & amenity-rich amenities',
	'Employee experience & wellness — sunlight, biophilia, mindfulness, game rooms',
	'Employer brand showcase — logo, EGD, AV screens, signature arrival',
	'Productivity — varied work settings, scrum rooms, pods, meeting variety',
	'Innovation hubs — War Room, Idea Hubs, Quiet Focus Zones, prototyping',
	'Cost-efficient multi-use rooms & lean footprint',
	'Future floorplate — digital media, raised access floors, sensor-ready, AI-ready'
];

export const DESIGN_LONG = [
	'Talent-magnet arrival, gym / recreation / food amenities, recruitment-grade finishes, hospitality moments.',
	'Employee experience hubs, sunlight-filled spaces, biophilic plants, mindfulness pods, massage chairs, quiet zones, game rooms and relax rooms — meta, playful, social.',
	'Employer brand showcase: signature logo presence at every threshold, AV screens running company content, environmental graphics (EGD) decals and wall wraps, signature arrival experience.',
	'Productivity: varied work settings — open desks, focus pods, scrum-friendly collaboration rooms, meeting variety — huddle, boardroom, video rooms — pods everywhere, property-efficient layouts, integrated tech tools.',
	'Innovation hubs: War Room for high-intensity decisions, Idea Hubs with writable everything, Quiet Focus Zones for deep work, prototyping labs with tech-integrated desks.',
	'Cost / ROI: value-engineered multi-use rooms, standardised components for speed of fit-out, measured square-footage per role, lean footprint without chaos.',
	'Future Readiness: AI-ready infrastructure, digital media as walls, functional spaces that reconfigure overnight, raised access floors with cabling underneath, sensor-ready ceilings, flexible demountable walls.'
];

export const DESIGN_SHORT = [
	'Talent arrival & amenities',
	'EE wellness & game rooms',
	'Brand showcase & EGD',
	'Varied work settings',
	'Innovation hubs (War Room, Idea Hubs)',
	'Lean footprint',
	'Future floorplate (digital media, raised floors)'
];

/**
 * One physical table = one room function (not a full multi-function board).
 * Table 1 → CRE, Table 2 → HR, Table 3 → IT, Table 4 → Finance, Table 5 → Operations, Table 6 → Marketing, Table 7 → C-Suite.
 * Seat index on the room portrait = tableId − 1.
 */
export function tableSeatIndex(tableId: number): number {
	const n = Math.min(PERSONAS.length, Math.max(1, tableId));
	return n - 1;
}

export function tablePersona(tableId: number, room?: { personas?: Persona[] } | null) {
	const p = roomPersonas(room);
	return p[tableSeatIndex(tableId)] ?? p[0];
}

/** 5-round narrative progression. */
export const ROUND_COUNT = 5;

/** Capture seal happens on R2 · R3 · R5 */
export const DEFAULT_TABLE_COUNT = 7;
/** Budgets are $M of value: table $100M, room $700M (7 × $100M). */
export const DEFAULT_ROOM_BOUNTY_TOKENS = 700;
export const DEFAULT_TABLE_BOUNTY_TOKENS = 100;

/** Largest value a single priority cell can hold (board rules clamp here). */
export const MAX_CELL_TOKENS = 99;
/**
 * Largest submittable board total (7 cells × 99). The wallet must never
 * exceed this or the R2 full-wallet seal becomes mathematically impossible.
 */
export const MAX_WALLET_TOKENS = MAX_CELL_TOKENS * 7;

/** Per-table wallet in tokens ($M) — room bounty split across tables. */
export function tableBountyTokens(room: {
	tables: unknown[];
	roomBountyTokens?: number;
}): number {
	const n = Math.max(1, room.tables.length);
	const fromRoom = Math.floor((room.roomBountyTokens || DEFAULT_ROOM_BOUNTY_TOKENS) / n);
	return Math.min(MAX_WALLET_TOKENS, Math.max(1, fromRoom || DEFAULT_TABLE_BOUNTY_TOKENS));
}

/** The one and only physical chip — $10M, brand red. */
export const CHIP_VALUE = 10;
export const CHIP_HEX = '#e0554b';
/** Rounds that seal a capture snapshot — the evolution screen reads these. */
export const EVOLUTION_ROUNDS = [2, 3, 5] as const;


/**
 * Capture seal allowed for this 1-based round label.
 * When `room` is provided, host scenario `mode === 'capture'` is authoritative.
 */
export function isCaptureRound(
	roundLabel1Based: number,
	room?: { scenarios?: Scenario[] } | null
): boolean {
	if (room != null) {
		const s = roomScenarios(room)[roundLabel1Based - 1];
		return s?.mode === 'capture';
	}
	return (EVOLUTION_ROUNDS as readonly number[]).includes(roundLabel1Based);
}

/**
 * Merge runtime persona overrides with static defaults.
 * If room.personas[i] exists, use it; otherwise fall back to PERSONAS[i].
 */
export function roomPersonas(room?: { personas?: Persona[] } | null): Persona[] {
	if (!room?.personas?.length) return PERSONAS;
	return PERSONAS.map((p, i) => {
		const over = room.personas![i];
		return over ? { ...p, ...over, seat: i } : p;
	});
}

/**
 * Merge runtime scenario overrides with static defaults, then retarget wallet copy.
 *
 * Scenario copy quotes the default $100M wallet, but the room budget is
 * host-editable — with 6 tables on a 700 pool the real wallet is $116M, and the
 * phone would show "full $100M" directly above "full $116M". Rewrite the
 * default-wallet figures to the room's actual per-table wallet so every surface
 * quotes one number.
 *
 * Only the budget-arc constants are substituted, and only when the wallet
 * actually differs, so host-authored copy is left alone.
 */
function retargetWalletCopy<T extends string | undefined>(text: T, wallet: number): T {
	if (!text || wallet === R2_FULL_BUDGET) return text;
	const sub: Array<[number, number]> = [
		[R2_FULL_BUDGET, wallet],
		[R3_REMOVE_TARGET, r3RemoveTarget(wallet)],
		[R5_RESTRUCTURE_CAP, r5CapForWallet(wallet)]
	];
	let out: string = text;
	for (const [from, to] of sub) {
		if (from === to) continue;
		// Match the compact form ("$100M") only — never bare numbers, which could
		// be a round number, a percentage or a year.
		out = out.split(`$${from}M`).join(`$${to}M`);
	}
	return out as T;
}

export function roomScenarios(room?: { scenarios?: Scenario[]; tableBountyTokens?: number } | null): Scenario[] {
	const wallet = room?.tableBountyTokens ?? R2_FULL_BUDGET;
	const withWallet = (s: Scenario): Scenario =>
		wallet === R2_FULL_BUDGET
			? s
			: {
					...s,
					hint: retargetWalletCopy(s.hint, wallet),
					modelRules: retargetWalletCopy(s.modelRules, wallet),
					actions: retargetWalletCopy(s.actions, wallet)
				};
	if (!room?.scenarios?.length) return SCENARIOS.map(withWallet);
	return SCENARIOS.map((s, i) => {
		const over = room.scenarios![i];
		return withWallet(over ? { ...s, ...over, round: i, roundLabel: i + 1 } : s);
	});
}

/**
 * Host-editable board option labels (7 priorities). Empty slots fall back to PRIORITIES.
 */
export function roomPriorities(room?: { priorities?: string[] } | null): string[] {
	if (!room?.priorities?.length) return [...PRIORITIES];
	return PRIORITIES.map((def, i) => {
		const over = room.priorities![i];
		const t = typeof over === 'string' ? over.trim() : '';
		return t || def;
	});
}

/**
 * Budget arc (per table, $10M chips), at the default $100M wallet:
 *   R1  place ~$30M (open)
 *   R2  reach full $100M — capture
 *   R3  remove $30M → ~$70M protected — capture
 *   R4  get back +$20M → ~$90M — hold
 *   R5  restructure up to $90M final — capture
 * The constants below are the DEFAULT-wallet ($100M) values for display copy and
 * fallbacks. Seal/cap checks must derive from the actual wallet via the helpers
 * below, because roomBountyTokens is host-editable (wallet = floor(room/tables)).
 */
export const R2_FULL_BUDGET = 100;
export const R3_REMOVE_TARGET = 30;
export const R5_RESTRUCTURE_CAP = 90;

/** R3 seal: remove this fraction of the standing total (30% = $30M of $100M). */
export const R3_REMOVE_FRACTION = 0.3;
/** R5 restructure: cap the board at this fraction of the wallet (90% = $90M of $100M). */
export const R5_CAP_FRACTION = 0.9;

/** R3 seal target in tokens — must remove ≥ 30% of the standing total. */
export function r3RemoveTarget(standing: number): number {
	return Math.ceil(Math.max(0, standing) * R3_REMOVE_FRACTION);
}

/** R5 restructure cap in tokens — 90% of the per-table wallet. */
export function r5CapForWallet(wallet: number): number {
	return Math.min(wallet, Math.floor(wallet * R5_CAP_FRACTION));
}

/** Host/presenter + mobile — cumulative board; each round adds or removes. */
export const SCENARIOS: Scenario[] = [
	{
		round: 0,
		roundLabel: 1,
		title: 'R1 · Business Growth',
		emoji: '📈',
		question: 'The business plans to grow 30%. Where would you invest first?',
		hint: 'First stake — about $30M of your $100M wallet.',
		mode: 'wait',
		move: 'add',
		instruction: 'Where would you invest first?',
		modelRules: 'Table wallet $100M. Place ~$30M. No seal yet.',
		actions: 'Physical board first → freeze → match digital.',
		experience:
			'The opening lens — establishes your function’s declared priorities without pressure. What we measure: baseline bias / where your function places the *first* dollar.'
	},
	{
		round: 1,
		roundLabel: 2,
		title: 'R2 · AI Transformation',
		emoji: '🤖',
		question: 'AI changes how everyone works. What deserves greater investment?',
		hint: 'Physical board = your full $100M.',
		mode: 'capture',
		move: 'add',
		instruction: 'What deserves greater investment?',
		modelRules: 'Board total must be $100M to seal.',
		actions: 'Physical full $100M → freeze → digital → seal.',
		experience:
			'Full stake — every function commits under the AI transformation lens. What we measure: CGI peak, lead, fault. The room converges on a leadership story.'
	},
	{
		round: 2,
		roundLabel: 3,
		title: 'R3 · Cost pressure: Breaking News',
		emoji: '✂️',
		question:
			'Breaking News — the AI CEO interrupts. The Board reduces your budget from $100M to $70M. Remove 30 tokens. This forces real trade-offs.',
		hint: 'Remove $30M on the physical board. What stays is protected.',
		mode: 'capture',
		move: 'remove',
		instruction: 'Remove 30 tokens.',
		modelRules: 'Remove only. Cut $30M to seal. Remainder protected.',
		actions: 'Physical remove $30M → freeze → digital → seal.',
		experience:
			'What you protect under pressure. What we measure: the *protected* and *contested* lists — which priorities each function refused to give up, and which priorities divided the room.'
	},
	{
		round: 3,
		roundLabel: 4,
		title: 'R4 · Talent Crisis',
		emoji: '🌟',
		question: 'Your best employees are leaving. You recover 20 tokens. Where do you reinvest?',
		hint: 'Add $20M back on the physical board. Hold for R5.',
		mode: 'hold',
		move: 'add',
		instruction: 'Recover 20 tokens.',
		modelRules: 'Add ~$20M. Save without seal.',
		actions: 'Physical +$20M → freeze → digital → save.',
		experience:
			'Capital returns after the cut. What we measure: the *reprioritisation* — which priorities regained weight, and which stayed cut.'
	},
	{
		round: 4,
		roundLabel: 5,
		title: 'R5 · Final Recommendation',
		emoji: '🎯',
		question:
			'Your department submits ONE investment strategy to the Executive Committee. Where do you double down?',
		hint: 'Restructure the physical board to a final $90M mix.',
		mode: 'capture',
		move: 'add',
		instruction: 'Submit your final recommendation.',
		modelRules: 'Final board ≤ $90M. Last seal.',
		actions: 'Physical restructure to $90M → freeze → digital → seal.',
		experience:
			'The synthesis. What we measure: the final mix — where each function doubles down after seeing the room’s strategy.'
	}
];
