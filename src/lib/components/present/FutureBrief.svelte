<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITY_COLORS, spatialProgramFromAggregate } from '$lib/game';

	/** Left column — mix bars only; package CTA lives on FutureWorkspace. */
	let {
		room,
		onOpenBrief
	}: {
		room: RoomState;
		onOpenBrief: () => void;
	} = $props();

	const program = $derived(spatialProgramFromAggregate(room.aggregate, room));
	const hasData = $derived(room.aggregate.totalCoins > 0);
	const brief = $derived(room.enhancedBrief ?? '');
	const colors = PRIORITY_COLORS;
</script>

<div class="panel">
	<div class="cg-kicker">Common Ground mix</div>

	{#if !hasData}
		<p class="comp muted cg-empty-inline">Waiting for priorities…</p>
	{:else}
		<p class="mandate">{program.mandate}</p>
		<p class="comp">Where the wallets land</p>

		<div class="bars">
			{#each program.program as row (row.priority)}
				{#if row.pct > 0}
					<div class="row">
						<div class="name">{row.name}</div>
						<div class="track">
							<div
								class="fill"
								style="width:{Math.max(row.pct, 3)}%;background:{colors[row.priority]}"
							></div>
						</div>
						<div class="pct">{row.pct}% · {row.money ?? row.tokens}</div>
					</div>
				{/if}
			{/each}
		</div>

		<div class="dirs">
			<div class="dir a"><b>Lead.</b> {program.lead}</div>
			<div class="dir f"><b>Resolve.</b> {program.resolve}</div>
			<div class="dir b"><b>Protect.</b> {program.blind}</div>
		</div>

		{#if brief}
			<button type="button" class="open-brief" onclick={onOpenBrief}>Open brief →</button>
		{/if}
	{/if}
</div>

<style>
	.panel {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 16px 18px;
	}
	.cg-kicker {
		margin-bottom: 8px;
	}
	.comp {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 15px;
		color: var(--color-gold);
		margin: 0 0 8px;
		line-height: 1.35;
	}
	.comp.muted {
		color: var(--color-muted);
		font-weight: 600;
	}
	.mandate {
		margin: 0 0 12px;
		font-size: 14px;
		line-height: 1.5;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: 12px;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(100px, 120px) 1fr minmax(72px, auto);
		gap: 8px;
		align-items: center;
		font-size: 12px;
	}
	.track {
		height: 10px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 4px;
	}
	.pct {
		text-align: right;
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 11px;
	}
	.dirs {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}
	.dir {
		border-left: 3px solid var(--color-line);
		padding: 6px 0 6px 10px;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.dir b {
		color: var(--color-ink);
	}
	.dir.a {
		border-color: var(--color-teal);
	}
	.dir.f {
		border-color: var(--color-gold);
	}
	.dir.b {
		border-color: var(--color-red);
	}
	.open-brief {
		width: 100%;
		border-radius: 12px;
		padding: 12px;
		font-weight: 700;
		cursor: pointer;
		font-size: 13px;
		border: 1px solid color-mix(in srgb, var(--color-gold) 50%, transparent);
		background: color-mix(in srgb, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
	}
</style>
