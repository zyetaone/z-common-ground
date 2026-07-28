<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import PortraitMatrix from '$lib/components/analytics/PortraitMatrix.svelte';
	import { formatUsd, boardTokenSum, tablePersona } from '$lib/game';

	/** Screen 1 — Combined Board Heatmap Matrix dominates; compact live strip above. */
	let { room }: { room: RoomState } = $props();

	const stake = $derived(room.aggregate.totalCoins);
	const bounty = $derived(room.roomBountyTokens ?? 700);
	const tableCap = $derived(
		room.tableBountyTokens ?? Math.floor(bounty / Math.max(1, room.tables.length))
	);
	const remaining = $derived(Math.max(0, bounty - stake));
	const pct = $derived(bounty > 0 ? Math.min(100, Math.round((stake / bounty) * 100)) : 0);
	const overRoom = $derived(stake > bounty);
	const roundLabel = $derived(
		room.phase === 'round' || room.phase === 'lobby' ? room.round + 1 : room.roundCount
	);
	// Alignment lives on screen 2 (the ring) — screen 1 is the board + money only.
</script>

<div class="glance">
	<header class="strip">
		<div class="core">
			<div class="stat">
				<span class="lab">Round</span>
				<span class="val gold">
					{#if room.phase === 'round'}
						R{roundLabel}<span class="sm">/{room.roundCount}</span>
					{:else}
						<span class="sm">{room.phase}</span>
					{/if}
				</span>
			</div>
			<div class="stat">
				<span class="lab">Stake</span>
				<span class="val gold">{formatUsd(stake)}</span>
			</div>
			<div class="stat">
				<span class="lab">Budget</span>
				<span class="val" class:over={overRoom}>{formatUsd(bounty)}</span>
				<span class="sub">{formatUsd(remaining)} left · {pct}%</span>
			</div>
		</div>

		<div class="bar-track" title="{stake} / {bounty}">
			<div class="bar-fill" class:over={overRoom} style="width:{pct}%"></div>
		</div>

		<div class="tables">
			{#each room.tables as t (t.id)}
				{@const n = boardTokenSum(t.board)}
				{@const fn = tablePersona(t.id)}
				<span
					class="chip"
					class:on={t.lockedThisRound}
					class:over={n > tableCap}
					title="{fn.name} · ${n}M / ${tableCap}M"
					style="--fn:{fn.color}"
				>
					T{t.id} <b>${n}M</b>
				</span>
			{/each}
		</div>
	</header>

	<div class="portrait">
		<PortraitMatrix {room} />
	</div>
</div>

<style>
	.glance {
		display: flex;
		flex-direction: column;
		gap: 14px;
		height: 100%;
		min-height: 0;
		overflow: auto;
	}
	.strip {
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 12px 14px;
	}
	.core {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 22px;
		align-items: flex-end;
		margin-bottom: 10px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}
	.lab {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
		margin-bottom: 3px;
	}
	.val {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.4rem;
	}
	.val.gold {
		color: var(--color-gold);
	}
	.val.over {
		color: var(--color-red);
	}
	.val .sm {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-muted);
	}
	.sub {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		margin-top: 2px;
	}
	.bar-track {
		height: 6px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
		margin-bottom: 10px;
	}
	.bar-fill {
		height: 100%;
		border-radius: 99px;
		background: var(--color-teal);
		transition: width 0.3s ease;
	}
	.bar-fill.over {
		background: var(--color-red);
	}
	.tables {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 3px 8px;
		border-radius: 8px;
		border: 1px solid var(--color-line);
		color: var(--color-muted);
		background: rgba(0, 0, 0, 0.2);
	}
	.chip.on {
		border-color: var(--fn);
		color: var(--color-ink);
		background: color-mix(in srgb, var(--fn) 15%, transparent);
	}
	.chip.over {
		border-color: var(--color-red);
		color: var(--color-red);
	}
	.chip b {
		color: var(--color-gold);
	}
</style>
