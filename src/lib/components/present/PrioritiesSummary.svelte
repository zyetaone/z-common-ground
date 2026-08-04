<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITY_COLORS, roomPersonas, roomPriorities } from '$lib/game';

	/**
	 * Screen 4 — What each function did, one line per function.
	 *
	 * "Deprioritized X ──▶ prioritized Y" is the whole story. This used to say it three
	 * ways at once (a net badge, a 7-column bar grid, and two chip lists), and
	 * none of the three could be read from the back of a room: the game only
	 * ever moves ±one chip, so the bars carried no magnitude to compare and the
	 * chip lists put a different word order in every row.
	 *
	 * Sides are the true R2 → R5 net, not the R3-cut / R5-rebuild lists — a
	 * function that cut Cost and re-stacked it at R5 did not "give up Cost", and
	 * the old lists would have shown it on both sides.
	 */
	let { room }: { room: RoomState } = $props();

	const names = $derived(roomPriorities(room));
	const personas = $derived(roomPersonas(room));

	type Side = { priority: number; name: string; tokens: number; color: string };
	type FunctionLine = { seat: number; name: string; color: string; gave: Side[]; bought: Side[] };

	const SHORT = ['Talent', 'Experience', 'Brand', 'Productivity', 'Innovation', 'Cost / ROI', 'Future'];
	const shortName = (i: number) => SHORT[i] ?? names[i] ?? '—';

	const lines = $derived.by((): FunctionLine[] => {
		const hist = [...(room.history ?? [])]
			.filter((h) => (h.totalCoins ?? 0) > 0)
			.sort((a, b) => a.roundLabel - b.roundLabel);
		const r2 = hist.find((h) => h.roundLabel === 2);
		const r5 = hist.find((h) => h.roundLabel === 5) ?? hist[hist.length - 1];
		if (!r2 || !r5) return [];

		const out: FunctionLine[] = [];
		for (let s = 0; s < personas.length && s < room.tables.length; s++) {
			const p = personas[s];
			if (!p) continue;
			const from = r2.portrait[s] ?? [];
			const to = r5.portrait[s] ?? [];
			const gave: Side[] = [];
			const bought: Side[] = [];
			for (let i = 0; i < names.length; i++) {
				const delta = (to[i] ?? 0) - (from[i] ?? 0);
				if (delta === 0) continue;
				const side = {
					priority: i,
					name: shortName(i),
					tokens: Math.abs(delta),
					color: (PRIORITY_COLORS[i] ?? '#999') as string
				};
				(delta < 0 ? gave : bought).push(side);
			}
			// Biggest commitment first — the headline of that function's trade.
			gave.sort((a, b) => b.tokens - a.tokens || a.priority - b.priority);
			bought.sort((a, b) => b.tokens - a.tokens || a.priority - b.priority);
			out.push({ seat: s, name: p.name, color: p.color, gave, bought });
		}
		return out;
	});

	const ready = $derived(lines.some((l) => l.gave.length > 0 || l.bought.length > 0));

	/** One chip is $10M, so an amount is only worth printing when it isn't one. */
	const CHIP = 10;
	const anyMultiChip = $derived(
		lines.some((l) => [...l.gave, ...l.bought].some((s) => s.tokens !== CHIP))
	);
</script>

<div class="ps">
	{#if !ready}
		<div class="empty">
			<p class="empty-title">No trades yet</p>
			<p class="empty-sub">Once a function moves money off one priority onto another, it lands here.</p>
		</div>
	{:else}
		<header class="head" aria-hidden="true">
			<span class="h-fn">Function</span>
			<span class="h-gave">Deprioritized</span>
			<span class="h-arrow"></span>
			<span class="h-bought">Prioritized</span>
		</header>

		<section class="rows stagger" aria-label="What each function traded">
			{#each lines as l (l.seat)}
				<article class="row">
					<div class="fn">
						<span class="dot" style="background:{l.color}" aria-hidden="true"></span>
						<span class="fname">{l.name}</span>
					</div>

					<div class="side gave" role="list">
						{#each l.gave as s (s.priority)}
							<span class="chip" role="listitem" style="--c:{s.color}">
								{s.name}{#if s.tokens !== CHIP}<b>${s.tokens}M</b>{/if}
							</span>
						{:else}
							<span class="held">none</span>
						{/each}
					</div>

					<span class="arrow" aria-label="in favour of">──▶</span>

					<div class="side bought" role="list">
						{#each l.bought as s (s.priority)}
							<span class="chip" role="listitem" style="--c:{s.color}">
								{s.name}{#if s.tokens !== CHIP}<b>${s.tokens}M</b>{/if}
							</span>
						{:else}
							<span class="held">none</span>
						{/each}
					</div>
				</article>
			{/each}
		</section>

		<p class="foot">
			R2 → R5 net movement.{#if anyMultiChip}
				Each move is $10M unless marked.{:else}
				Every move is $10M — one chip.{/if}
		</p>
	{/if}
</div>

<style>
	.ps {
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
		min-height: 0;
		padding: 4px 4px 12px;
		overflow: auto;
	}
	/* One grid track set, shared by the header and every row, so the arrows form
	   a single vertical line down the screen — that column IS the graph. */
	.head,
	.row {
		display: grid;
		grid-template-columns: minmax(120px, 168px) 1fr auto 1fr;
		align-items: center;
		gap: 10px 14px;
	}
	.head {
		padding: 2px 14px 0;
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.h-gave,
	.h-bought {
		padding-left: 2px;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.row {
		padding: 10px 14px;
		border-radius: 10px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.fn {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.fname {
		font-family: var(--font-display);
		font-size: clamp(13px, 1.15vw, 16px);
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.side {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.chip {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		padding: 3px 9px;
		border-radius: 999px;
		font-size: clamp(11px, 1vw, 13px);
		font-weight: 600;
		white-space: nowrap;
		color: var(--c);
		border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
		background: color-mix(in srgb, var(--c) 14%, transparent);
	}
	.chip b {
		font-family: var(--font-mono);
		font-size: 0.85em;
		font-weight: 800;
		opacity: 0.85;
	}
	/* The give-up side reads as spend, the bought side as the outcome. Only the
	   fill weight differs — the priority hue has to stay the same on both sides
	   or the same priority would look like two different things. */
	.gave .chip {
		background: transparent;
		border-style: dashed;
		opacity: 0.85;
	}
	.arrow {
		font-family: var(--font-mono);
		font-size: clamp(13px, 1.2vw, 17px);
		color: var(--color-muted);
		letter-spacing: -0.05em;
	}
	.held {
		font-size: clamp(11px, 1vw, 13px);
		color: var(--color-muted);
		opacity: 0.7;
	}
	.foot {
		flex-shrink: 0;
		padding: 0 14px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--color-muted);
	}
	.empty {
		flex: 1;
		display: grid;
		place-content: center;
		text-align: center;
		gap: 6px;
	}
	.empty-title {
		font-family: var(--font-display);
		font-size: 18px;
		color: var(--color-ink);
	}
	.empty-sub {
		font-size: 13px;
		color: var(--color-muted);
	}
</style>
