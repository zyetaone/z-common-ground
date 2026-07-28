<script lang="ts">
	import ConvictionBars from './ConvictionBars.svelte';
	import { formatUsdFull } from '$lib/game';
	import type { Vec7 } from '$lib/game/types';

	let {
		roundLabel,
		totalTokens,
		counts,
		color
	}: {
		roundLabel: number;
		totalTokens: number;
		counts: Vec7;
		color: string;
	} = $props();
</script>

<div class="sealed">
	<div class="sealbadge">
		<span class="tick">✓</span>
		<div>
			<p class="sk">Submitted · Round {roundLabel}</p>
			<p class="sname">{formatUsdFull(totalTokens)} locked in</p>
		</div>
	</div>
	<ConvictionBars bets={counts} {color} />
	<p class="waiting"><span class="dotw"></span> Waiting for presenter…</p>
</div>

<style>
	.sealed {
		margin: 0 12px;
		border-radius: 16px;
		border: 1px solid var(--color-line);
		padding: 16px;
		background: var(--color-panel);
	}
	.sealbadge {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-bottom: 12px;
	}
	.tick {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-teal);
		color: var(--color-on-teal);
		display: grid;
		place-items: center;
		font-weight: 800;
	}
	.sk {
		margin: 0;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--color-muted);
	}
	.sname {
		margin: 2px 0 0;
		font-weight: 800;
		font-family: var(--font-display);
	}
	.waiting {
		margin: 12px 0 0;
		font-size: 12px;
		color: var(--color-muted);
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dotw {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-gold);
		animation: pulse 1.2s ease infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}
</style>
