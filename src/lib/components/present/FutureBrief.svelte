<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITY_COLORS, spatialProgramFromAggregate } from '$lib/game';
	import { session } from '$lib/state';
	import { futureUi } from './future.svelte';

	/** Left column — mix + brief actions. */
	let {
		room,
		onOpenBrief,
		onRegenBrief
	}: {
		room: RoomState;
		onOpenBrief: () => void;
		onRegenBrief: () => void;
	} = $props();

	const program = $derived(spatialProgramFromAggregate(room.aggregate));
	const hasData = $derived(room.aggregate.totalCoins > 0);
	const brief = $derived(room.enhancedBrief ?? '');
	const briefSource = $derived(room.briefSource);
	const colors = PRIORITY_COLORS;
</script>

<div class="panel">
	<div class="kicker">Imagine the future of the workplace</div>

	{#if !hasData}
		<p class="comp muted">No stake yet</p>
	{:else}
		<p class="mandate">{program.mandate}</p>
		<p class="comp">Where the money went</p>

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

		<div class="brief-actions">
			<button type="button" class="open-brief" onclick={onOpenBrief}>
				{brief
					? briefSource === 'llama'
						? 'Open ZyetaI brief →'
						: 'Open brief →'
					: 'Generate AI brief'}
			</button>
			<button
				type="button"
				class="brief-only"
				disabled={session.busy || !hasData}
				onclick={onRegenBrief}
			>
				{session.busy && futureUi.progress ? 'Writing…' : 'Regen brief · ZyetaI'}
			</button>
		</div>
	{/if}
</div>

<style>
	.panel {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: rgba(13, 21, 38, 0.4);
		padding: 16px 18px;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--color-muted);
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
		background: rgba(255, 255, 255, 0.05);
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
	.brief-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.open-brief,
	.brief-only {
		width: 100%;
		border-radius: 12px;
		padding: 12px;
		font-weight: 700;
		cursor: pointer;
		font-size: 13px;
	}
	.open-brief {
		border: 1px solid color-mix(in srgb, var(--color-gold) 50%, transparent);
		background: color-mix(in srgb, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
	}
	.brief-only {
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
	}
	.brief-only:disabled {
		opacity: 0.4;
	}
</style>
