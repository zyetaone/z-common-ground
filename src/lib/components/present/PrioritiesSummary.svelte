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
			out.push({ seat: s, name: p.name, color: p.color, cut, build, net });
		}
		return out;
	});

	const ready = $derived(
		moves.length > 0 && moves.some((m) => m.cut.length > 0 || m.build.length > 0)
	);

	const fmt = (t: number, sign: '+' | '−') => `${sign}$${t}M`;
</script>

<div class="ps">
	{#if !ready}
		<div class="empty">
			<p class="empty-title">No cut or rebuild yet</p>
			<p class="empty-sub">Once a function trims and re-stakes, their strategy lands here.</p>
		</div>
	{:else}
		<section class="rows stagger" aria-label="Per-function cut and rebuild">
			{#each moves as m, mi (m.seat)}
				<article class="row" class:up={m.net > 0} class:dn={m.net < 0}>
					<header class="rh">
						<span class="dot" style="background:{m.color}" aria-hidden="true"></span>
						<span class="fname">{m.name}</span>
						<span class="net">
							{m.net === 0 ? 'flat' : `net ${fmt(Math.abs(m.net), m.net > 0 ? '+' : '−')}`}
						</span>
					</header>

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
	.line {
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
