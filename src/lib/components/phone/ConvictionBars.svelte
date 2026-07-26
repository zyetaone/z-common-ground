<script lang="ts">
	import { PRIORITIES, formatUsd, formatUsdFull } from '$lib/game';
	import type { Vec7 } from '$lib/game/types';

	/** POC-style post-submit conviction strip. */
	let {
		bets,
		color = '#37b6a2'
	}: {
		bets: Vec7;
		color?: string;
	} = $props();

	const max = $derived(Math.max(1, ...bets));
	const total = $derived(bets.reduce((a, b) => a + b, 0));
</script>

<div class="mini" style="--seat:{color}">
	<p class="cap">Your conviction · <span>{formatUsdFull(total)}</span></p>
	<div class="bars">
		{#each PRIORITIES as p, i (p)}
			<div class="row" class:empty={bets[i] === 0}>
				<span class="lbl">{p}</span>
				<div class="track">
					<div class="fill" style="width:{(bets[i] / max) * 100}%"></div>
				</div>
				<span class="val">{bets[i] ? formatUsd(bets[i]) : ''}</span>
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
		grid-template-columns: 1fr 80px 48px;
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
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 4px;
		background: var(--seat);
		min-width: 0;
	}
	.val {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		text-align: right;
	}
</style>
