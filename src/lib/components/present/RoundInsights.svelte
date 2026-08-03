<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITY_COLORS, roomPriorities, roomRoundStory } from '$lib/game';

/**
 * Screen 3 — How the room evolved.
 * Three executive phases: R1+R2 (baseline stake) → R3 (the cut) → R4+R5 (rebuild).
 * Each phase is one row with its cumulative mix, lead, and lead-change indicator.
 * The chart is *one* timeline — three rows of stacked mix bars, no duplicate legends.
 */
	let { room }: { room: RoomState } = $props();

	const names = $derived(roomPriorities(room));
	const colors = PRIORITY_COLORS;
	const story = $derived(roomRoundStory(room));

	type PhaseRow = {
		label: string;
		subLabel: string;
		shares: number[];
		totalCoins: number;
		/** $M actually removed at R3 (baseline minus cut-round total); 0 on add rows. */
		cutCoins: number;
		move: 'add' | 'remove';
		leadName: string;
		leadShare: number;
		/** Index of the lead priority. The header already prints its share, so the
		 *  bar skips that segment's label rather than printing the number twice. */
		leadIdx: number;
		changed: boolean;
	};

	const phaseRows = $derived.by((): PhaseRow[] => {
		const hist = [...(room.history ?? [])]
			.filter((h) => (h.totalCoins ?? 0) > 0)
			.sort((a, b) => a.roundLabel - b.roundLabel);

		const pick = (label: number) =>
			hist.find((h) => h.roundLabel === label && (h.totalCoins ?? 0) > 0);

		const r45 = pick(5) ?? pick(4);

		const toRow = (label: string, subLabel: string, h: typeof hist[number] | undefined, move: 'add' | 'remove', prev: string | null): PhaseRow | null => {
			if (!h) return null;
			const total = h.matrix.reduce((s, x) => s + (x ?? 0), 0) || 1;
			const shares = names.map((_, i) => Math.round(((h.matrix[i] ?? 0) / total) * 100));
			const leadIdx = typeof h.alignment === 'number' ? h.alignment : 0;
			const leadName = names[leadIdx] ?? '—';
			return {
				label,
				subLabel,
				shares,
				totalCoins: total,
				cutCoins: 0,
				move,
				leadName,
				leadShare: shares[leadIdx] ?? 0,
				leadIdx,
				changed: prev !== null && prev !== leadName
			};
		};

		const r12 = pick(2) ?? pick(1);
		const r3 = pick(3);
		const out: PhaseRow[] = [];
		const r1 = toRow('R1+R2', 'Baseline Stake', r12, 'add', null);
		if (r1) {
			out.push(r1);
			const r3r = toRow('R3', 'Budget Cut', r3, 'remove', r1.leadName);
			if (r3r) {
				// Real removed amount: baseline (R1+R2) total minus what survived the cut.
				r3r.cutCoins = Math.max(0, r1.totalCoins - r3r.totalCoins);
				if (r3r.cutCoins > 0) r3r.subLabel = `−${fmtCoins(r3r.cutCoins)} Budget Cut`;
				out.push(r3r);
				const r45r = toRow('R4+R5', 'Final Synthesis', r45, 'add', r3r.leadName);
				if (r45r) out.push(r45r);
			}
		}
		return out;
	});

	const ready = $derived(phaseRows.length > 0);

	function fmtCoins(n: number): string {
		return `$${Math.round(n / 10) * 10}M`;
	}
</script>

<div class="ri">
	{#if !ready}
		<p class="empty">Advance through R1 — the rebuild shows here.</p>
	{:else}
		<header class="head">
			<span class="legend">Lead highlighted with <span class="emph">↻</span> when it changed from the previous phase</span>
		</header>

		<!-- The bars encode priority by colour alone, and any segment under 12%
		     carries no inline label. Without a key the room sees a stripe of
		     colours it cannot name — `title` needs a hover nobody in the audience
		     can perform. Ordered to match the stacking order of the bars. -->
		<ul class="key" aria-label="Priority colour key">
			{#each names as n, i (i)}
				<li class="key-item">
					<span class="key-dot" style="background:{colors[i]}" aria-hidden="true"></span>
					<span class="key-lab">{n}</span>
				</li>
			{/each}
		</ul>

		<section class="timeline" aria-label="Three-phase session timeline">
			{#each phaseRows as row, i (row.label)}
				{@const isCut = row.move === 'remove'}
				<div class="row" class:cut={isCut}>
					<header class="rh">
						<span class="rlabel" class:cut={isCut}>{row.label}</span>
						<span class="sub-label">{row.subLabel}</span>
						<span class="rtotal">{fmtCoins(row.totalCoins)}</span>
						<span class="rmove" class:add={!isCut} title={isCut ? 'Cut round' : 'Stake phase'}>
							{isCut ? (row.cutCoins > 0 ? `−${fmtCoins(row.cutCoins)}` : '−') : '+'}
						</span>
						<span class="rlead" class:changed={row.changed}>
							{row.leadName} <span class="rshare">{row.leadShare}%</span>
							{#if row.changed}<span class="rflip" title="Lead changed this phase">↻</span>{/if}
						</span>
					</header>

					<div class="bar" aria-label="{row.label} mix">
						{#each row.shares as pct, pi (pi)}
							{#if pct > 0}
								<div
									class="seg"
									style="width:{pct}%; background:{colors[pi]}"
									title="{names[pi]} · {pct}%"
								>
									<!-- 6% not 12%: on a 1600px stage an 11% segment is ~170px
									     wide and was rendering blank. The label is ~26px. -->
									{#if pct >= 6 && pi !== row.leadIdx}<span class="seg-lab">{pct}%</span>{/if}
								</div>
							{/if}
						{/each}
						{#if isCut}<div class="cutring" aria-hidden="true"></div>{/if}
					</div>
				</div>
			{/each}
		</section>

		<footer class="story" aria-label="Round story in three facts">
			<div class="fact">
				<span class="ft">Assumed</span>
				<strong>{story.assumed?.name ?? '—'}</strong>
				<span class="fsub">Where the room first put its weight.</span>
			</div>
			<div class="fact">
				<span class="ft">Held</span>
				<div class="chips">
					{#each story.protected.slice(0, 3) as p (p.priority)}
						<span class="chip" style="--c:{colors[p.priority]}">{p.name}</span>
					{:else}<span class="chip muted">—</span>{/each}
				</div>
			</div>
			<div class="fact cut">
				<span class="ft">Cut</span>
				<div class="chips">
					{#each story.cut.slice(0, 3) as p (p.priority)}
						<span class="chip" style="--c:{colors[p.priority]}">{p.name} <small>{p.deltaPts}pp</small></span>
					{:else}<span class="chip muted">—</span>{/each}
				</div>
			</div>
		</footer>
	{/if}
</div>

<style>
	.ri {
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: 100%;
		min-height: 0;
		overflow: auto;
		padding: 4px 4px 12px;
	}
	.empty {
		margin: auto;
		font-size: 13px;
		color: var(--color-muted);
		padding: 48px 16px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.legend {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
	}
	.legend .emph {
		color: var(--color-red);
		font-weight: 800;
	}

	/* Colour key — the bars are colour-only, so this is what makes them readable
	   from a seat. Wraps on narrow screens rather than scrolling. */
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		list-style: none;
		margin: 0 0 12px;
		padding: 0;
	}
	.key-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.key-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
		/* Hairline keeps the palest chips (Talent, Future) off a cream ground. */
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 22%, transparent);
	}
	.key-lab {
		font-size: 11px;
		color: var(--color-muted);
		white-space: nowrap;
	}
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex-shrink: 0;
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 12px 10px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		position: relative;
	}
	.row.cut {
		border-color: color-mix(in srgb, var(--color-red) 45%, var(--color-line));
		background: color-mix(in srgb, var(--color-red) 6%, var(--color-panel));
	}
	.rh {
		display: flex;
		align-items: baseline;
		gap: 10px;
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.rlabel {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--color-ink);
		min-width: 56px;
	}
	.rlabel.cut {
		color: var(--color-red);
	}
	.sub-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}
	.rtotal {
		font-weight: 700;
		color: var(--color-gold-ink);
		font-variant-numeric: tabular-nums;
	}
	.rmove {
		font-weight: 800;
		letter-spacing: 0.04em;
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-red) 25%, transparent);
		color: var(--color-red);
		border: 1px solid color-mix(in srgb, var(--color-red) 45%, transparent);
	}
	.rmove.add {
		background: color-mix(in srgb, var(--color-teal) 25%, transparent);
		color: var(--color-teal-ink);
		border-color: color-mix(in srgb, var(--color-teal) 45%, transparent);
	}
	.rlead {
		margin-left: auto;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
		max-width: 60%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rlead.changed {
		color: var(--color-red);
	}
	.rshare {
		color: var(--color-gold-ink);
		font-weight: 800;
		margin-left: 4px;
		text-transform: none;
		letter-spacing: 0;
	}
	.rflip {
		margin-left: 6px;
		font-size: 12px;
		color: var(--color-red);
		font-weight: 800;
	}
	.bar {
		position: relative;
		height: 28px;
		display: flex;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: color-mix(in srgb, var(--color-ink) 4%, transparent);
	}
	.seg {
		height: 100%;
		min-width: 2px;
		transition: width var(--dur-base, 280ms) var(--ease-out-quart, ease);
	}
	.seg-lab {
		font-size: 10px;
		font-weight: 700;
		/* Dark ink, not white: the priority fills are mid-to-pale, so white at this
		   size failed AA on all seven (as low as 1.59:1 on Talent). Ink clears 4.5:1
		   on every fill — see the contrast test in priority-colors.test.ts. */
		color: var(--color-ink);
		padding: 0 4px;
		white-space: nowrap;
	}
	.cutring {
		position: absolute;
		inset: -3px;
		border: 2px dashed color-mix(in srgb, var(--color-red) 65%, transparent);
		border-radius: var(--radius-sm);
		pointer-events: none;
	}
	.story {
		display: grid;
		grid-template-columns: 1.2fr 1fr 1fr;
		gap: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-panel) 80%, transparent);
		border: 1px solid var(--color-line);
		flex-shrink: 0;
	}
	@media (max-width: 720px) {
		.story {
			grid-template-columns: 1fr;
		}
	}
	.fact {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.fact strong {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 800;
		color: var(--color-ink);
		text-transform: capitalize;
	}
	.ft {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.fact.cut .ft {
		color: var(--color-red);
	}
	.fsub {
		font-size: 11px;
		color: var(--color-muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--c) 14%, transparent);
		color: var(--color-ink);
		border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
	}
	.chip.muted {
		color: var(--color-muted);
	}
	.chip small {
		opacity: 0.6;
		margin-left: 2px;
	}
</style>