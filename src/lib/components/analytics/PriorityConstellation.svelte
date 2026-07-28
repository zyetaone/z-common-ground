<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { N_PRIORITIES } from '$lib/game/types';
	import { PERSONAS, PRIORITIES, roomPortrait, sum } from '$lib/game';

	let { room }: { room: RoomState } = $props();

	const short = (p: string) =>
		p.replace('Employee ', 'Emp. ').replace('Employer ', 'Emp. ').replace(' Readiness', '');

	const model = $derived.by(() => {
		const seatCoins = roomPortrait(room.tables);
		const totals = Array.from({ length: N_PRIORITIES }, (_, i) =>
			seatCoins.reduce((acc, row) => acc + (row[i] ?? 0), 0)
		);
		const maxTotal = Math.max(1, ...totals);
		const rows = PRIORITIES.map((label, i) => {
			const segs = PERSONAS.map((persona, s) => ({
				s,
				color: persona.color,
				name: persona.name,
				w: (seatCoins[s][i] / maxTotal) * 100,
				tokens: seatCoins[s][i]
			})).filter((seg) => seg.tokens > 0);
			return { i, label: short(label), total: totals[i], segs, contributors: segs.length };
		});
		const grand = sum(totals);

		// Most concentrated: fewest contributors, highest dominance
		const ranked = rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total);
		const dominated = rows
			.filter(r => r.total > 0)
			.sort((a, b) => a.contributors - b.contributors || b.total - a.total)[0];
		const broadest = rows
			.filter(r => r.total > 0)
			.sort((a, b) => b.contributors - a.contributors || a.total - b.total)[0];

		return { rows, grand, hasData: grand > 0, top: ranked[0], dominated, broadest };
	});
</script>

<div class="pc">
	<div class="head">
		<div class="kicker">Priority Constellation</div>
		<div class="sub">Every token in the room, stacked by the function that placed it.</div>
	</div>

	{#if !model.hasData}
		<div class="empty">No tokens placed yet.</div>
	{:else}
		<div class="bars">
			{#each model.rows as row (row.i)}
				<div class="row">
					<div class="label">{row.label}</div>
					<div class="track">
						{#each row.segs as seg (seg.s)}
							<div class="seg" style="width:{seg.w}%;background:{seg.color}" title="{seg.name}: {seg.tokens} tokens"></div>
						{/each}
					</div>
					<div class="val">{Math.round(row.total)}</div>
				</div>
			{/each}
		</div>

		{#if model.top && model.broadest && model.dominated}
			<div class="summary">
				<p>
					<b style="color:var(--color-gold)">{model.top.label}</b> leads at {Math.round((model.top.total / model.grand) * 100)}% of the room. &nbsp;
					<b>{model.broadest.label}</b> has the broadest backing ({model.broadest.contributors} functions). &nbsp;
					<b>{model.dominated.label}</b> is most concentrated — only {model.dominated.contributors} voice{model.dominated.contributors > 1 ? 's' : ''}.
				</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.pc {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 16px 18px;
		height: 100%;
		overflow: auto;
	}
	.head { margin-bottom: 16px; }
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-gold);
	}
	.sub {
		font-size: 12px;
		color: var(--color-muted);
		margin-top: 4px;
	}
	.empty {
		display: grid;
		place-items: center;
		height: 240px;
		color: var(--color-muted);
		font-size: 14px;
		border: 1px dashed var(--color-line);
		border-radius: 12px;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 110px 1fr 44px;
		align-items: center;
		gap: 10px;
	}
	.label {
		font-size: 13px;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.track {
		display: flex;
		height: 26px;
		border-radius: 8px;
		overflow: hidden;
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.06);
	}
	.seg {
		height: 100%;
		min-width: 2px;
		transition: width 0.5s ease;
	}
	.val {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 800;
		color: var(--color-gold);
		text-align: right;
	}
	.summary {
		margin-top: 16px;
		padding: 12px 16px;
		border-radius: 12px;
		border: 1px solid rgba(255,255,255,0.08);
		background: rgba(0,0,0,0.18);
	}
	.summary p {
		margin: 0;
		font-size: 13px;
		color: var(--color-muted);
		line-height: 1.6;
	}
	.summary b { color: var(--color-ink); }
</style>
