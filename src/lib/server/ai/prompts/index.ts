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

/** Flatten a priority's attribute lexicon into one prompt-ready clause. */
function attrLexiconLine(m: PriorityMix): string {
	const a = m.attrs;
	return `keywords ${a.keywords.join(', ')}; materials ${a.materials}; mood ${a.mood}; colour bias ${a.colorBias}; quietness ${a.quietness}`;
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
		? top
				.slice(0, 4)
				.map((m) => `${m.name} (${m.pct}%): ${attrLexiconLine(m)}`)
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
		'Ultra high-quality photorealistic architectural interior — Common Ground room vision for Zyeta / ZyetaI.',
		'Award-winning workplace photography: cinematic side daylight, warm timber, soft textiles, matte metal, shallow depth where natural.',
		'People using the space naturally — meeting, collaborating, focused work — never staring at camera.',
		`Priority mix → multi-zone floorplate (same ${budget} wallets combined): ${compositionLine(mix)}.`,
		`Preferred zones dominate the plan: ${prefZones || spatialLine(mix)}.`,
		`Floorplate expresses capital: ${spatialLine(mix)}.`,
		`Design language by priority weight: ${attrs}.`,
		`Zone colour branding (subtle, architectural — not logos): ${zonePalette || 'warm neutrals with teal and gold accents'}.`,
		'Higher-% priorities own largest floorplate share, focal materials, and lighting; lower-% stay secondary rooms off the main axis.',
		'Show distinct zones in one wide view — open collaboration, focus, wellness, tech, and brand moments sized by weight.',
		'Cost/ROI-heavy mix: lean efficient layouts. Employee Experience-heavy: quiet wellness. Innovation-heavy: labs and modular pods.',
		'Wide-angle 16:9 architectural photograph, 2K clarity, no charts, no UI chrome.',
		'No text anywhere in the image: no labels, no captions, no watermarks, no corporate logos — pure architecture.'
	].join(' ');
}

/** Table-scoped render — one function’s priority mix as their workplace look. */
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
		.map((m) => `${m.pct}% ${m.name} (${formatUsd(m.tokens)}, colour ${m.color}): ${attrLexiconLine(m)}.`)
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
