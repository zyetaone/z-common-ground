<script lang="ts">
	import type { RoomState } from '$lib/game/types';
import {
		PRIORITY_COLORS,
		functionProfile,
		priorityMix,
		roomPersonas,
		roomPriorities,
		tableSeatIndex
	} from '$lib/game';
	import type { FunctionProfileTrait } from '$lib/game/scoring';
	import FunctionProfileSheet from './FunctionProfileSheet.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { RadarChart } from '$lib/components/analytics';

	/**
	 * Screen 5 — Per function. Cards sorted by alignment, with archetype + tags + top divergence. Profile sheet for depth.
	 */
	let { room }: { room: RoomState } = $props();

	const labels = $derived(roomPriorities(room));
	const hasData = $derived(room.aggregate.totalCoins > 0);
	const roomMix = $derived(
		priorityMix(room.aggregate.matrix, labels).filter((m) => m.pct > 0)
	);

	/** Profile per function — sorted by alignment descending (most aligned first).
	 *  Each row carries its alignment score + the persona's tags + top divergence. */
	type CardRow = {
		tableId: number;
		name: string;
		color: string;
		cg: number;
		archetype: string;
		topDivergence: { name: string; delta: number; color: string };
		traits: FunctionProfileTrait[];
	};
	const rows = $derived.by((): CardRow[] => {
		const personas = roomPersonas(room);
		const cards: CardRow[] = [];
		for (const t of room.tables) {
			if ((t.matrix ?? []).reduce((s, n) => s + n, 0) <= 0) continue;
			const id = t.id;
			const seat = tableSeatIndex(id);
			const persona = personas[seat] ?? personas[0];
			if (!persona) continue;
			const profile = functionProfile(room, id);
			const cg = profile?.commonGround ?? 0;
			const archetype = profile?.archetype ?? '—';
			const traits = profile?.traits ?? [];
			cards.push({
				tableId: id,
				name: persona.name,
				color: persona.color,
				cg,
				archetype,
				topDivergence: topDelta(id),
				traits
			});
		}
		return cards.sort((a, b) => b.cg - a.cg);
	});

	/** Tables with no stake are excluded from the insights — surface the count. */
	const excludedCount = $derived(room.tables.length - rows.length);

	function tableMixPct(tableId: number): number[] {
		const t = room.tables.find((x) => x.id === tableId);
		const mix = priorityMix(t?.matrix ?? [], labels);
		return labels.map((_, i) => mix.find((m) => m.priority === i)?.pct ?? 0);
	}

	const roomPct = $derived(labels.map((_, i) => roomMix.find((m) => m.priority === i)?.pct ?? 0));

	/** Single strongest divergence (table − room) */
	function topDelta(tableId: number): { name: string; delta: number; color: string } {
		const tp = tableMixPct(tableId);
		let best: { name: string; delta: number; color: string } = {
			name: '—',
			delta: 0,
			color: PRIORITY_COLORS[0] as string
		};
		for (let i = 0; i < labels.length; i++) {
			const delta = (tp[i] ?? 0) - (roomPct[i] ?? 0);
			if (Math.abs(delta) > Math.abs(best.delta)) {
				best = {
					name: labels[i] ?? '—',
					delta,
					color: (roomMix.find((m) => m.priority === i)?.color ?? PRIORITY_COLORS[i]) as string
				};
			}
		}
		return best;
	}

	let open = $state(false);
	let selectedId = $state<number | null>(null);
	const profile = $derived(selectedId != null ? functionProfile(room, selectedId) : null);

	function openTable(tableId: number) {
		selectedId = tableId;
		open = true;
	}
	const mostAligned = $derived(rows[0]);
	const mostDivergent = $derived(rows[rows.length - 1]);
</script>

<div class="fp">
	{#if !hasData}
		<p class="empty">Waiting for stake — tables place chips, the analysis builds here.</p>
	{:else}
		<!-- ── Executive Function Insights Header ── -->
		<header class="fp-hdr">
			{#if excludedCount > 0}
				<p class="fp-note">{excludedCount} {excludedCount === 1 ? 'table' : 'tables'} no stake yet</p>
			{:else}
				{#if mostAligned}
					<div class="fp-insight" style="--c:{mostAligned.color}">
						<span class="fp-tag"><Icon name="handshake" size={12} /> Most Aligned Ally</span>
						<strong class="fp-title">{mostAligned.name} ({mostAligned.cg}/100)</strong>
						<span class="fp-sub">Closest match to room mix</span>
					</div>
				{/if}
				{#if mostDivergent}
					<div class="fp-insight div" style="--c:{mostDivergent.color}">
						<span class="fp-tag"><Icon name="lightning" size={12} /> Independent Lens</span>
						<strong class="fp-title">{mostDivergent.name} ({mostDivergent.cg}/100)</strong>
						<span class="fp-sub">
							Diverges on {mostDivergent.topDivergence.name} ({mostDivergent.topDivergence.delta > 0 ? '+' : ''}{mostDivergent.topDivergence.delta}%)
						</span>
					</div>
				{/if}
			{/if}
		</header>

		<section class="room-strip" aria-label="Combined room mix">
			<div class="mix-track">
				{#each roomMix as m (m.priority)}
					<div
						class="mix-seg"
						style="width:{m.pct}%;background:{m.color}"
						title="{m.name} {m.pct}%"
					>
						{#if m.pct >= 12}
							<span>{m.name}</span>
						{/if}
					</div>
				{/each}
			</div>
			<span class="rs-cap">Room mix</span>
		</section>

	<div class="grid stagger">
		{#each rows as r, ri (r.tableId)}
			<button
				type="button"
				class="card"
				style="--fn:{r.color}; --i:{ri}"
				onclick={() => openTable(r.tableId)}
			>
				<header>
					<span class="dot"></span>
					<span class="fn">{r.name}</span>
					<span class="align" title="Alignment to room">{r.cg}</span>
				</header>
				<div class="align-bar" aria-hidden="true">
					<div class="align-fill" style="width:{Math.max(4, r.cg)}%"></div>
				</div>
				<div class="card-body-row">
					<div class="card-info">
						<!-- No tag chips here. Every tag is a threshold on a number the card
						     already shows: "Sure-handed" is conviction >= 45, which is the
						     radar's Sure spoke; "Portfolio" is breadth >= 70, the Breadth
						     spoke; "Room-aligned" is the alignment score in the header. The
						     archetype is the one-line read, the radar is the shape, and the
						     tags said both again in threshold words. They still appear on the
						     profile sheet, where the detail belongs. -->
						<p class="archetype">{r.archetype}</p>
						<p class="delta" style="--dc:{r.topDivergence.color}">
							<span class="dlab">vs room</span>
							<span class="dval"
								>{r.topDivergence.name}
								<b>{r.topDivergence.delta > 0 ? '+' : ''}{r.topDivergence.delta}%</b></span
							>
						</p>
					</div>
					{#if r.traits.length > 0}
						<div class="card-radar" aria-hidden="true">
							<RadarChart traits={r.traits} color={r.color} size={90} showLabels={false} />
						</div>
					{/if}
				</div>
				<span class="more">Profile →</span>
			</button>
		{/each}
	</div>

		<!-- ── Methodology transparency note ── -->
		<details class="method-note">
			<summary class="method-toggle">
				<span class="method-icon"><Icon name="info" size={13} /></span>
				<span class="method-label">How to read this analysis</span>
			</summary>
			<div class="method-body">
				<div class="method-col">
					<span class="method-tag quant"><Icon name="chart" size={11} /> Quantitative</span>
					<p>Token counts and % shares are <strong>direct observations</strong> — the room placed these chips. No model or assumption involved.</p>
				</div>
				<div class="method-col">
					<span class="method-tag mixed"><Icon name="scale" size={11} /> Assumptions</span>
					<p>CGI, Lead / Fault / Blind use <strong>equal-weight aggregation</strong> — each function counts the same regardless of organisational size or budget authority. "Fault" uses variance as a proxy for disagreement; "Blind" assumes low funding = overlooked, not intentional.</p>
				</div>
				<div class="method-col">
					<span class="method-tag qual"><Icon name="brain" size={11} /> Qualitative</span>
					<p>Archetype labels, tags, the AI brief, and future workspace image are <strong>narrative interpretations</strong> — they help tell the story but are not statistical conclusions.</p>
				</div>
			</div>
		</details>
	{/if}
</div>

<FunctionProfileSheet bind:open {profile} />

<style>
	.fp {
		height: 100%;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.fp-hdr {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}
	.fp-note {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}
	.fp-insight {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 12px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--c) 45%, var(--color-line));
		background: color-mix(in srgb, var(--c) 10%, var(--color-panel));
		flex: 1;
		min-width: 180px;
	}
	.fp-tag {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--c);
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.fp-title {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 800;
		color: var(--color-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.fp-sub {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--color-muted);
	}
	.empty {
		margin: auto;
		padding: 48px 16px;
		text-align: center;
		font-size: 14px;
		color: var(--color-muted);
	}
	.room-strip {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		min-height: 44px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		flex-shrink: 0;
	}
	.mix-track {
		flex: 1;
		display: flex;
		height: 18px;
		min-width: 0;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
	}
	.mix-seg {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2px;
		overflow: hidden;
	}
	.mix-seg span {
		font-size: 9px;
		font-weight: 700;
		/* Literal dark like RoundInsights .seg-lab: the fills are pale in both
		   themes and var(--color-ink) flips to cream on stage-dark. ≥4.5:1 on
		   every priority fill is asserted in priority-colors.test.ts. */
		color: #111a14;
		text-shadow: 0 1px 2px rgba(255, 255, 255, 0.35);
		white-space: nowrap;
		padding: 0 3px;
	}
	.rs-cap {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
		flex-shrink: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 10px;
		padding-bottom: 8px;
	}
	.card {
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in srgb, var(--fn) 35%, var(--color-line));
		background: color-mix(in srgb, var(--fn) 8%, var(--color-panel));
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		text-align: left;
		cursor: pointer;
		color: inherit;
		transition: border-color var(--dur-fast, 180ms) ease;
	}
	.card:hover {
		border-color: var(--fn);
	}
	.card-body-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.card-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.card-radar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: -6px;
	}
	.card header {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--fn);
		flex-shrink: 0;
	}
	.fn {
		flex: 1;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 15px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.align {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 800;
		color: var(--color-teal-ink);
	}
	.align-bar {
		height: 4px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
		overflow: hidden;
	}
	.align-fill {
		height: 100%;
		border-radius: 99px;
		background: var(--fn);
	}
	.delta {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.dlab {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.dval {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-ink);
		border-left: 3px solid var(--dc, var(--color-line));
		padding-left: 8px;
	}
	.dval b {
		font-family: var(--font-mono);
		color: var(--dc);
	}
	.more {
		margin-top: auto;
		font-size: 11px;
		font-weight: 700;
		color: var(--color-muted);
	}
	.archetype {
		margin: 0;
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		color: var(--color-ink);
		line-height: 1.25;
		text-transform: capitalize;
	}
	/* ── Methodology note ── */
	.method-note {
		flex-shrink: 0;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		overflow: hidden;
	}
	.method-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		cursor: pointer;
		list-style: none;
	}
	.method-toggle::-webkit-details-marker { display: none; }
	.method-icon { font-size: 13px; display: flex; }
	.method-label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}
	.method-body {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		padding: 0 14px 14px;
	}
	@media (max-width: 720px) {
		.method-body { grid-template-columns: 1fr; }
	}
	.method-col {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.method-col p {
		margin: 0;
		font-size: 11px;
		line-height: 1.45;
		color: var(--color-muted);
	}
	.method-col p strong {
		color: var(--color-ink);
	}
	.method-tag {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		width: fit-content;
	}
	.method-tag.quant {
		background: color-mix(in srgb, var(--color-teal) 14%, transparent);
		color: var(--color-teal-ink);
		border: 1px solid color-mix(in srgb, var(--color-teal) 35%, transparent);
	}
	.method-tag.mixed {
		background: color-mix(in srgb, var(--color-gold) 14%, transparent);
		color: var(--color-gold-ink);
		border: 1px solid color-mix(in srgb, var(--color-gold) 35%, transparent);
	}
	.method-tag.qual {
		background: color-mix(in srgb, #7E8CE0 14%, transparent);
		color: #7E8CE0;
		border: 1px solid color-mix(in srgb, #7E8CE0 35%, transparent);
	}
</style>
