<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { formatUsd, priorityMix, roomInsights, roomPriorities } from '$lib/game';

/**
 * Screen 2 — Priority Breakdown.
 * 7 priorities ranked by share of room stake, each row shows:
 *   - rank, colour dot, name
 *   - horizontal bar (% of room)
 *   - $ amount (formatted with formatUsd)
 *   - % of room
 *   - reach (how many of the 7 functions backed it)
 *
 * The math: $M amounts are absolute; % is share of the *room total* at the
 * current phase. So "13% of $700M = $91M" — the percentage and dollar are
 * consistent because the bar IS the share.
 */
	let { room }: { room: RoomState } = $props();

	const labels = $derived(roomPriorities(room));
	const mix = $derived(priorityMix(room.aggregate.matrix, labels));
	const i = $derived(roomInsights(room));
	const reachMap = $derived(room.aggregate.reach);
	const totalCoins = $derived(room.aggregate.totalCoins);

	/**
	 * Per-priority spread across the seven tables.
	 *
	 * The bar and the reach dots answer "how much" and "how many", but not
	 * "concentrated or shared" — $110M from three tables tripling down and
	 * $110M from seven tables each placing one chip are the same bar and read
	 * identically. That distinction is the actual boardroom question.
	 *
	 * Deliberately NOT a log scale. Every table is capped at the same wallet in
	 * $10M chips, so totals span ~1.8x and cells ~3x. Log needs orders of
	 * magnitude; on this range it would compress the only differences that
	 * exist and flatter the chart at the data's expense.
	 */
	const spread = $derived.by(() => {
		const out: Record<number, { stakes: number[]; median: number; max: number; concentrated: boolean }> = {};
		for (let p = 0; p < labels.length; p++) {
			const stakes = room.tables
				.map((t) => t.matrix?.[p] ?? 0)
				.filter((v) => v > 0)
				.sort((a, b) => a - b);
			if (!stakes.length) {
				out[p] = { stakes: [], median: 0, max: 0, concentrated: false };
				continue;
			}
			const mid = Math.floor(stakes.length / 2);
			const median =
				stakes.length % 2 ? stakes[mid] : (stakes[mid - 1] + stakes[mid]) / 2;
			const max = stakes[stakes.length - 1];
			// A table holding more than twice the typical stake is the signal that
			// this priority is carried rather than shared.
			out[p] = { stakes, median, max, concentrated: median > 0 && max > median * 2 };
		}
		return out;
	});
</script>

<div class="pb">
	<header class="hdr">
		<span class="hdr-sub">
			Total room stake · {formatUsd(totalCoins)} · ranked by share of room
		</span>
	</header>

	<header class="cg-kicker legend" aria-label="Column legend">
		<span class="lg-rank">#</span>
		<span class="lg-name">Priority</span>
		<span class="lg-bar">Share of room</span>
		<span class="lg-amt">$ wagered</span>
		<span class="lg-pct">%</span>
		<span class="lg-reach">Backed by</span>
	</header>

	<section class="list stagger" role="list" aria-label="Priorities ranked by share of room stake">
		{#each mix as m, rank (m.priority)}
			{@const reach = reachMap[m.priority] ?? 0}
			<div
				class="row"
				class:lead={rank === 0}
				class:blind={m.name === i.blind}
				style="--i:{rank}"
			>
				<span class="rank" class:lead={rank === 0}>{rank + 1}</span>
				<span class="pdot" style="background:{m.color}"></span>
				<span class="pname">{m.name}</span>
				<div class="pbar-track" aria-label="{m.name} {m.pct}% of room">
					<div
						class="pbar-fill"
						style="width:{m.pct}%; background:{m.color}"
					>
						<!-- Segment the fill by contributing table, largest last. Same total
						     width, but now the bar shows whether the stake is shared across
						     tables or carried by one — a distinction the bar alone hides. -->
						{#each spread[m.priority]?.stakes ?? [] as stake, si (si)}
							{@const w = m.tokens > 0 ? (stake / m.tokens) * 100 : 0}
							<span class="pseg" style="width:{w}%"></span>
						{/each}
					</div>
				</div>
				<span class="pamt">{formatUsd(m.tokens)}</span>
				<span class="ppct" style="color:{m.color}">{m.pct}%</span>
				<span class="preach" aria-label="backed by {reach} of 7 functions">
					<span class="reach-dots">
						{#each Array(7) as _, d (d)}
							<span
								class="reach-dot"
								class:on={d < reach}
								style="--fn:{m.color}"
							></span>
						{/each}
					</span>
					<span class="reach-num">{reach}/7</span>
				</span>
			</div>
		{/each}
	</section>

	<footer class="sum" aria-label="Total verification">
		<span class="cg-kicker sum-lbl">All 7 sum to</span>
		<span class="sum-pct">{mix.reduce((s, m) => s + m.pct, 0)}%</span>
		<span class="sum-eq">≈</span>
		<span class="sum-amt">{formatUsd(totalCoins)}</span>
		<span class="sum-note">= 100% of room stake</span>
	</footer>
</div>

<style>
	.pb {
		display: flex;
		flex-direction: column;
		gap: 10px;
		height: 100%;
		min-height: 0;
		padding: 4px 4px 12px;
	}
	.hdr {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.hdr-sub {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
	}
	.legend {
		--k-size: 9px;
		--k-track: 0.06em;
		display: grid;
		grid-template-columns: 28px 12px minmax(110px, 1fr) 1fr 80px 44px 88px;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		color: var(--color-muted);
	}
	.lg-rank {
		/* spans the rank + colour-dot columns so the 6 labels align with the 7 row cells */
		grid-column: span 2;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		overflow: auto;
		min-height: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 28px 12px minmax(110px, 1fr) 1fr 80px 44px 88px;
		align-items: center;
		gap: 10px;
		/* Seven rows at 39px used ~270px of a 739px stage and left the bottom
		   half blank. Vertical padding scales the rows into the space instead of
		   stretching the bar, which would exaggerate the differences. */
		padding: 14px 12px;
		border-radius: 10px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.row.lead {
		border-color: color-mix(in srgb, var(--color-gold) 45%, var(--color-line));
		background: color-mix(in srgb, var(--color-gold) 6%, var(--color-panel));
	}
	.row.blind {
		border-color: color-mix(in srgb, var(--color-red) 35%, var(--color-line));
		background: color-mix(in srgb, var(--color-red) 5%, var(--color-panel));
	}
	.rank {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 800;
		color: var(--color-muted);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.rank.lead {
		color: var(--color-gold-ink);
	}
	.pdot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.pname {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 700;
		color: var(--color-ink);
		text-transform: capitalize;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pbar-track {
		position: relative;
		/* 16px was a hairline on a 739px stage with only 7 rows to fill. Taller
		   bars are the point of this screen — it is the one place the room sees
		   relative spend as length rather than as a printed percentage. */
		height: 28px;
		background: color-mix(in srgb, var(--color-ink) 4%, transparent);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.pbar-fill {
		height: 100%;
		min-width: 1px;
		display: flex;
		transition: width var(--dur-base, 280ms) var(--ease-out-quart, ease);
	}
	/* Divider between contributing tables. A hairline of the track colour, so
	   the bar still reads as one length while showing how many stakes compose
	   it — wider blocks mean fewer, bigger bets. */
	.pseg + .pseg {
		border-left: 2px solid color-mix(in srgb, #10160f 55%, transparent);
	}
	.pamt {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		color: var(--color-ink);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.ppct {
		font-family: var(--font-mono);
		font-size: 18px;
		font-weight: 800;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.preach {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.reach-dots {
		display: inline-flex;
		gap: 3px;
	}
	.reach-dot {
		/* 6px is invisible from the back of a room. Reach is the field that
		   separates broad support from one function's concentrated bet, so it
		   has to survive the projector. */
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--fn) 25%, transparent);
		border: 1px solid color-mix(in srgb, var(--fn) 40%, transparent);
	}
	.reach-dot.on {
		background: var(--fn);
	}
	.reach-num {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
	.sum {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 8px 14px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-panel) 80%, transparent);
		border: 1px solid var(--color-line);
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		letter-spacing: 0.04em;
	}
	.sum-lbl {
		--k-track: 0.08em;
	}
	.sum-pct,
	.sum-amt {
		font-size: 13px;
		font-weight: 800;
		color: var(--color-ink);
		font-variant-numeric: tabular-nums;
	}
	.sum-eq {
		color: var(--color-muted);
	}
	.sum-note {
		opacity: 0.7;
	}
	/* Narrow screens: drop the bar-track column — name / % / reach breathe */
	@media (max-width: 720px) {
		.legend,
		.row {
			grid-template-columns: 24px 10px minmax(0, 1fr) 64px 36px 64px;
			gap: 8px;
		}
		.pbar-track,
		.lg-bar {
			display: none;
		}
	}
</style>