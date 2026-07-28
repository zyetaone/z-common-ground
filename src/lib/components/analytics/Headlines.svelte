<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { formatUsd, roomInsights, winnersLosersByFunction, PRIORITIES } from '$lib/game';

	/** Extra-modal: synthesized headlines from room data. Not a reprint of Insights. */
	let { room }: { room: RoomState } = $props();

	const i = $derived(roomInsights(room));
	const wl = $derived(winnersLosersByFunction(room.tables));

	const lines = $derived.by(() => {
		if (!i.hasData) return [];

		const all: { text: string }[] = [];
		const a = room.aggregate;

		// 1. Alignment story
		all.push({
			text: i.index >= 66
				? `Strongly aligned at ${i.index}/100 — functions converge on ${i.lead}.`
				: i.index >= 40
					? `Mixed alignment at ${i.index}/100 — ${i.lead} leads, but ${i.fault} pulls the room apart.`
					: `Fractured at ${i.index}/100 — functions are betting on different futures.`
		});

		// 2. Blind spot or surprise
		if (i.surprise) {
			const persona = wl[i.surprise.seat];
			all.push({
				text: `Surprise: ${persona?.name ?? 'A function'} broke type by funding ${PRIORITIES[i.surprise.priority]}.`
			});
		} else if (i.blindTokens > 0) {
			const blindPct = a.totalCoins > 0 ? Math.round((i.blindTokens / a.totalCoins) * 100) : 0;
			all.push({
				text: `${i.blind} is the blind spot — ${formatUsd(i.blindTokens)} (${blindPct}%).`
			});
		}

		// 3. Total stake
		all.push({
			text: `Room stake: ${formatUsd(i.stake)} across ${i.tables.length} tables.`
		});

		return all;
	});
</script>

<div class="hl">
	<div class="kicker">Room headlines</div>
	<div class="sub">Synthesized from live data — not a reprint of other screens.</div>

	{#if !i.hasData}
		<div class="empty">No stake yet — place tokens to generate headlines.</div>
	{:else}
		<div class="list">
			{#each lines as line, idx (idx)}
				<div class="item" style="animation-delay:{idx * 0.1}s">
					<span class="idx">{idx + 1}</span>
					<p>{line.text}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.hl {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 16px 18px;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-gold);
	}
	.sub {
		font-size: 11px;
		color: var(--color-muted);
		margin-top: 2px;
	}
	.empty {
		display: grid;
		place-items: center;
		height: 160px;
		color: var(--color-muted);
		font-size: 14px;
		border: 1px dashed var(--color-line);
		border-radius: 12px;
		margin-top: 12px;
	}
	.list {
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.item {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 10px 14px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.18);
		opacity: 0;
		animation: fade-in 0.4s ease forwards;
	}
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: none; }
	}
	.idx {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-gold);
		background: rgba(0,0,0,0.3);
		border-radius: 6px;
		padding: 2px 6px;
		flex-shrink: 0;
		margin-top: 1px;
	}
	.item p {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--color-ink);
	}
</style>
