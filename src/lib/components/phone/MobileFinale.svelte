<script lang="ts">
	import ConvictionBars from './ConvictionBars.svelte';
	import { formatUsdFull, tableWalletLabel } from '$lib/game';
	import type { Persona, Vec7 } from '$lib/game/types';

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
</script>

<div class="finale">
	<section class="f-card">
		<div class="kicker">{persona.name}</div>
		<div class="f-hero">
			<span class="f-big">{totalTokens}</span>
			<span class="f-unit">{formatUsdFull(totalTokens)}</span>
		</div>
		<p class="f-sub">{tableWalletLabel(10)} · {persona.name}</p>
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
		background: rgba(13, 21, 38, 0.55);
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
	.qbtn.primary {
		border: none;
		border-radius: 12px;
		background: var(--color-teal);
		color: #04140f;
		padding: 14px;
		font-weight: 800;
		font-size: 14px;
		cursor: pointer;
	}
</style>
