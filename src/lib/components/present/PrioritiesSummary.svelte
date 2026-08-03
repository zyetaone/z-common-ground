<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import {
		PRIORITY_COLORS,
		roomPersonas,
		roomPriorities
	} from '$lib/game';

	/**
	 * Screen 4 — What each function did (cut at R3, rebuilt at R5, net effect).
	 *
	 * The cut (R3) and the rebuild (R5) told through each function's lens.
	 * For every function: what did they cut (R2 → R3), what did they rebuild
	 * (R3 → R5), and the net effect.
	 *
	 * The numbers on each row are $M (table wallet units). Each table starts at
	 * $100M; a function that did "-30, -10" at the cut took $40M off the table.
	 * The percentages from screen 3 are share-of-room — these are the actual
	 * dollars each function moved.
	 */
	let { room }: { room: RoomState } = $props();

	const names = $derived(roomPriorities(room));
	const colors = PRIORITY_COLORS;
	const personas = $derived(roomPersonas(room));

	type Cut = { priority: number; name: string; tokens: number; color: string };
	type Move = Cut;

	type FunctionMove = {
		seat: number;
		name: string;
		color: string;
		cut: Move[]; // R2 → R3 (negative)
		build: Move[]; // R3 → R5 (positive)
		net: number; // R5 - R2 (signed $M)
	};

	/** How much a priority moved in $M between two rounds. Negative = cut. */
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
		// biggest cuts first, then biggest builds
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
			const t = room.tables[s];
			if (!t) continue;
			const p = personas[s];
			if (!p) continue;
			// Function's own board row across the rounds — RoundSnapshot.portrait is
			// seat × priority, so portrait[seat] is that function's $M vector.
			const r2Row = r2.portrait[s] ?? [];
			const r3Row = r3.portrait[s] ?? [];
			const r5Row = r5.portrait[s] ?? [];

			const cutDeltas = diffByPriority(r2Row, r3Row).filter((d) => d.tokens < 0);
			const buildDeltas = diffByPriority(r3Row, r5Row).filter((d) => d.tokens > 0);
			const allChanges = diffByPriority(r2Row, r5Row);
			const net = allChanges.reduce((s, d) => s + d.tokens, 0);

			out.push({
				seat: s,
				name: p.name,
				color: p.color,
				cut: cutDeltas
					.filter((d) => d.tokens < 0)
					.map((d) => ({
						priority: d.priority,
						name: names[d.priority] ?? '—',
						tokens: d.tokens,
						color: colors[d.priority] as string
					})),
				build: buildDeltas
					.filter((d) => d.tokens > 0)
					.map((d) => ({
						priority: d.priority,
						name: names[d.priority] ?? '—',
						tokens: d.tokens,
						color: colors[d.priority] as string
					})),
				net
			});
		}
		return out;
	});

	const ready = $derived(moves.length > 0 && moves.some((m) => m.cut.length > 0 || m.build.length > 0));
	let showHelp = $state(false);

	function fmtDelta(t: number): string {
		// signed $M: +$40M / −$30M
		const sign = t > 0 ? '+' : t < 0 ? '−' : '';
		return sign + '$' + Math.abs(t) + 'M';
	}
</script>

<div class="ps">
	<header class="head">
		<button
			type="button"
			class="info-btn"
			aria-expanded={showHelp}
			onclick={() => (showHelp = !showHelp)}
			aria-label="How to read this analysis"
		>
			<span class="info-ic" aria-hidden="true">i</span>
			<span>How to read this</span>
		</button>
	</header>

	{#if showHelp}
		<section class="help" aria-label="How to read this screen">
			<p>
				One row per function. The left block (<strong>cut at R3</strong>) shows what
				each function took off the table when the budget was cut. The right block
				(<strong>rebuilt at R5</strong>) shows what they put back. Each cell is
				<strong>one priority, in $M</strong> — a function that did
				<em>−10, −10, −10</em> removed $10M from three different priorities.
			</p>
			<p>
				The <strong>net</strong> number on the far right is R5 minus R2 — the
				function's total wallet movement. <span class="up">Teal</span> = net positive
				(rebuilt more than cut). <span class="dn">Red</span> = net negative. The
				percentages on screen 3 are <em>shares of the room</em> — these are the
				actual $M each function moved.
			</p>
		</section>
	{/if}

	{#if !ready}
		<p class="empty">No cut or rebuild yet. Once a function trims and re-stakes, their strategy lands here.</p>
	{:else}
		<header class="col-headers" aria-hidden="true">
			<span class="ch-name"></span>
			<span class="ch-block">CUT (R3)</span>
			<span class="ch-block">REBUILT (R5)</span>
			<span class="ch-net">NET</span>
		</header>

		<section class="rows stagger" aria-label="Per-function cut and rebuild">
			{#each moves as m, mi (m.seat)}
				<div class="row" style="--i:{mi}" class:up={m.net > 0} class:dn={m.net < 0} class:still={m.cut.length === 0 && m.build.length === 0}>
					<header class="rh">
						<span class="dot" style="background:{m.color}"></span>
						<span class="fname">{m.name}</span>
					</header>

					<div class="moves" aria-label="Moves at the cut">
						{#each m.cut as c (c.priority)}
							<span class="chip cut" style="--c:{c.color}">
								{c.name} <b>{fmtDelta(c.tokens)}</b>
							</span>
						{:else}
							<span class="empty-cell">—</span>
						{/each}
					</div>

					<div class="moves" aria-label="Moves at the rebuild">
						{#each m.build as b (b.priority)}
							<span class="chip build" style="--c:{b.color}">
								{b.name} <b>{fmtDelta(b.tokens)}</b>
							</span>
						{:else}
							<span class="empty-cell">—</span>
						{/each}
					</div>

					<div class="net" class:up={m.net > 0} class:dn={m.net < 0}>
						{fmtDelta(m.net)}
					</div>
				</div>
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
		overflow: auto;
		padding: 4px 4px 12px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.info-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--color-teal) 35%, transparent);
		background: color-mix(in srgb, var(--color-teal) 10%, transparent);
		color: var(--color-teal-ink);
		cursor: pointer;
	}
	.info-btn:hover {
		background: color-mix(in srgb, var(--color-teal) 18%, transparent);
	}
	.info-ic {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--color-teal);
		color: var(--color-on-teal);
		font-size: 9px;
		font-weight: 800;
		font-style: italic;
	}
	.help {
		padding: 12px 14px;
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-panel) 80%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-teal) 35%, transparent);
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-ink);
	}
	.help p {
		margin: 0 0 8px;
	}
	.help p:last-child {
		margin-bottom: 0;
	}
	.help em {
		font-style: normal;
		font-weight: 700;
		color: var(--color-teal-ink);
	}
	.help .up { color: var(--color-teal-ink); font-weight: 700; }
	.help .dn { color: var(--color-red); font-weight: 700; }
	.empty {
		margin: auto;
		font-size: 13px;
		color: var(--color-muted);
		padding: 48px 16px;
	}
	.col-headers {
		display: grid;
		grid-template-columns: minmax(96px, 130px) 1fr 1fr 60px;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.ch-block { text-align: left; }
	.ch-block:last-of-type::before { content: ''; }
	.ch-net { text-align: right; }
	.rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(96px, 130px) 1fr 1fr 60px;
		align-items: start;
		gap: 10px;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.row.up { border-color: color-mix(in srgb, var(--color-teal) 35%, var(--color-line)); }
	.row.dn { border-color: color-mix(in srgb, var(--color-red) 35%, var(--color-line)); }
	.rh {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding-top: 2px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.fname {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--color-ink);
		text-transform: capitalize;
	}
	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-content: start;
		min-height: 22px;
	}
	.chip {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		color: var(--color-ink);
		border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
	}
	.chip b {
		margin-left: 4px;
		font-variant-numeric: tabular-nums;
	}
	.chip.cut { opacity: 0.95; }
	.chip.build { opacity: 0.95; }
	.empty-cell {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		padding: 2px 0;
	}
	.net {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		text-align: right;
		padding-top: 2px;
	}
	.net.up { color: var(--color-teal-ink); }
	.net.dn { color: var(--color-red); }
</style>