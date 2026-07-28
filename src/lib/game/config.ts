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

export function tablePersona(tableId: number) {
	return PERSONAS[tableSeatIndex(tableId)] ?? PERSONAS[0];
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
		instruction: 'R1 · ADD ~$30M · first stake'
	},
	{
		round: 1,
		roundLabel: 2,
		title: 'R2 · The Hollow Culture',
		emoji: '➕',
		question: 'Hybrid hollowed culture. What rebuilds cohesion?',
		hint: 'Add ~$30M more onto your R1 board. Cumulative — boards carry forward.',
		mode: 'capture',
		move: 'add',
		instruction: 'R2 · ADD ~$30M · cumulative · CAPTURE'
	},
	{
		round: 2,
		roundLabel: 3,
		title: 'R3 · The Rival HQ',
		emoji: '➖',
		question: "A competitor's HQ is poaching talent. What do you take off the table?",
		hint: 'Budget cut — remove ~$30M from your board. What stays is PROTECTED.',
		mode: 'capture',
		move: 'remove',
		instruction: 'R3 · REMOVE ~$30M · protect what remains'
	},
	{
		round: 3,
		roundLabel: 4,
		title: 'R4 · The Ghost Office',
		emoji: '➕',
		question: 'Half-empty Mon/Fri. What justifies the footprint?',
		hint: 'Budget partially restored — add ~$15M onto your board. Hold for final capture in R5.',
		mode: 'hold',
		move: 'add',
		instruction: 'R4 · ADD ~$15M · HOLD for R5'
	},
	{
		round: 4,
		roundLabel: 5,
		title: 'R5 · The Five-Year Bet',
		emoji: '➕',
		question: 'AI is embedded. What must the workplace double down on?',
		hint: 'Restructure — you have remaining budget. Reallocate based on everything you learned.',
		mode: 'capture',
		move: 'add',
		instruction: 'R5 · RESTRUCTURE · FINAL CAPTURE'
	}
];
