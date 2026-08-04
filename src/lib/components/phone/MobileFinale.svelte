<script lang="ts">
	import ConvictionBars from './ConvictionBars.svelte';
	import { CHIP_HEX, CHIP_VALUE, PRIORITIES, formatUsd } from '$lib/game';
	import type { Persona, Vec7 } from '$lib/game/types';
	import Chip from '$lib/components/Chip.svelte';

	/** Phone finale: your board only. Room analysis lives on presenter. */
	let {
		persona,
		totalTokens,
		counts,
		labels,
		onRender
	}: {
		persona: Persona;
		totalTokens: number;
		counts: Vec7;
		labels?: string[];
		onRender: () => void;
	} = $props();

	const chipColor = CHIP_HEX;
	const chipCount = $derived(Math.floor(totalTokens / CHIP_VALUE));
	const top = $derived.by(() => {
		let best = 0;
		let idx = -1;
		for (let i = 0; i < counts.length; i++) {
			if ((counts[i] ?? 0) > best) {
				best = counts[i] ?? 0;
				idx = i;
			}
		}
		// idx stays -1 when the table never staked. Defaulting to 0 there would
		// print "0% on Talent" — naming a priority they never chose — because a
		// table can reach the finale without submitting anything.
		if (idx < 0 || totalTokens <= 0) return { name: '', share: 0, best: 0 };
		const names = labels?.length ? labels : (PRIORITIES as unknown as string[]);
		// Fall back to the canonical priority name, never a raw index: "56% on
		// Priority 2" is the last thing a participant should see on the finale.
		// Siblings (ConvictionBars, FunctionBoard) already default to PRIORITIES.
		const name = names[idx]?.trim() || PRIORITIES[idx] || '—';
		const share = Math.round((best / totalTokens) * 100);
		return { name, share, best };
	});
</script>

<div class="finale">
	<section class="f-card">
		<div class="cg-kicker" style="--k-track: 0.16em; margin-bottom:8px">{persona.name}</div>
		<div class="f-hero">
			{#if top.name}
				<span class="f-big">{top.share}%</span>
				<span class="f-unit">on {top.name}</span>
			{:else}
				<span class="f-unit">No stake placed this session</span>
			{/if}
		</div>
		<p class="f-sub">Your mix · wallet {formatUsd(totalTokens)}</p>
		{#if chipCount > 0}
			<div class="f-chips">
				{#each { length: Math.min(chipCount, 12) } as _, i}
					<span class="f-chip" style="animation-delay:{i * 40}ms">
						<Chip hex={chipColor} size={20} />
					</span>
				{/each}
				{#if chipCount > 12}
					<span class="chip-over">+{chipCount - 12}</span>
				{/if}
			</div>
		{/if}
	</section>

	<section class="f-card">
		<ConvictionBars bets={counts} color={persona.color} {labels} />
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
		background: var(--color-panel);
		padding: 14px;
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
		font-size: 14px;
		color: var(--color-gold-ink);
		font-weight: 700;
		font-family: var(--font-display);
	}
	.f-sub {
		margin: 6px 0 0;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}
	.f-chips {
		display: flex;
		align-items: center;
		gap: 0;
		margin-top: 10px;
		flex-wrap: wrap;
	}
	.f-chip {
		display: inline-flex;
		margin-left: -6px;
		animation: chip-in var(--dur-slow, 480ms) var(--ease-out-quart, ease) both;
	}
	.f-chip:first-child {
		margin-left: 0;
	}
	@keyframes chip-in {
		from {
			transform: translateY(-8px) scale(0.3);
			opacity: 0;
		}
		to {
			transform: none;
			opacity: 1;
		}
	}
	.chip-over {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
		margin-left: 4px;
	}
	.qbtn.primary {
		border: none;
		border-radius: var(--radius-sm);
		background: var(--color-teal);
		color: var(--color-on-teal);
		padding: 14px;
		font-weight: 800;
		font-size: 14px;
		cursor: pointer;
	}
</style>
