<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITY_COLORS, roomPersonas, roomPriorities } from '$lib/game';

	/**
	 * Screen 4 — What each function did (cut at R3, rebuilt at R5).
	 *
	 * One row per function. The cut and rebuild are inline chips; the
	 * priority colour and the $-amount are both on the chip. The net is the
	 * true R2 → R5 movement — it cannot be read off the two chip lists,
	 * because those hold only R3 decreases and R5 increases.
	 */
	let { room }: { room: RoomState } = $props();

	const names = $derived(roomPriorities(room));
	const personas = $derived(roomPersonas(room));

	type Move = { priority: number; name: string; tokens: number; color: string };

	type FunctionMove = {
		seat: number;
		name: string;
		color: string;
		cut: Move[];
		build: Move[];
		/** Net direction per priority across R2 → R5, in fixed priority order. */
		arc: Array<{ priority: number; name: string; delta: number; color: string }>;
		/** True R2 → R5 movement in $M. Not inferable from cut/build: those
		 *  lists only hold R3 decreases and R5 increases, so a table that
		 *  reallocates at R5 (moves $ off one priority onto another) has the
		 *  decrease dropped and would read as breaking even when it is down. */
		net: number;
	};

	/** Signed $-amounts per priority between two rounds. */
	function diffByPriority(
		from: number[] | undefined,
		to: number[] | undefined
	): Array<{ priority: number; tokens: number }> {
		if (!from || !to) return [];
		const out: Array<{ priority: number; tokens: number }> = [];
		for (let i = 0; i < from.length; i++) {
			const delta = (to[i] ?? 0) - (from[i] ?? 0);
			if (delta !== 0) out.push({ priority: i, tokens: delta });
		}
		return out.sort((a, b) => a.tokens - b.tokens);
	}

	const moves = $derived.by((): FunctionMove[] => {
		const hist = [...(room.history ?? [])]
			.filter((h) => (h.totalCoins ?? 0) > 0)
			.sort((a, b) => a.roundLabel - b.roundLabel);
		const r2 = hist.find((h) => h.roundLabel === 2);
		const r3 = hist.find((h) => h.roundLabel === 3);
		const r5 = hist.find((h) => h.roundLabel === 5) ?? hist[hist.length - 1];
		if (!r2 || !r3 || !r5) return [];

		const out: FunctionMove[] = [];
		for (let s = 0; s < personas.length && s < room.tables.length; s++) {
			const p = personas[s];
			if (!p) continue;
			const cut = diffByPriority(r2.portrait[s] ?? [], r3.portrait[s] ?? [])
				.filter((d) => d.tokens < 0)
				.map((d) => ({
					priority: d.priority,
					name: names[d.priority] ?? '—',
					tokens: -d.tokens,
					color: (PRIORITY_COLORS[d.priority] ?? '#999') as string
				}));
			const build = diffByPriority(r3.portrait[s] ?? [], r5.portrait[s] ?? [])
				.filter((d) => d.tokens > 0)
				.map((d) => ({
					priority: d.priority,
					name: names[d.priority] ?? '—',
					tokens: d.tokens,
					color: (PRIORITY_COLORS[d.priority] ?? '#999') as string
				}));
			const r2Row = r2.portrait[s] ?? [];
			const r5Row = r5.portrait[s] ?? [];
			const net = diffByPriority(r2Row, r5Row).reduce((sum, d) => sum + d.tokens, 0);
			/**
			 * Per-priority direction across the whole arc, R2 → R5.
			 *
			 * Each delta is printed inside its bar and scaled against the largest
			 * move in the room, so a single-chip shift fills the cell. The grid's
			 * job is the comparison the chips can't be: same column for every
			 * function, so the eye compares one priority down the seven rows.
			 */
			const arc = (r2Row.length ? r2Row : names.map(() => 0)).map((_, pi) => {
				const from = r2Row[pi] ?? 0;
				const to = r5Row[pi] ?? 0;
				return {
					priority: pi,
					name: names[pi] ?? '—',
					delta: to - from,
					color: (PRIORITY_COLORS[pi] ?? '#999') as string
				};
			});
			out.push({ seat: s, name: p.name, color: p.color, cut, build, net, arc });
		}
		return out;
	});

	const ready = $derived(
		moves.length > 0 && moves.some((m) => m.cut.length > 0 || m.build.length > 0)
	);

	const netVaries = $derived(new Set(moves.map((m) => m.net)).size > 1);

	/**
	 * Bars scale to the largest move on screen, not a fixed multiplier. The game
	 * only ever produces ±one chip per priority, so the old ×4.5 pinned every
	 * bar at 45% — a magnitude encoding that encoded nothing, in a bar too short
	 * to hold its own label.
	 */
	const maxDelta = $derived(
		Math.max(1, ...moves.flatMap((m) => m.arc.map((a) => Math.abs(a.delta))))
	);
	const barPct = (delta: number) => Math.round((Math.abs(delta) / maxDelta) * 100);

	const SHORT = ['Talent', 'Experience', 'Brand', 'Productivity', 'Innovation', 'Cost / ROI', 'Future'];
	const shortName = (i: number, label: string) => SHORT[i] ?? label;

	const fmt = (t: number, sign: '+' | '−') => `${sign}$${t}M`;
</script>

<div class="ps">
	{#if !ready}
		<div class="empty">
			<p class="empty-title">No cut or rebuild yet</p>
			<p class="empty-sub">Once a function trims and re-stakes, their strategy lands here.</p>
		</div>
	{:else}
		<!-- ── Priority Column Header Legend ── -->
		<header class="ps-legend" aria-label="Priority column key">
			<span class="ps-lg-title">Function / Strategy</span>
			<div class="ps-lg-cols" role="img" aria-label="7 priority columns">
				{#each names as n, i (i)}
					<div class="ps-lg-col">
						<span class="ps-lg-dot" style="background:{PRIORITY_COLORS[i]}" aria-hidden="true"></span>
						<span class="ps-lg-name" style="color:{PRIORITY_COLORS[i]}">{shortName(i, n)}</span>
					</div>
				{/each}
			</div>
		</header>

		<section class="rows stagger" aria-label="Per-function cut and rebuild">
			{#each moves as m, mi (m.seat)}
				<article class="row" class:up={netVaries && m.net > 0} class:dn={netVaries && m.net < 0}>
					<header class="rh">
						<span class="dot" style="background:{m.color}" aria-hidden="true"></span>
						<span class="fname">{m.name}</span>
						{#if netVaries}
							<span class="net">
								{m.net === 0 ? 'flat' : `net ${fmt(Math.abs(m.net), m.net > 0 ? '+' : '−')}`}
							</span>
						{/if}
					</header>

					<!-- Direction grid: seven fixed columns in priority order, so the same
					     priority sits at the same x in every function's row and the room
					     can read a column down instead of parsing seven word-orders. Up
					     bar = ended higher than R2, down bar = ended lower. -->
					<div class="arc" role="img" aria-label="{m.name} net movement per priority, round 2 to round 5">
						{#each m.arc as a (a.priority)}
							<div class="arc-col" title="{a.name}: {a.delta === 0 ? 'no net change' : fmt(Math.abs(a.delta), a.delta > 0 ? '+' : '−')}">
								<div class="arc-cell up">
									{#if a.delta > 0}
										<span class="arc-bar" style="background:{a.color}; height:{barPct(a.delta)}%">
											<span class="arc-val">+{a.delta}</span>
										</span>
									{/if}
								</div>
								<span class="arc-axis" style="background:{a.color}" aria-hidden="true"></span>
								<div class="arc-cell dn">
									{#if a.delta < 0}
										<span class="arc-bar" style="background:{a.color}; height:{barPct(a.delta)}%">
											<span class="arc-val">{a.delta}</span>
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<div class="line" aria-label="R3 cut and R5 rebuild">
						<span class="side-label">cut</span>
						<div class="chips cut" role="list" aria-label="Chips cut at R3">
							{#each m.cut as c (c.priority)}
								<span class="chip" role="listitem" style="--c:{c.color}">
									{c.name} <b>{fmt(c.tokens, '−')}</b>
								</span>
							{:else}
								<span class="muted">—</span>
							{/each}
						</div>

						<div class="divider" aria-hidden="true"></div>

						<span class="side-label">rebuilt</span>
						<div class="chips build" role="list" aria-label="Chips rebuilt at R5">
							{#each m.build as b (b.priority)}
								<span class="chip" role="listitem" style="--c:{b.color}">
									{b.name} <b>{fmt(b.tokens, '+')}</b>
								</span>
							{:else}
								<span class="muted">—</span>
							{/each}
						</div>
					</div>
				</article>
			{/each}
		</section>
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
	.ps-legend {
		display: grid;
		grid-template-columns: minmax(140px, 180px) 1fr;
		gap: 12px 16px;
		align-items: center;
		padding: 6px 14px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		flex-shrink: 0;
	}
	.ps-lg-title {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.ps-lg-cols {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
	}
	.ps-lg-col {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 0;
	}
	.ps-lg-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.ps-lg-name {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@media (max-width: 720px) {
		.ps-legend {
			display: none;
		}
	}
	.empty {
		margin: auto;
		padding: 40px 32px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-panel) 60%, transparent);
		text-align: center;
		max-width: 560px;
	}
	.empty-title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		margin-bottom: 6px;
	}
	.empty-sub {
		font-size: 13px;
		color: var(--color-muted);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(140px, 180px) 1fr;
		align-items: start;
		gap: 12px 16px;
		padding: 10px 14px;
		border-radius: 10px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.row.up {
		border-color: color-mix(in srgb, var(--color-teal) 40%, var(--color-line));
	}
	.row.dn {
		border-color: color-mix(in srgb, var(--color-red) 40%, var(--color-line));
	}
	.rh {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		align-self: center;
	}
	.fname {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		color: var(--color-ink);
		text-transform: capitalize;
	}
	.net {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.row.up .net {
		color: var(--color-teal-ink);
	}
	.row.dn .net {
		color: var(--color-red);
	}
	/* Direction grid — seven fixed columns, one per priority, diverging about a
	   centre axis. Bar height is relative to the largest move on screen. */
	.arc {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
		margin: 8px 0 10px;
	}
	.arc-col {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.arc-cell {
		height: 34px;
		width: 100%;
		display: flex;
		justify-content: center;
		position: relative;
	}
	.arc-cell.up {
		align-items: flex-end;
	}
	.arc-cell.dn {
		align-items: flex-start;
	}
	.arc-bar {
		width: 72%;
		border-radius: 3px;
		min-height: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}
	.arc-val {
		font-family: var(--font-mono);
		font-size: 8.5px;
		font-weight: 800;
		color: var(--color-ink);
		pointer-events: none;
	}
	/* Always-present centre tick keeps the axis readable even where a priority
	   never moved, so an untouched column reads as "held", not as missing data. */
	.arc-axis {
		height: 2px;
		width: 68%;
		opacity: 0.4;
		border-radius: 1px;
	}
	.line {
		/* Third child of a two-column .row — auto-placement put it back in the
		   narrow label column, crushing the chips. Keep it under the arc. */
		grid-column: 2;
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 6px 8px;
	}
	.side-label {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-muted);
		padding-top: 2px;
	}
	.chips {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		color: var(--color-ink);
		border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
	}
	.chip b {
		margin-left: 4px;
		font-variant-numeric: tabular-nums;
	}
	.muted {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		font-style: italic;
		padding: 3px 0;
	}
	.divider {
		display: inline-block;
		width: 1px;
		align-self: stretch;
		background: var(--color-line);
		margin: 2px 4px;
		min-height: 18px;
	}
</style>
