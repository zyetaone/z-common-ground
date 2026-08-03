<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import PortraitMatrix from '$lib/components/analytics/PortraitMatrix.svelte';
	import { roomInsights, roomPriorities } from '$lib/game';

	/**
	 * Screen 1 — Seat Matrix.
	 * The 7×7 portrait matrix: rows = personas, columns = priorities.
	 * Each cell shows $M wagered. Cell colour = priority colour (so the
	 * column colour also reads as "which priorities got the most love").
	 * The two takeaway chips below are the room's lead and divide — the
	 * only derived numbers a presenter needs to read aloud.
	 * Below the footer, a 7-row read-aloud profile: one row per function
	 * with the persona dot, archetype one-liner, and room-alignment score.
	 */
	let { room }: { room: RoomState } = $props();

	const labels = $derived(roomPriorities(room));
	const i = $derived(roomInsights(room));
	const ring = $derived(Math.min(100, Math.max(0, i.index)));
	const sealed = $derived(room.tables.filter((t) => t.lockedThisRound).length);
	const tables = $derived(room.tables.length);
</script>

<div class="see">
	{#if !i.hasData}
		<p class="empty">Waiting for stake — tables place chips, the analysis builds here.</p>
	{:else}
		<header class="hdr">
			<span class="hdr-sub">7 personas · 7 priorities · one $100M wallet each</span>
		</header>

		<div class="board">
			<PortraitMatrix {room} />
		</div>

		<footer class="bar" aria-label="Room summary">
			<div class="metric">
				<span class="cg-kicker m-label">Common Ground</span>
				<span class="m-num">{ring}</span>
				<span class="m-u">/100</span>
				<span class="cg-kicker m-verdict">{i.verdict}</span>
			</div>
			<div class="metric">
				<span class="cg-kicker m-label">Lead</span>
				<span class="m-val">{i.lead}</span>
			</div>
			{#if i.fault !== i.blind}
				<div class="metric">
					<span class="cg-kicker m-label">Divide</span>
					<span class="m-val">{i.fault}</span>
				</div>
			{/if}
			<div class="metric">
				<span class="cg-kicker m-label">Overlooked</span>
				<span class="m-val">{i.blind}</span>
			</div>
			<!-- role="img" so the aria-label is legal and the dot row is announced as
			     one summary ("3 of 7 sealed") rather than seven unlabelled spans.
			     aria-label on a bare <div> is prohibited — it has no role to label. -->
			<div class="dots" role="img" aria-label="{sealed} of {tables} sealed">
				{#each i.tables as t (t.id)}
					<span
						class="dot"
						class:on={t.locked}
						style="--fn:{t.color}"
					></span>
				{/each}
			</div>
		</footer>
	{/if}
</div>

<style>
	.see {
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: 100%;
		min-height: 0;
		padding: 0 4px;
	}
	.empty {
		margin: auto;
		font-size: 14px;
		color: var(--color-muted);
		padding: 48px 16px;
	}
	.hdr {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-shrink: 0;
	}
	.hdr-sub {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
	}
	.board {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.board :global(.pm) {
		flex: 1;
		min-height: 0;
		height: 100%;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 12px 18px;
		padding: 8px 14px;
		min-height: 48px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		flex-shrink: 0;
		flex-wrap: wrap;
	}
	.metric {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
	}
	/* Only the axes that differ from .cg-kicker — see app.css. */
	.m-label {
		--k-track: 0.08em;
	}
	.m-num {
		font-family: var(--font-display);
		font-size: clamp(2.5rem, 4vw, 3.5rem);
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--color-ink);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.m-u {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}
	.m-verdict {
		--k-track: 0.06em;
		--k-color: var(--color-teal-ink);
		font-size: 14px;
	}
	.m-val {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-ink);
	}
	.dots {
		display: inline-flex;
		gap: 4px;
		margin-left: auto;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--fn, var(--color-muted)) 25%, transparent);
		border: 1px solid color-mix(in srgb, var(--fn, var(--color-line)) 40%, transparent);
	}
	.dot.on {
		background: var(--fn);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--fn) 25%, transparent);
	}

</style>
