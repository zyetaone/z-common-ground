import type { Persona, Scenario, Vec7 } from './types';

export const PERSONAS: Persona[] = [
	{
		seat: 0,
		name: 'Real Estate',
		lens: 'Optimise portfolio & reduce footprint',
		color: '#E0A458',
		bias: [0, 0, 1, 1, 0, 3, 2],
		mission: 'Reduce footprint. Optimise portfolio.',
		strength: 'Strong portfolio optimization & footprint efficiency.',
		risk: 'May constrain growth or space flexibility.'
	},
	{
		seat: 1,
		name: 'HR',
		lens: 'Optimise people & employee engagement',
		color: '#E0665A',
		bias: [3, 2, 1, 0, 0, 0, 0],
		mission: 'Increase employee engagement. Optimise people.',
		strength: 'Excellent employee proposition.',
		risk: 'Limited financial justification.'
	},
	{
		seat: 2,
		name: 'IT',
		lens: 'Optimise technology & AI adoption',
		color: '#3FB6A2',
		bias: [1, 3, 1, 1, 1, 0, 1],
		mission: 'Accelerate AI adoption. Optimise technology.',
		strength: 'Highly future-focused.',
		risk: 'Workplace experience may become overly technology-centric.'
	},
	{
		seat: 3,
		name: 'Finance',
		lens: 'Optimise cost & commercial discipline',
		color: '#5AA9E6',
		bias: [1, 0, 0, 1, 0, 3, 1],
		mission: 'Reduce operating cost by 20%. Optimise cost.',
		strength: 'Strong commercial discipline.',
		risk: 'Under-investment in people and innovation.'
	},
	{
		seat: 4,
		name: 'Operations',
		lens: 'Optimise resilience & execution speed',
		color: '#7E8CE0',
		bias: [0, 0, 0, 2, 1, 2, 3],
		mission: 'Improve resilience. Optimise resilience.',
		strength: 'High operational resilience & speed.',
		risk: 'Focus on immediate continuity may delay strategic transformation.'
	},
	{
		seat: 5,
		name: 'Marketing',
		lens: 'Optimise brand & employer proposition',
		color: '#E574B0',
		bias: [2, 1, 3, 0, 1, 0, 0],
		mission: 'Strengthen employer brand. Optimise brand.',
		strength: 'Strong employer brand & market positioning.',
		risk: 'Emphasis on brand perception over functional efficiency.'
	},
	{
		seat: 6,
		name: 'C-Suite',
		lens: 'Optimise enterprise value & growth',
		color: '#C9A227',
		bias: [2, 0, 0, 2, 2, 0, 2],
		mission: 'Increase enterprise value. Optimise enterprise value.',
		strength: 'Maximizes total enterprise value.',
		risk: 'High-level focus may obscure department-level friction.'
	}
];

export const SEATS = PERSONAS.map((p) => p.name);
export const SEAT_COLORS = PERSONAS.map((p) => p.color);
export const SEAT_LENS = PERSONAS.map((p) => p.lens);
export const SEAT_MISSIONS = PERSONAS.map((p) => p.mission);
export const SEAT_BIAS: Vec7[] = PERSONAS.map((p) => p.bias);
export const N_SEATS = PERSONAS.length;

/** Priority heat / mix bars — one palette for portrait, winners, future. */
export const PRIORITY_COLORS = [
	'#8Fb4d6',
	'#37b6a2',
	'#b98cd6',
	'#e7bd6b',
	'#7E8CE0',
	'#e0554b',
	'#6fae8f'
] as const;

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

/** Physical chip denomination — single $10M token. */
export const CHIP_DENOMS = [
	{ color: 'red', value: 10, hex: '#e0554b' }
] as const;
export type ChipDenom = (typeof CHIP_DENOMS)[number];
/** The one and only chip — $10M. */
export const CHIP_VALUE = 10;
export const EVOLUTION_ROUNDS = [2, 3, 5] as const;
export const CAPTURE_ROUNDS = [2, 3, 5] as const;
export const SPACE = [
	'Employee experience hubs & wellness zones',
	'Collaboration zones & agile project spaces',
	'IT infrastructure, tech integration & AI labs',
	'Commercial optimization & cost-efficient layouts',
	'Operational resilience & workflow execution areas',
	'Brand showcase & client experience suites',
	'C-Suite strategic decision rooms & executive suites'
];

export const DESIGN_LONG = [
	'Focus on human-centric design, wellness rooms, ergonomic workstations, and high-touch employee amenities.',
	'Designed with flexible team pods, whiteboard walls, agile project spaces, and collaborative breakout zones.',
	'High-density digital infrastructure, AI tech labs, smart sensors, and high-speed connectivity nodes.',
	'Space-efficient workstation layouts, durable finishes, and optimized square footage to reduce overhead.',
	'Resilient 24/7 operational hubs, secure server facilities, and high-reliability workflow staging areas.',
	'High-impact brand reception, immersive client presentation suites, and external-facing experience zones.',
	'Executive boardrooms, private strategic suites, and high-security leadership conference spaces.'
];

export const DESIGN_SHORT = [
	'Employee wellness & experience',
	'Agile team collaboration',
	'AI & tech infrastructure',
	'Cost-optimized layout',
	'Resilient operational hubs',
	'Brand experience suites',
	'Executive leadership suites'
];

export function isCaptureRound(roundLabel1Based: number): boolean {
	return (CAPTURE_ROUNDS as readonly number[]).includes(roundLabel1Based);
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
 * Merge runtime scenario overrides with static defaults.
 * If room.scenarios[i] exists, use it; otherwise fall back to SCENARIOS[i].
 */
export function roomScenarios(room?: { scenarios?: Scenario[] } | null): Scenario[] {
	if (!room?.scenarios?.length) return SCENARIOS;
	return SCENARIOS.map((s, i) => {
		const over = room.scenarios![i];
		return over ? { ...s, ...over, round: i, roundLabel: i + 1 } : s;
	});
}

/** Host/presenter + mobile — cumulative board; each round adds or removes. */
export const SCENARIOS: Scenario[] = [
	{
		round: 0,
		roundLabel: 1,
		title: 'R1 · The Year-One Test',
		emoji: '🎯',
		question: 'Which element do you build the year-one business case around?',
		hint: 'Each table has $100M across 5 rounds. Start by allocating ~$30M — where would you invest first?',
		mode: 'wait',
		move: 'add',
		instruction: 'R1 · ADD ~$30M · first stake',
		modelRules: 'Boards are cumulative across all 5 rounds. Per-table cap = floor(roomBudget / tables). R1 has no freeze or capture — just place. All 7 priorities are open.',
		actions: '1. Read your function mission and lens.\n2. Discuss with your table: where does the first ~$30M go?\n3. Place physical tokens on the board.\n4. Mirror on the digital board.\n5. Presenter advances when all tables are ready.',
		experience: 'Your opening move. Each function brings a lens — Real Estate wants the floorplate, HR wants the people. This is not "what would your function buy alone" — it is "what opens the conversation." Your first $30M sets the tone for every round that follows.'
	},
	{
		round: 1,
		roundLabel: 2,
		title: 'R2 · The Hollow Culture',
		emoji: '➕',
		question: 'Hybrid hollowed culture. What rebuilds cohesion?',
		hint: 'Place all tokens on your physical board, then position the digital board to match. Cumulative — boards carry forward (~$100M total).',
		mode: 'capture',
		move: 'add',
		instruction: 'R2 · ADD ~$70M · cumulative · CAPTURE',
		modelRules: 'Add only. Per-table cap applies. Cumulative with R1. This is a capture round — your position is frozen and sealed for analysis. Must match physical board to digital before submitting.',
		actions: '1. Place remaining physical tokens to reach ~$100M total.\n2. Tap Freeze when your physical board is set.\n3. Match the digital board to exactly mirror your physical tokens.\n4. Submit to seal your board.\n5. Wait for the presenter to advance.',
		experience: 'Hybrid work has hollowed the culture. People are in different places — literally and relationally. What rebuilds the connective tissue? This is the first round where the room sees its Common Ground Index — how much do these 7 functions actually agree? The score after R2 tells you whether the room is aligned or fractured, and the conversation that follows is often the most revealing of the session.'
	},
	{
		round: 2,
		roundLabel: 3,
		title: 'R3 · The Rival HQ',
		emoji: '➖',
		question: "A competitor's HQ is poaching talent. What do you take off the table?",
		hint: 'After removing tokens physically, update the digital board to match. What stays is PROTECTED.',
		mode: 'capture',
		move: 'remove',
		instruction: 'R3 · REMOVE ~$30M · protect what remains',
		modelRules: 'Remove only. Cannot add tokens — cap is your standing total from R2. Must freeze before editing. Cumulative — what stays is protected for the rest of the game. Capture round.',
		actions: '1. Remove ~$30M worth of physical tokens from your board.\n2. Tap Freeze when your physical board is set.\n3. Match the digital board to your physical removals.\n4. Submit to seal.\n5. What stays is PROTECTED — think carefully.',
		experience: 'A competitor opened across the street and talent is walking. This is the hardest round — forcing every function to reveal what they would cut. The priorities that survive R3 are the ones your table is willing to protect under pressure. Watch closely: this round surfaces the room\'s fault line. Where functions disagree about what to cut, you have found the real divide. The presenter will call it out.'
	},
	{
		round: 3,
		roundLabel: 4,
		title: 'R4 · The Ghost Office',
		emoji: '➕',
		question: 'Half-empty Mon/Fri. What justifies the footprint?',
		hint: 'Add tokens to your physical board, then mirror on digital. Hold for final capture in R5.',
		mode: 'hold',
		move: 'add',
		instruction: 'R4 · ADD ~$20M · HOLD for R5',
		modelRules: 'Add only. Per-table cap applies. Hold round — save without sealing. Cumulative with R3. No freeze required. Your position carries into R5 for the final capture.',
		actions: '1. Add ~$20M in physical tokens.\n2. Mirror on the digital board.\n3. Save your board — no seal, position holds.\n4. You get one more chance to adjust in R5.',
		experience: 'Monday and Friday are ghost towns. The footprint is half-used but the lease is long. What actually justifies the space? This is the pragmatism round — functions who over-indexed on real estate in early rounds may shift. The room gets one more nudge before the final bet. Use this round to close the gap between what you said and what you actually need.'
	},
	{
		round: 4,
		roundLabel: 5,
		title: 'R5 · The Five-Year Bet',
		emoji: '➕',
		question: 'AI is embedded. What must the workplace double down on?',
		hint: 'Restructure tokens on your physical board first, then match digital. Final cumulative position — reallocate based on everything learned.',
		mode: 'capture',
		move: 'add',
		instruction: 'R5 · RESTRUCTURE ~$90M · FINAL CAPTURE',
		modelRules: 'Add only. Per-table cap applies. Capture round — final position is sealed. Cumulative across all rounds. Must freeze before editing. This is the last round — no more changes.',
		actions: '1. Restructure tokens on your physical board — reallocate based on everything learned.\n2. Tap Freeze when your board is final.\n3. Match the digital board.\n4. Submit to seal.\n5. This is the room\'s definitive answer.',
		experience: 'AI is embedded. Five years out, work looks different. This is the room\'s final answer — where does capital land when the technology is settled and everything you learned across four rounds is on the table? The Common Ground Index after R5 is what this room actually believes. Everything before was rehearsal. The presenter will now reveal the room\'s lead priority, its fault line, its blind spot, and — if someone surprised everyone — who broke type.'
	}
];
