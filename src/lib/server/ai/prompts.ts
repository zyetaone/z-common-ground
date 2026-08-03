/**
 * AI prompt builders — the text we send to fal (images) and RapidI (brief).
 *
 * These live in `server/ai/` and NOT in `game/` on purpose. Prompt copy is
 * brand voice, not game rules: it changes for tone, model quirks and vendor
 * limits, none of which are domain concerns. Keeping it here means the pure
 * domain has no opinion about which model we happen to use, and the prompt
 * text is reviewable in one place by someone who isn't reading scoring code.
 *
 * Everything below is a pure function of domain data — no fetch, no bindings —
 * so it stays unit-testable without a Worker.
 */
import {
	PRIORITIES,
	compositionLine,
	formatUsd,
	priorityMix,
	roomInsights,
	roomPersonas,
	roomPriorities,
	roomRoundStory,
	spatialProgramFromAggregate,
	walletLabel,
	workspaceZonesFromMatrix,
	type PriorityMix
} from '$lib/game';
import type { Aggregate, RoomState } from '$lib/game/types';
import type { DesignCard } from '$lib/game/brief';

/** Priorities with any stake — prompts should never describe an empty zone. */
const nonZero = (mix: PriorityMix[]) => mix.filter((m) => m.pct > 0);

/** "28% of the floorplate emphasises …" — prompt phrasing for the zone mix. */
function spatialLine(mix: PriorityMix[], n = 5, short = false): string {
	const m = nonZero(mix).slice(0, n);
	if (!m.length) return 'balanced multi-zone workplace';
	return m
		.map((x) =>
			short
				? `${x.pct}% emphasises ${x.design}`
				: `${x.pct}% of the floorplate emphasises ${x.design}`
		)
		.join('; ');
}

/**
 * How much of a priority's vocabulary to spend, given its share of the room.
 *
 * The old line emitted every attribute at full length for the top 4 priorities,
 * which had two effects: a 40% lead and a 10% also-ran contributed the same
 * amount of text (so money did not visibly shape the render), and four
 * competing colour/mood/acoustic directions arrived at once. A near-flat room
 * and a Talent-led room produced byte-identical design instructions.
 *
 * Now the depth of description tracks the stake:
 *   lead (or >=25%) — full vocabulary, and it alone sets the whole-room
 *                     properties (palette, mood, acoustics), because a room has
 *                     exactly one of each.
 *   >=12%           — keywords + materials: a real zone with its own finish.
 *   below that      — two keywords: present, but a secondary room off the axis.
 */
function attrLexiconLine(m: PriorityMix, opts: { lead: boolean }): string {
	const a = m.attrs;
	if (opts.lead || m.pct >= 25) {
		return [
			`keywords ${a.keywords.join(', ')}`,
			`materials ${a.materials}`,
			`sets the room mood: ${a.mood}`,
			`drives the palette: ${a.colorBias}`,
			`sets the acoustic character: ${a.quietness}`
		].join('; ');
	}
	if (m.pct >= 12) {
		return `keywords ${a.keywords.slice(0, 4).join(', ')}; materials ${a.materials}`;
	}
	return `accents only — ${a.keywords.slice(0, 2).join(', ')}`;
}

/**
 * Image prompt: space composition is %-weighted; attribute keywords scale with stake.
 */
export function finalePrompt(
	matrix: number[],
	opts?: { labels?: readonly string[]; budgetLabel?: string }
): string {
	const budget = opts?.budgetLabel ?? '$100M';
	const mix = priorityMix(matrix, opts?.labels);
	const top = nonZero(mix);
	const attrs = top.length
		? // Every funded priority appears, not just the top 4 — dropping the tail
			// made ~35% of the room's money invisible in the render. Depth of
			// description scales with stake instead (see attrLexiconLine).
			top
				.map((m, i) => `${m.name} (${m.pct}%): ${attrLexiconLine(m, { lead: i === 0 })}`)
				.join(' | ')
		: 'balanced materials and calm acoustics';

	const zones = workspaceZonesFromMatrix(matrix, opts?.labels);
	const prefZones = zones
		.filter((z) => z.preferred)
		.map((z) => `${z.pct}% ${z.zone} (${z.colourBias})`)
		.join('; ');
	const zonePalette = zones
		.slice(0, 5)
		.map((z) => `${z.name} zone accent ${z.color}`)
		.join(', ');

	return [
		// Lead with the artefact type. Test renders came back as annotated
		// diagrams and as 6-panel collages, because the per-priority breakdown
		// below reads like a spec sheet and invites one. Say what this is, and
		// what it is not, before describing content.
		'A single photograph of one real interior, taken from one camera position.',
		'NOT a collage, NOT a grid, NOT a multi-panel board, NOT a diagram, NOT an annotated floorplan, NOT a moodboard. One continuous room, one viewpoint.',
		'Ultra high-quality photorealistic architectural interior — Common Ground room vision for Zyeta / ZyetaI.',
		'Award-winning workplace photography: cinematic side daylight, warm timber, soft textiles, matte metal, shallow depth where natural.',
		'People using the space naturally — meeting, collaborating, focused work — never staring at camera.',
		// The mix below describes what to BUILD, not what to caption. The model
		// otherwise renders the percentages as on-image labels.
		'The following describes what to build and how much floor area each use gets. Express it purely as architecture — never as written labels, callouts or percentages drawn on the image.',
		`Priority mix → multi-zone floorplate (same ${budget} wallets combined): ${compositionLine(mix)}.`,
		`Preferred zones dominate the plan: ${prefZones || spatialLine(mix)}.`,
		`Floorplate expresses capital: ${spatialLine(mix)}.`,
		`Design language by priority weight: ${attrs}.`,
		`Zone colour branding (subtle, architectural — not logos): ${zonePalette || 'warm neutrals with teal and gold accents'}.`,
		'Higher-% priorities own largest floorplate share, focal materials, and lighting; lower-% stay secondary rooms off the main axis.',
		'All zones are visible together in one uninterrupted wide shot, flowing into each other across the same floor — open collaboration, focus, wellness, tech and brand moments sized by weight.',
		'Wide-angle 16:9 architectural photograph, 2K clarity, no charts, no UI chrome, no borders, no split frames.',
		'No text anywhere in the image: no labels, no captions, no percentages, no annotations, no watermarks, no corporate logos — pure architecture.'
	].join(' ');
}

/** Table-scoped render — one function's priority mix as their workplace look. */
export function tableFunctionPrompt(
	functionName: string,
	bets: number[],
	opts?: { labels?: readonly string[]; budgetLabel?: string }
): string {
	const budget = opts?.budgetLabel ?? '$100M';
	const mix = priorityMix(bets, opts?.labels);
	const top = nonZero(mix)[0];
	const attrLine = top
		? `Dominant look from ${top.name}: ${top.attrs.keywords.join(', ')}; materials ${top.attrs.materials}; mood ${top.attrs.mood}; quietness ${top.attrs.quietness}; colour ${top.attrs.colorBias}.`
		: '';

	const zones = workspaceZonesFromMatrix(bets, opts?.labels);
	const pref = zones
		.filter((z) => z.preferred)
		.map((z) => `${z.pct}% ${z.zone}`)
		.join('; ');
	const brand = top
		? `Brand colour cues from ${top.name}: ${top.color}; mood ${top.attrs.mood}; materials ${top.attrs.materials}.`
		: '';

	return [
		`Ultra high-quality photorealistic workplace interior if ${functionName} set all priorities with a full ${budget} budget — ZyetaI concept lens.`,
		`Not a generic office — ${functionName} priority shape only; not the room average.`,
		`Their mix: ${compositionLine(mix)}.`,
		`Preferred zones for this function: ${pref || spatialLine(mix, 4, true)}.`,
		`Architecture: ${spatialLine(mix, 4, true)}.`,
		attrLine,
		brand,
		'Multi-zone floorplate in one frame — zone sizes follow their $ weight; secondary zones read smaller.',
		'People using the space; cinematic daylight; materials and soft colour accents match the mix.',
		'Wide-angle 16:9 architectural photo, 2K clarity, no charts, no UI chrome, no corporate logos.',
		'No text anywhere in the image: no labels, no captions, no watermarks — pure architecture.'
	].join(' ');
}

/**
 * System prompt for the executive brief.
 *
 * Lives here with the user-message builders rather than beside the fetch in
 * rapidi.ts: a system prompt is brand voice, and this file is the one place
 * that voice is meant to be reviewable without reading transport code.
 */
export const BRIEF_SYSTEM = `You are ZyetaI for Zyeta Common Ground (CoreNet boardroom).
Answer: where would each function spend their $100M, where is Common Ground, and what would that workplace look like.
Use the priority mix, lead, fault, blind, surprise, and journey facts in the user message.
Methodology note: this is a facilitated exercise. All 7 functions carry equal weight regardless of organisational size or budget authority. Alignment (CGI) is mean pairwise cosine similarity. "Lead" uses breadth of support; "fault" uses variance; "blind" is lowest-funded. These are directional signals from a structured conversation, not deterministic conclusions. Acknowledge this framing naturally — do not over-caveat but do not present the numbers as scientific fact.
Voice: crisp, senior, specific. No bullets of generic adjectives. Prefer one bold sentence over five hedged ones.
Under 320 words. Sharp. Visual.`;

/** Complete brief after every function image exists — recombine design JSON cards. */
export const COMPOSE_SYSTEM = `You are ZyetaI. Design JSON cards reverse-engineered from each render:
read them and describe the workplace as a single coherent narrative.
Per-priority zone description first, then the room synthesis, then the open design question.
Under 450 words. Sound like a workplace strategist describing space, not a spreadsheet.`;

/**
 * Facts for Workers AI — analysis + attribute keywords + journey.
 * Prefer room so CGI / fault / surprise stay SSOT with the deck.
 */
export function briefFactsForRapidi(agg: Aggregate, room?: RoomState | null): string {
	if (agg.totalCoins <= 0) return '';
	const labels = roomPriorities(room);
	const personas = roomPersonas(room);
	const mix = nonZero(priorityMix(agg.matrix, labels));
	const prog = spatialProgramFromAggregate(agg, room);
	const insights = room ? roomInsights(room) : null;

	const analysisBlock = insights
		? [
				`ANALYSIS (use these as truth — do not invent numbers)`,
				`Common Ground Index: ${insights.index}/100 → verdict ${insights.verdict}.`,
				`Lead: ${insights.lead}. Fault (divide): ${insights.fault}. Blind: ${insights.blind} (${formatUsd(insights.blindTokens)}).`,
				insights.arc ? `Room arc: ${insights.arc.line}` : '',
				insights.surprise
					? `Surprise: ${personas[insights.surprise.seat]?.name ?? 'A function'} → ${insights.surprisePriority ?? labels[insights.surprise.priority]}.`
					: `Surprise: none — functions stayed on-type.`,
				`Table alignment (function ↔ room): ${insights.tables.map((t) => `${t.name} ${t.commonGround}/100`).join('; ')}.`,
				insights.journey.length
					? `Journey alignment by round: ${insights.journey.map((j) => `R${j.r}=CGI ${j.cgi} (${j.lead})`).join(', ')}.`
					: '',
				// Round story (assumed / protected / cut / reprioritised) — same SSOT as deck screen 2
				(() => {
					if (!room) return '';
					const s = roomRoundStory(room);
					if (!s.ready && !s.assumed) return '';
					return [
						`ROUND STORY: ${s.headline}`,
						s.assumed ? `Assumed (R${s.assumed.round}): ${s.assumed.name}.` : '',
						s.protected.length
							? `Protected under cut: ${s.protected.map((p) => p.name).join(', ')}.`
							: '',
						s.cut.length ? `Cut: ${s.cut.map((p) => `${p.name} ${p.deltaPts}pts`).join(', ')}.` : '',
						s.reprioritised.length
							? `Reprioritised: ${s.reprioritised.map((p) => `${p.name} +${p.deltaPts}pts`).join(', ')}.`
							: ''
					]
						.filter(Boolean)
						.join(' ');
				})()
			]
				.filter(Boolean)
				.join('\n')
		: [
				`Alignment index: ${agg.alignmentIndex}/100.`,
				prog.lead,
				prog.resolve,
				prog.blind,
				agg.surprise
					? `Surprise: ${personas[agg.surprise.seat]?.name ?? 'A function'} → ${labels[agg.surprise.priority]}.`
					: `No surprise token.`
			].join('\n');

	const attrBlock = mix
		.map(
			(m, i) =>
				`${m.pct}% ${m.name} (${formatUsd(m.tokens)}, colour ${m.color}): ${attrLexiconLine(m, { lead: i === 0 })}.`
		)
		.join('\n');

	return [
		`GAME THESIS: Each of ${personas.length} functions had the same ${walletLabel(room)} wallet. The question is where they prioritised — not who spent more.`,
		`Room mix (shape of all ${walletLabel(room)} bets combined): ${mix.map((m) => `${m.pct}% ${m.name}`).join('; ')}.`,
		analysisBlock,
		`WHAT THE MIX LOOKS LIKE — attribute lexicon (higher % = more of this in the workplace):`,
		attrBlock,
		`Spatial design hints: ${mix.map((m) => `${m.pct}% ${m.design}`).join('; ')}.`,
		`Write for a CoreNet boardroom. Answer: where would they spend, what would that workplace look like, where is Common Ground? End with one open design question.`
	].join('\n\n');
}

/** Compact JSON string for LLM input (design DNA + analytics of every render). */
export function designCardsJsonForRapidi(cards: DesignCard[]): string {
	return JSON.stringify(
		cards.map((c) => ({
			kind: c.kind,
			function: c.functionName,
			tableId: c.tableId,
			color: c.color,
			hasImage: !!c.imageUrl,
			lead: c.lead,
			leadPct: c.leadPct,
			mix: c.mix.map((m) => ({
				priority: m.priority,
				pct: m.pct,
				keywords: m.keywords,
				mood: m.mood,
				materials: m.materials,
				colourBias: m.colourBias,
				quietness: m.quietness,
				design: m.design
			})),
			spatial: c.spatial,
			zones: c.zones,
			requirements: c.requirements,
			analytics: c.analytics,
			vsRoom: c.vsRoom
				? {
						pushes: c.vsRoom.pushes,
						shares: c.vsRoom.shares,
						underweights: c.vsRoom.underweights,
						note: c.vsRoom.note
					}
				: undefined
		})),
		null,
		0
	);
}
