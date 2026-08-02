<script lang="ts">
	import { CHIP_DENOMS, CHIP_VALUE, PRIORITIES, formatUsd, formatUsdFull } from '$lib/game';
	import type { Vec7 } from '$lib/game/types';
	import Chip from '$lib/components/Chip.svelte';

	/** POC-style post-submit conviction strip. */
	let {
		bets,
		color = '#37b6a2',
		labels = PRIORITIES as unknown as string[]
	}: {
		bets: Vec7;
		color?: string;
		labels?: string[];
	} = $props();

	const max = $derived(Math.max(1, ...bets));
	const total = $derived(bets.reduce((a, b) => a + b, 0));
	const chipColor = $derived(CHIP_DENOMS[0].hex);
	const rowLabels = $derived(PRIORITIES.map((def, i) => labels[i]?.trim() || def));
</script>

<div class="mini" style="--seat:{color}">
	<p class="cap">Your conviction · <span>{formatUsdFull(total)}</span></p>
	<div class="bars">
		{#each rowLabels as p, i (i)}
			{@const v = bets[i] ?? 0}
			{@const chipCount = Math.floor(v / CHIP_VALUE)}
			<div class="row" class:empty={v === 0}>
				<span class="lbl">{p}</span>
				<div class="track">
					<div class="fill" style="width:{(v / max) * 100}%"></div>
				</div>
				<div class="val-cell">
					<span class="val">{v ? formatUsd(v) : ''}</span>
					{#if chipCount > 0 && chipCount <= 6}
						<span class="chips">
							{#each { length: chipCount } as _, ci}
								<Chip hex={chipColor} size={12} />
							{/each}
						</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.mini {
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: color-mix(in srgb, var(--color-panel) 70%, transparent);
		padding: 14px 15px;
	}
	.cap {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-muted);
		margin-bottom: 10px;
	}
	.cap span {
		color: var(--color-gold);
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 80px 72px;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}
	.row.empty {
		opacity: 0.35;
	}
	.lbl {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.track {
		height: 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 4px;
		background: var(--seat);
		min-width: 0;
	}
	.val-cell {
		display: flex;
		align-items: center;
		gap: 2px;
		justify-content: flex-end;
	}
	.val {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
	}
	.chips {
		display: flex;
		align-items: center;
		gap: 0;
	}
	.chips :global(svg) {
		margin-left: -3px;
	}
	.chips :global(svg:first-child) {
		margin-left: 0;
	}
</style>
