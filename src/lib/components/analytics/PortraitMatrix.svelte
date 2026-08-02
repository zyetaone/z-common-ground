<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { N_PRIORITIES } from '$lib/game/types';
	import {
		PRIORITY_COLORS,
		formatUsd,
		roomPersonas,
		roomPortrait,
		roomPriorities,
		sum
	} from '$lib/game';

	let { room }: { room: RoomState } = $props();

	const PRI_COLORS = PRIORITY_COLORS;
	const personas = $derived(roomPersonas(room));
	const names = $derived(roomPriorities(room));
	const n = $derived(personas.length);

	const SHORT = ['Talent', 'Experience', 'Brand', 'Productivity', 'Innovation', 'Cost / ROI', 'Future'];
	const short = (ci: number, label: string) => SHORT[ci] ?? label;

	const model = $derived.by(() => {
		const seatCoins = roomPortrait(room.tables);
		const grand = sum(seatCoins.flat());
		const max = Math.max(1, ...seatCoins.flat());
		const s = room.aggregate.surprise;
		return {
			seatCoins,
			max,
			surprise: s,
			hasData: grand > 0
		};
	});

	const surpriseCaption = $derived.by(() => {
		const s = model.surprise;
		if (!s) return '';
		return `${personas[s.seat]?.name ?? 'A function'} leaned into ${names[s.priority]}`;
	});

	function cellBg(v: number, pri: number): string {
		if (v <= 0) return 'var(--color-panel)';
		const t = Math.min(1, v / model.max);
		const mix = Math.round(18 + t * 76);
		return `color-mix(in srgb, ${PRI_COLORS[pri]} ${mix}%, var(--color-panel))`;
	}

	function isDark(v: number): boolean {
		return v / model.max > 0.48;
	}
</script>

<div class="pm" aria-label="Common board — functions × priorities">
	{#if !model.hasData}
		<div class="blank cg-empty">Waiting for priorities…</div>
	{:else}
		<div
			class="grid"
			style="--n:{n}; grid-template-columns: minmax(72px, 0.85fr) repeat(7, minmax(0, 1fr)); grid-template-rows: auto repeat({n}, minmax(0, 1fr));"
		>
			<div class="corner" aria-hidden="true"></div>
			{#each names as col, ci (ci)}
				<div class="colh" style="color:{PRI_COLORS[ci]}">{short(ci, col)}</div>
			{/each}

			{#each personas as persona, si (si)}
				<div class="rowh">
					<i style:background={persona.color}></i>
					<span class="truncate">{persona.name}</span>
				</div>
				{#each Array(N_PRIORITIES) as _, ci (ci)}
					{@const v = model.seatCoins[si]?.[ci] ?? 0}
					{@const isSurprise =
						model.surprise && model.surprise.seat === si && model.surprise.priority === ci}
					{@const dark = isDark(v)}
					<div
						class="cell"
						class:cg-surprise={isSurprise}
						style="background:{cellBg(v, ci)}"
						title="{persona.name} · {names[ci]}: {formatUsd(v)}"
					>
						<span class="num" class:dark class:zero={v === 0}>{v || '·'}</span>
					</div>
				{/each}
			{/each}
		</div>

		{#if model.surprise}
			<div class="cg-callout">
				<span>◈</span>
				<span>Surprise — <b>{surpriseCaption}.</b></span>
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
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 10px 12px;
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
		gap: 5px;
		font-size: 9.5px;
		width: 100%;
	}
	.corner {
		min-height: 22px;
	}
	.colh {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		min-height: 22px;
		min-width: 0;
		padding: 2px 1px;
		text-align: center;
		line-height: 1.15;
		font-weight: 700;
		font-size: clamp(11px, 1.25vw, 14px);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rowh {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 6px;
		min-width: 0;
		min-height: 0;
		padding: 0 4px;
		color: var(--color-muted);
		font-size: clamp(11px, 1.15vw, 13px);
		font-weight: 600;
	}
	.rowh .truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.rowh i {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 8px color-mix(in srgb, currentColor 40%, transparent);
	}
	.cell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 0;
		height: 100%;
		width: 100%;
		border-radius: 10px;
		padding: 2px;
		border: 1px solid rgba(255, 255, 255, 0.04);
		transition:
			background-color 0.55s ease,
			border-color 0.55s ease;
	}
	.num {
		font-weight: 800;
		font-size: clamp(16px, 2.2vw, 28px);
		line-height: 1.05;
		font-family: var(--font-display);
		color: var(--color-ink);
		font-variant-numeric: tabular-nums;
	}
	.num.dark {
		color: #ffffff;
	}
	.num.zero {
		opacity: 0.28;
		font-weight: 600;
		font-size: clamp(12px, 1.2vw, 16px);
	}
	.cg-surprise {
		outline: 2px solid var(--color-gold);
		outline-offset: 1px;
		box-shadow: 0 0 16px color-mix(in srgb, var(--color-gold) 35%, transparent);
	}
	.cg-callout {
		flex-shrink: 0;
		margin-top: 8px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--color-gold-ink);
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
