<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { CgiGauge, PortraitMatrix } from '$lib/components/analytics';
	import { functionProfiles, roomInsights, roomPriorities } from '$lib/game';

	/**
	 * Screen 1 — Seat Matrix.
	 * The 7×7 portrait matrix: rows = personas, columns = priorities.
	 */
	let { room }: { room: RoomState } = $props();

	const labels = $derived(roomPriorities(room));
	const i = $derived(roomInsights(room));
	const ring = $derived(Math.min(100, Math.max(0, i.index)));
	const sealed = $derived(room.tables.filter((t) => t.lockedThisRound).length);
	const tables = $derived(room.tables.length);
	const profiles = $derived(functionProfiles(room));
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
			<div class="metric gauge-metric">
				<CgiGauge score={ring} verdict={i.verdict} size={76} />
			</div>
			<div class="metric key-lens">
				<span class="cg-kicker m-label">Lead</span>
				<span class="m-val lead-val">{i.lead}</span>
			</div>
			{#if i.fault !== i.blind}
				<div class="metric key-lens">
					<span class="cg-kicker m-label">Divide</span>
					<span class="m-val divide-val">{i.fault}</span>
				</div>
			{/if}
			<div class="metric key-lens">
				<span class="cg-kicker m-label">Overlooked</span>
				<span class="m-val blind-val">{i.blind}</span>
			</div>
			<div class="dots" aria-label="{sealed} of {tables} sealed">
				{#each i.tables as t (t.id)}
					<span
						class="dot"
						class:on={t.locked}
						style="--fn:{t.color}"
						title="{t.name}: {t.locked ? 'Sealed' : 'Open'}"
					></span>
				{/each}
			</div>
		</footer>

		<section class="risk" aria-label="Per-function read-aloud profiles">
			<header class="risk-hdr">
				<span class="cg-kicker">Functions</span>
				<span class="cg-kicker risk-hdr-right">Alignment</span>
			</header>
			<ul class="risk-list">
				{#each profiles as p (p.tableId)}
					{@const played = p.total > 0}
					<li class="risk-row" class:muted={!played}>
						<span class="risk-dot" style="background:{p.color}" aria-hidden="true"></span>
						<div class="risk-name-block">
							<span class="risk-name" class:muted={!played}>{p.name}</span>
							<span class="risk-declared" class:muted={!played}>{p.risk ?? '—'}</span>
						</div>
						{#if played}
							<div class="risk-align-meter" aria-label="Room alignment {p.commonGround} of 100">
								<div class="risk-bar-track">
									<div class="risk-bar-fill" style="width:{p.commonGround}%; background:{p.color}"></div>
								</div>
								<span class="risk-cg">{p.commonGround}</span>
							</div>
						{:else}
							<span class="risk-cg muted" aria-label="No stake placed">—</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
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

	/* ── Per-function risk strip (read-aloud profiles) ─────────────────── */
	.risk {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 14px 4px;
		border-top: 1px solid var(--color-line);
	}
	.risk-hdr {
		display: flex;
		justify-content: space-between;
		padding: 0 0 4px;
		color: var(--color-muted);
	}
	.risk-hdr-right {
		--k-track: 0.08em;
	}
	.risk-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.risk-row {
		display: grid;
		grid-template-columns: 14px minmax(96px, 1fr) 36px;
		grid-template-rows: auto auto;
		align-items: center;
		gap: 2px 10px;
		padding: 4px 0;
		border-radius: 4px;
	}
	.risk-dot {
		grid-row: 1 / span 2;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		align-self: center;
	}
	.risk-name-block {
		grid-column: 2;
		display: flex;
		flex-direction: column;
		gap: 0;
		min-width: 0;
	}
	.risk-name {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		color: var(--color-ink);
		text-transform: capitalize;
		line-height: 1.15;
	}
	.risk-declared {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		font-style: italic;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.25;
	}
	.gauge-metric {
		padding: 0 4px;
		display: flex;
		align-items: center;
	}
	.key-lens {
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}
	.lead-val {
		color: var(--color-gold);
	}
	.divide-val {
		color: var(--color-red);
	}
	.blind-val {
		color: var(--color-muted);
	}
	.risk-align-meter {
		grid-column: 3;
		grid-row: 1 / span 2;
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: flex-end;
	}
	.risk-bar-track {
		width: 48px;
		height: 6px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--color-ink) 10%, transparent);
		overflow: hidden;
	}
	.risk-bar-fill {
		height: 100%;
		border-radius: 99px;
		transition: width 400ms ease;
	}
	.risk-cg {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		color: var(--color-ink);
		font-variant-numeric: tabular-nums;
		text-align: right;
		min-width: 24px;
	}
</style>
