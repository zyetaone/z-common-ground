<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITIES, PRIORITY_COLORS, formatUsd, priorityMix, winnersLosersByFunction } from '$lib/game';

	/** Screen 4 — what each function backed, and what the room's money says. */
	let { room }: { room: RoomState } = $props();

	const rows = $derived(winnersLosersByFunction(room.tables));
	const hasData = $derived(room.aggregate.totalCoins > 0);
	const mix = $derived(priorityMix(room.aggregate.matrix));
	const colors = PRIORITY_COLORS;
	const maxFn = $derived(Math.max(1, ...rows.map((r) => r.total)));

	const top = $derived(mix.filter((m) => m.tokens > 0)[0]);
	const topFn = $derived([...rows].sort((a, b) => b.total - a.total)[0]);
</script>

<div class="wl">
	{#if !hasData}
		<div class="empty">No stake yet — place tokens to reveal winners & losers.</div>
	{:else}
		<section class="overall">
			<div class="podium">
				<div class="pod gold">
					<div class="tag">#1 Priority</div>
					<div class="big" style="color:{colors[top?.priority ?? 0]}">
						{top?.name ?? '—'}
					</div>
					<div class="num">{top?.pct ?? 0}% of the room</div>
				</div>
				<div class="pod teal">
					<div class="tag">Heaviest Spender</div>
					<div class="big" style="color:{topFn?.color}">{topFn?.name ?? '—'}</div>
					<div class="num">{topFn?.total ?? 0} tokens &middot; {formatUsd(topFn?.total ?? 0)}</div>
				</div>
			</div>
		</section>

		<div class="grid">
			{#each rows as r (r.seat)}
				{@const winShare = r.total > 0 ? Math.round((r.winner.tokens / r.total) * 100) : 0}
				{@const loseShare = r.total > 0 ? Math.round((r.loser.tokens / r.total) * 100) : 0}
				<article class="card" style="--fn:{r.color}">
					<header>
						<span class="dot"></span>
						<span class="fn">{r.name}</span>
						<span class="tot">{r.total}</span>
					</header>
					<div class="fn-bar">
						<div class="fn-fill" style="width:{Math.max(4, (r.total / maxFn) * 100)}%"></div>
					</div>
					<div class="pair">
						<div class="side win">
							<div class="tag">Backed</div>
							<div class="pri">{r.winner.name}</div>
							<div class="mini"><div class="mini-fill" style="width:{winShare}%"></div></div>
						</div>
						<div class="side lose">
							<div class="tag">Dropped</div>
							<div class="pri">{r.loser.name}</div>
							<div class="mini"><div class="mini-fill lose" style="width:{loseShare}%"></div></div>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wl {
		display: flex;
		flex-direction: column;
		gap: 14px;
		height: 100%;
		min-height: 0;
		overflow: auto;
		animation: fade-in 0.4s ease both;
	}
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: none; }
	}
	.empty {
		flex: 1;
		display: grid;
		place-items: center;
		color: var(--color-muted);
		border: 1px dashed var(--color-line);
		border-radius: 16px;
	}
	.overall {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 16px 18px;
	}
	.podium {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	@media (max-width: 600px) {
		.podium { grid-template-columns: 1fr; }
	}
	.pod {
		border-radius: 14px;
		padding: 14px 16px;
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.22);
	}
	.pod.gold { border-color: color-mix(in srgb, var(--color-gold) 40%, transparent); }
	.pod.teal { border-color: color-mix(in srgb, var(--color-teal) 40%, transparent); }
	.tag {
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.big {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 1.4rem;
		margin: 8px 0 4px;
		line-height: 1.15;
	}
	.num {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 10px;
		padding-bottom: 8px;
	}
	.card {
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--fn) 30%, var(--color-line));
		background: color-mix(in srgb, var(--fn) 6%, var(--color-panel));
		padding: 12px 14px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 10px; height: 10px;
		border-radius: 50%;
		background: var(--fn);
		box-shadow: 0 0 10px var(--fn);
	}
	.fn {
		font-weight: 800;
		font-size: 14px;
		flex: 1;
		font-family: var(--font-display);
	}
	.tot {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-gold);
		font-weight: 800;
	}
	.fn-bar {
		height: 4px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		margin: 8px 0 10px;
		overflow: hidden;
	}
	.fn-fill {
		height: 100%;
		border-radius: 99px;
		background: var(--fn);
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.side {
		border-radius: 10px;
		padding: 8px 10px;
		background: rgba(0, 0, 0, 0.22);
	}
	.side.win { border-left: 3px solid var(--color-teal); }
	.side.lose { border-left: 3px solid var(--color-red); }
	.pri {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 13px;
		margin: 4px 0 0;
	}
	.win .pri { color: var(--color-teal); }
	.lose .pri { color: var(--color-muted); }
	.mini {
		margin-top: 6px;
		height: 4px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}
	.mini-fill {
		height: 100%;
		border-radius: 99px;
		background: var(--color-teal);
	}
	.mini-fill.lose { background: var(--color-red); }
</style>
