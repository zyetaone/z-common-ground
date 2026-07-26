import { DESIGN_LONG, DESIGN_SHORT, SPACE } from './config';
import { formatUsd, tokenUnitLabel } from './money';
import { PRIORITIES } from './types';
import type { Aggregate } from './types';
import { sum } from './scoring';

export interface PriorityMix {
	priority: number;
	name: string;
	pct: number;
	tokens: number;
	space: string;
	design: string;
}

/** Exact percentage mix for program + image prompt (sums to 100 when total > 0). */
export function priorityMix(matrix: number[]): PriorityMix[] {
	const total = sum(matrix as number[]);
	if (total <= 0) {
		return PRIORITIES.map((name, priority) => ({
			priority,
			name,
			pct: 0,
			tokens: 0,
			space: SPACE[priority],
			design: DESIGN_LONG[priority]
		}));
	}
	const raw = matrix.map((tokens, priority) => ({
		priority,
		name: PRIORITIES[priority],
		pct: (tokens / total) * 100,
		tokens,
		space: SPACE[priority],
		design: DESIGN_LONG[priority]
	}));
	// Round to integers that still sum 100
	const floored = raw.map((r) => ({ ...r, pct: Math.floor(r.pct) }));
	let rem = 100 - floored.reduce((s, r) => s + r.pct, 0);
	const order = [...raw.keys()].sort((a, b) => raw[b].pct - Math.floor(raw[b].pct) - (raw[a].pct - Math.floor(raw[a].pct)));
	for (let i = 0; i < order.length && rem > 0; i++, rem--) {
		floored[order[i]].pct += 1;
	}
	return floored.sort((a, b) => b.pct - a.pct || b.tokens - a.tokens);
}

/**
 * Image prompt: space composition is explicitly %-weighted so the model
 * tilts the design (e.g. 28% productivity, 15% innovation…).
 */
export function finalePrompt(matrix: number[]): string {
	const mix = priorityMix(matrix).filter((m) => m.pct > 0);
	const composition =
		mix.length > 0
			? mix.map((m) => `${m.pct}% ${m.name.toLowerCase()}`).join(', ')
			: 'balanced collaboration and focus';

	const spatial =
		mix.length > 0
			? mix
					.slice(0, 5)
					.map((m) => `${m.pct}% of the floorplate emphasises ${m.design}`)
					.join('; ')
			: 'balanced multi-zone workplace';

	return [
		'Imagine the future of the workplace — photorealistic architectural visualisation of a forward-thinking interior,',
		'designed for human performance and well-being, with people actively using the space.',
		`Leadership investment mix (money → space): ${composition}.`,
		`Architecture must express where capital went: ${spatial}.`,
		'Higher % priorities dominate floorplate, materials, and focal moments; lower % stay secondary.',
		'Warm materials — timber, soft textiles, matte metal — cinematic natural light.',
		'Wide-angle professional architectural photography, 16:9, no text, logos, charts, or watermarks.'
	].join(' ');
}

/**
 * Table-scoped render (z-corenet style) — one function’s cumulative bets drive the image.
 * `bets` = that function’s 7 priority token counts.
 */
export function tableFunctionPrompt(functionName: string, bets: number[]): string {
	const mix = priorityMix(bets).filter((m) => m.pct > 0);
	const composition =
		mix.length > 0
			? mix.map((m) => `${m.pct}% ${m.name.toLowerCase()}`).join(', ')
			: 'balanced workplace performance';
	const spatial =
		mix.length > 0
			? mix
					.slice(0, 4)
					.map((m) => `${m.pct}% emphasises ${m.design}`)
					.join('; ')
			: 'balanced multi-zone workplace';

	return [
		`Imagine the future of the workplace through the ${functionName} lens — photorealistic interior visualisation.`,
		`This is ${functionName}'s recommended workplace — not a generic office.`,
		`Where their money went: ${composition}.`,
		`Architecture: ${spatial}.`,
		'People using the space; warm materials (timber, textiles, soft metal); cinematic daylight.',
		'Wide-angle 16:9 architectural photo, no text, logos, charts, or watermarks.'
	].join(' ');
}

/** Numbers-only skeleton brief. Empty when no stake — never invent a mandate. */
export function buildEnhancedBrief(agg: Aggregate): string {
	if (agg.totalCoins <= 0) return '';
	const mix = priorityMix(agg.matrix);
	const prog = spatialProgramFromAggregate(agg);
	const lines = [
		`COMMON GROUND — IMAGINE THE FUTURE OF THE WORKPLACE`,
		`Alignment ${agg.alignmentIndex}/100 · ${agg.totalCoins} tok · ${formatUsd(agg.totalCoins)} · ${tokenUnitLabel()}`,
		``,
		`WHERE THE MONEY WENT`,
		...mix
			.filter((m) => m.pct > 0)
			.map((m) => `· ${m.pct}% ${m.name} — ${m.tokens} tok · ${formatUsd(m.tokens)} → ${m.space}`),
		``,
		`MANDATE`,
		prog.mandate,
		``,
		`LEAD / RESOLVE / PROTECT`,
		prog.lead,
		prog.resolve,
		prog.blind,
		``,
		`SPATIAL PROGRAM`,
		...mix
			.filter((m) => m.pct > 0)
			.map((m) => `${m.pct}% · ${m.name}: ${m.design}`)
	];
	if (agg.surprise) {
		lines.push(``, `SURPRISE`, `A function broke type — keep this in the brief narrative.`);
	}
	return lines.join('\n');
}

/** Facts payload for Workers AI — same mix SSOT as UI. */
export function briefFactsForLlm(agg: Aggregate): string {
	if (agg.totalCoins <= 0) return '';
	const mix = priorityMix(agg.matrix).filter((m) => m.pct > 0);
	const prog = spatialProgramFromAggregate(agg);
	return [
		`Total stake: ${agg.totalCoins} tokens (${tokenUnitLabel()}).`,
		`Alignment index: ${agg.alignmentIndex}/100.`,
		`Where the money went: ${mix.map((m) => `${m.pct}% ${m.name} (${m.tokens} tok · ${formatUsd(m.tokens)})`).join('; ')}.`,
		prog.lead,
		prog.resolve,
		prog.blind,
		agg.surprise
			? `Surprise: a function broke type — keep in narrative.`
			: `No surprise token.`,
		`Spatial design hints: ${mix.map((m) => `${m.pct}% ${m.design}`).join('; ')}.`
	].join('\n');
}

export function spatialProgramFromAggregate(agg: Aggregate) {
	const mix = priorityMix(agg.matrix);
	const hasStake = agg.totalCoins > 0;
	const align = PRIORITIES[agg.alignment];
	const fault = PRIORITIES[agg.fault];
	const blind = PRIORITIES[agg.blind];
	const alignPct = mix.find((m) => m.priority === agg.alignment)?.pct ?? 0;

	return {
		hasStake,
		mandate: hasStake
			? `Imagine the future of the workplace: ${alignPct}% of capital on ${align} (${formatUsd(agg.matrix[agg.alignment])}). Program the floor for ${SPACE[agg.alignment].toLowerCase()}.`
			: '',
		program: mix.map((m) => ({
			priority: m.priority,
			name: m.name,
			pct: m.pct,
			space: m.space,
			tokens: m.tokens,
			money: formatUsd(m.tokens)
		})),
		lead: hasStake
			? `Lead with ${align} (${alignPct}% · ${formatUsd(agg.matrix[agg.alignment])}).`
			: '',
		resolve: hasStake
			? `Resolve — ${fault} (${formatUsd(agg.matrix[agg.fault])}).`
			: '',
		blind: hasStake
			? `Protect or de-scope — ${blind} (${formatUsd(agg.matrix[agg.blind])} room-wide).`
			: '',
		features: mix
			.filter((r) => r.tokens > 0)
			.slice(0, 5)
			.map((r) => DESIGN_SHORT[r.priority]),
		alignmentIndex: agg.alignmentIndex,
		/** Where money went — original priority labels + % + $ */
		compositionLine: mix
			.filter((m) => m.pct > 0)
			.map((m) => `${m.pct}% ${m.name} (${formatUsd(m.tokens)})`)
			.join(' · ')
	};
}
