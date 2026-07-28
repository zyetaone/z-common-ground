<script lang="ts">
	import ConvictionBars from './ConvictionBars.svelte';
	import { CHIP_DENOMS, formatUsdFull } from '$lib/game';
	import type { Persona, Vec7 } from '$lib/game/types';
	import Chip from '$lib/components/Chip.svelte';

	/** Phone finale: your board only. Room analysis lives on presenter. */
	let {
		persona,
		totalTokens,
		counts,
		onRender
	}: {
		persona: Persona;
		totalTokens: number;
		counts: Vec7;
		onRender: () => void;
	} = $props();

	const chipColor = $derived(CHIP_DENOMS[0].hex);
	const chipCount = $derived(Math.floor(totalTokens / 10));
</script>

<div class="finale">
	<section class="f-card">
		<div class="kicker">{persona.name}</div>
		<div class="f-hero">
			<span class="f-big">{totalTokens}</span>
			<span class="f-unit">{formatUsdFull(totalTokens)}</span>
		</div>
		{#if chipCount > 0}
			<div class="f-chips">
				{#each { length: Math.min(chipCount, 12) } as _, i}
					<Chip hex={chipColor} size={20} />
				{/each}
				{#if chipCount > 12}
					<span class="chip-over">+{chipCount - 12}</span>
				{/if}
			</div>
		{/if}
	</section>

	<section class="f-card">
		<ConvictionBars bets={counts} color={persona.color} />
	</section>

	<button type="button" class="qbtn primary" onclick={onRender}>Generate image →</button>
</div>

<style>
	.finale {
		padding: 4px 12px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.f-card {
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: rgba(10, 61, 43, 0.55);
		padding: 14px;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
		margin-bottom: 8px;
	}
	.f-hero {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.f-big {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 2.25rem;
		line-height: 1;
	}
	.f-unit {
		font-size: 12px;
		color: var(--color-gold);
	}
	.f-chips {
		display: flex;
		align-items: center;
		gap: 0;
		margin-top: 8px;
		flex-wrap: wrap;
	}
	.f-chips :global(svg) {
		margin-left: -6px;
	}
	.f-chips :global(svg:first-child) {
		margin-left: 0;
	}
	.chip-over {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
		margin-left: 4px;
	}
	.qbtn.primary {
		border: none;
		border-radius: 12px;
		background: var(--color-teal);
		color: var(--color-on-teal);
		padding: 14px;
		font-weight: 800;
		font-size: 14px;
		cursor: pointer;
	}
</style>
