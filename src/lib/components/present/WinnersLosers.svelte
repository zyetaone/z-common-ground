<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITIES, PRIORITY_COLORS, formatUsd, priorityMix, winnersLosersByFunction } from '$lib/game';

	/** Screen 2 — podium + function cards. No personality essays. */
	let { room }: { room: RoomState } = $props();

	const rows = $derived(winnersLosersByFunction(room.tables));
	const hasData = $derived(room.aggregate.totalCoins > 0);
	const mix = $derived(priorityMix(room.aggregate.matrix));
	const maxFn = $derived(Math.max(1, ...rows.map((r) => r.total)));
	const colors = PRIORITY_COLORS;

	const overall = $derived.by(() => {
		const ranked = mix.filter((m) => m.tokens > 0);
		const top = ranked[0];
		const bottom = [...mix].sort((a, b) => a.tokens - b.tokens || a.priority - b.priority)[0];
		const topFn = [...rows].sort((a, b) => b.total - a.total)[0];
		return { top, bottom, topFn };
	});
</script>

<div class="wl">
	{#if !hasData}
		<div class="empty">No stake yet</div>
	{:else}
		<section class="overall">
			<div class="podium">
				<div class="pod gold">
					<div class="tag">#1</div>
					<div class="big" style="color:{colors[overall.top?.priority ?? 0]}">
						{overall.top?.name ?? '—'}
					</div>
					<div class="num">{overall.top?.pct ?? 0}%</div>
					<div class="bar-track">
						<div
							class="bar-fill"
							style="width:{overall.top?.pct ?? 0}%;background:{colors[overall.top?.priority ?? 0]}"
						></div>
					</div>
				</div>
				<div class="pod teal">
					<div class="tag">Heaviest</div>
					<div class="big" style="color:{overall.topFn?.color}">{overall.topFn?.name ?? '—'}</div>
					<div class="num">{overall.topFn?.total ?? 0}</div>
					<div class="bar-track">
						<div
							class="bar-fill"
							style="width:{((overall.topFn?.total ?? 0) / maxFn) * 100}%;background:{overall.topFn
								?.color}"
						></div>
					</div>
				</div>
				<div class="pod red">
					<div class="tag">Blind</div>
					<div class="big" style="color:{colors[overall.bottom?.priority ?? 0]}">
						{overall.bottom?.name ?? '—'}
					</div>
					<div class="num">{formatUsd(overall.bottom?.tokens ?? 0)}</div>
				</div>
			</div>
			<div class="mix-strip">
				{#each mix.filter((m) => m.pct > 0) as m (m.priority)}
					<div
						class="mix-seg"
						style="flex:{m.pct};background:{colors[m.priority]}"
						title="{PRIORITIES[m.priority]} {m.pct}%"
					></div>
				{/each}
			</div>
		</section>

		<div class="grid">
			{#each rows as r (r.seat)}
				{@const winShare = r.total > 0 ? Math.round((r.winner.tokens / r.total) * 100) : 0}
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
							<div class="tag">Win</div>
							<div class="pri">{r.winner.name}</div>
							{#if r.winner.tokens > 0}
								<div class="mini"><div class="mini-fill" style="width:{winShare}%"></div></div>
							{/if}
						</div>
						<div class="vs">vs</div>
						<div class="side lose">
							<div class="tag">Lose</div>
							<div class="pri">{r.loser.name}</div>
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
		gap: 12px;
		height: 100%;
		min-height: 0;
		overflow: auto;
		animation: fade-in 0.4s ease both;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
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
		background: radial-gradient(ellipse at 20% 0%, rgba(231, 189, 107, 0.12), transparent 50%),
			rgba(10, 61, 43, 0.55);
		padding: 14px 16px;
	}
	.podium {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	@media (max-width: 800px) {
		.podium {
			grid-template-columns: 1fr;
		}
	}
	.pod {
		border-radius: 14px;
		padding: 12px 14px;
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.22);
	}
	.pod.gold {
		border-color: color-mix(in srgb, var(--color-gold) 45%, transparent);
	}
	.pod.teal {
		border-color: color-mix(in srgb, var(--color-teal) 45%, transparent);
	}
	.pod.red {
		border-color: color-mix(in srgb, var(--color-red) 40%, transparent);
	}
	.tag {
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.big {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 1.2rem;
		margin: 6px 0 2px;
		line-height: 1.15;
	}
	.num {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.4rem;
		line-height: 1;
	}
	.bar-track {
		margin-top: 10px;
		height: 10px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}
	.bar-fill {
		height: 100%;
		border-radius: 99px;
		min-width: 4px;
	}
	.mix-strip {
		display: flex;
		height: 14px;
		border-radius: 99px;
		overflow: hidden;
		margin-top: 14px;
		background: rgba(255, 255, 255, 0.04);
	}
	.mix-seg {
		min-width: 3px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 10px;
		padding-bottom: 8px;
	}
	.card {
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--fn) 40%, var(--color-line));
		background: color-mix(in srgb, var(--fn) 8%, rgba(10, 61, 43, 0.5));
		padding: 12px 14px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 10px;
		height: 10px;
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
		height: 6px;
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
		grid-template-columns: 1fr auto 1fr;
		gap: 8px;
		align-items: start;
	}
	.side {
		border-radius: 10px;
		padding: 8px 10px;
		background: rgba(0, 0, 0, 0.22);
	}
	.side.win {
		border-left: 3px solid var(--color-teal);
	}
	.side.lose {
		border-left: 3px solid #64748b;
	}
	.pri {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 13px;
		margin: 4px 0 0;
	}
	.win .pri {
		color: var(--color-teal);
	}
	.lose .pri {
		color: var(--color-muted);
	}
	.mini {
		margin-top: 6px;
		height: 5px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}
	.mini-fill {
		height: 100%;
		background: var(--color-teal);
		border-radius: 99px;
	}
	.vs {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		padding-top: 18px;
	}
</style>
