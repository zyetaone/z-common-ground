<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { N_PRIORITIES } from '$lib/game/types';
	import { PERSONAS, PRIORITIES, PRIORITY_COLORS, formatUsd, roomPortrait, sum } from '$lib/game';

	let { room }: { room: RoomState } = $props();

	const PRI_COLORS = PRIORITY_COLORS;

	const short = (p: string) =>
		p.replace('Employee ', 'Emp. ').replace('Employer ', 'Emp. ').replace(' Readiness', '');

	const model = $derived.by(() => {
		const seatCoins = roomPortrait(room.tables);
		const rowTotals = seatCoins.map((row) => sum(row));
		const colTotals = Array.from({ length: N_PRIORITIES }, (_, p) =>
			seatCoins.reduce((s, row) => s + (row[p] ?? 0), 0)
		);
		const grand = sum(rowTotals);
		const max = Math.max(1, ...seatCoins.flat());
		const s = room.aggregate.surprise;
		return {
			seatCoins,
			rowTotals,
			colTotals,
			grand,
			max,
			surprise: s,
			hasData: grand > 0
		};
	});

	const surpriseCaption = $derived.by(() => {
		const s = model.surprise;
		if (!s) return '';
		return `${PERSONAS[s.seat].name} leaned into ${PRIORITIES[s.priority]}`;
	});

	/** Mix priority color into dark panel; stronger = more stake. */
	function cellBg(v: number, pri: number): string {
		if (v <= 0) return 'rgba(10, 61, 43, 0.55)';
		const t = Math.min(1, v / model.max);
		// Floor ~18% so mid cells stay readable; cap ~94%
		const mix = Math.round(18 + t * 76);
		return `color-mix(in srgb, ${PRI_COLORS[pri]} ${mix}%, #0a0f1a)`;
	}

	/** Light text on dark cells; dark text on high-intensity fills */
	function isDark(v: number): boolean {
		return v / model.max > 0.48;
	}
</script>

<div class="pm">
	<div class="head">
		<div class="lab">Combined board · all tables</div>
		{#if model.hasData}
			<div class="grand">{formatUsd(model.grand)}</div>
		{/if}
	</div>

	{#if !model.hasData}
		<div class="blank">Portrait blank until tables place stake</div>
	{:else}
		<div
			class="grid"
			style="grid-template-columns: minmax(72px, 110px) repeat(7, 1fr) minmax(48px, 60px); grid-template-rows: auto repeat(7, minmax(0, 1fr)) auto;"
		>
			<div></div>
			{#each PRIORITIES as col, ci (ci)}
				<div class="colh" style="color:{PRI_COLORS[ci]}">{short(col)}</div>
			{/each}
			<div class="colh sigma">Σ</div>

			{#each PERSONAS as persona, si (si)}
				<div class="rowh">
					<i style:background={persona.color}></i>
					<span class="truncate">{persona.name}</span>
				</div>
				{#each PRIORITIES as _col, ci (ci)}
					{@const v = model.seatCoins[si][ci]}
					{@const isSurprise =
						model.surprise && model.surprise.seat === si && model.surprise.priority === ci}
					{@const dark = isDark(v)}
					<div
						class="cell"
						class:cg-surprise={isSurprise}
						style="background:{cellBg(v, ci)}"
						title="{persona.name} · {PRIORITIES[ci]}: {v} · {formatUsd(v)}"
					>
						<span class="num" class:dark class:zero={v === 0}>{v}</span>
					</div>
				{/each}
				{@const rt = model.rowTotals[si]}
				<div class="tot" title="{persona.name} · {rt}">
					<span class="num totn" style="color:{persona.color}">{rt}</span>
				</div>
			{/each}

			<div class="rowh sigma">Σ</div>
			{#each model.colTotals as ct, ci (ci)}
				<div class="tot" title="{PRIORITIES[ci]} · {ct}">
					<span class="num totn" style="color:{PRI_COLORS[ci]}">{ct}</span>
				</div>
			{/each}
			<div class="tot grand" title="Room · {model.grand}">
				<span class="num totn gold">{model.grand}</span>
				<span class="usd totd gold">{formatUsd(model.grand)}</span>
			</div>
		</div>

		{#if model.surprise}
			<div class="cg-callout">
				<span>◈</span>
				<span>Surprise — <b>{surpriseCaption}.</b> A function broke type.</span>
			</div>
		{/if}
	{/if}
</div>

<style>
	.pm {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: rgba(10, 61, 43, 0.35);
		padding: 14px 16px;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
		flex-shrink: 0;
	}
	.lab {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.grand {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 14px;
		color: var(--color-gold);
	}
	.blank {
		flex: 1;
		display: grid;
		place-items: center;
		color: var(--color-muted);
		font-size: 14px;
	}
	.grid {
		display: grid;
		flex: 1;
		min-height: 0;
		gap: 3px;
		font-size: 9.5px;
	}
	.colh {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		min-height: 28px;
		padding: 2px;
		text-align: center;
		line-height: 1.15;
		font-weight: 700;
		font-size: 12px;
	}
	.colh.sigma,
	.rowh.sigma {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.rowh {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-right: 4px;
		color: var(--color-muted);
		font-size: 11px;
		font-weight: 600;
		min-height: 0;
	}
	.rowh i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 8px color-mix(in srgb, currentColor 40%, transparent);
	}
	.cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		height: 100%;
		width: 100%;
		border-radius: 8px;
		padding: 2px;
		border: 1px solid rgba(255, 255, 255, 0.04);
		transition: background-color 0.55s ease, border-color 0.55s ease;
	}
	.num {
		font-weight: 800;
		font-size: clamp(18px, 1.6vw, 26px);
		line-height: 1.1;
		font-family: var(--font-display);
		color: rgba(253, 248, 237, 0.95);
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
	}
	.num.dark {
		color: #0a0f1a;
		text-shadow: none;
	}
	.num.zero {
		opacity: 0.22;
		font-weight: 600;
		font-size: 12px;
		text-shadow: none;
	}
	.usd {
		font-size: 9px;
		line-height: 1;
		font-family: var(--font-mono);
		color: rgba(253, 248, 237, 0.78);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}
	.tot {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 32px;
		height: 100%;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--color-line) 80%, transparent);
		background: rgba(10, 61, 43, 0.55);
		padding: 2px;
	}
	.tot.grand {
		border-color: color-mix(in srgb, var(--color-gold) 40%, transparent);
		background: color-mix(in srgb, var(--color-gold) 10%, rgba(10, 61, 43, 0.5));
	}
	.totn {
		font-size: clamp(15px, 1.3vw, 20px);
	}
	.tot .usd.totd {
		color: var(--color-muted);
		text-shadow: none;
	}
	.tot .num.gold,
	.tot .usd.gold {
		color: var(--color-gold);
	}
	.cg-surprise {
		outline: 2px solid var(--color-gold);
		outline-offset: 1px;
		box-shadow: 0 0 16px color-mix(in srgb, var(--color-gold) 35%, transparent);
	}
	.cg-callout {
		flex-shrink: 0;
		margin-top: 10px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--color-gold);
		opacity: 0;
		animation: cg-fade 0.55s ease 0.8s forwards;
	}
	.cg-callout b {
		color: var(--color-ink);
	}
	@keyframes cg-fade {
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cg-callout {
			opacity: 1;
			animation: none;
		}
	}
</style>
