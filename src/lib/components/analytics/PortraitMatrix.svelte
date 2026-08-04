<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { N_PRIORITIES } from '$lib/game/types';
	import {
		PRIORITY_COLORS,
		priorityShort,
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

	const short = priorityShort;

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

	/**
	 * Disc radius for a cell value, in the 40-unit viewBox.
	 *
	 * Radius scales with sqrt(v) so *area* is proportional to the money — the
	 * standard for symbol maps. Using radius directly would exaggerate a 30 over
	 * a 10 by 9x instead of 3x. Floor of 5 keeps the smallest stake visible from
	 * the back of a room; 17 leaves a hair of gutter inside the cell.
	 */
	function discR(v: number): number {
		if (v <= 0) return 0;
		const t = Math.sqrt(Math.min(1, v / model.max));
		return 5 + t * 12;
	}
</script>

<div class="pm" aria-label="Common board — functions × priorities">
	{#if !model.hasData}
		<div class="blank cg-empty">Waiting for stake — tables place chips, the analysis builds here.</div>
	{:else}
		<div
			class="grid"
			style="--n:{n}; grid-template-columns: minmax(72px, 0.85fr) repeat(7, minmax(0, 1fr)); grid-template-rows: auto repeat({n}, minmax(44px, 1fr));"
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
					<div
						class="cell"
						class:cg-surprise={isSurprise}
						class:empty={v === 0}
						title="{persona.name} · {names[ci]}: {formatUsd(v)}"
					>
						<!-- Magnitude is the disc AREA, not a tint. Seven different hues can't
						     be compared by saturation — you can't rank a 43% purple against a
						     69% teal — so the old tinted number grid encoded *which* priority
						     but never *how much*. Area is pre-attentive and works across hues. -->
						{#if v > 0}
							<svg class="disc" viewBox="0 0 40 40" aria-hidden="true">
								<circle cx="20" cy="20" r={discR(v)} fill={PRI_COLORS[ci]} />
							</svg>
							<span class="num">{v}</span>
						{:else}
							<span class="num zero">·</span>
						{/if}
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
		/* Cap the width so cells stay near-square. Full-bleed on a 1600px stage
		   made them 191x35 — a 5.5:1 letterbox, which reads as a spreadsheet row
		   and leaves the discs swimming in empty space. At 820px the data cells
		   land near 95x60, close enough that a disc reads as a disc. */
		max-width: 820px;
		margin-inline: auto;
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
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		height: 100%;
		width: 100%;
		border-radius: 10px;
		padding: 2px;
	}
	/* The disc is the data; it sits behind the numeral and is centred on the
	   cell so a row scans as a row of dots of varying weight. */
	.disc {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.disc circle {
		transition: r var(--dur-slow, 480ms) var(--ease-out-quart, ease);
	}
	.cell.empty {
		background: color-mix(in srgb, var(--color-ink) 4%, transparent);
	}
	.num {
		position: relative;
		font-weight: 800;
		/* Smaller than before: the disc now carries the magnitude, so the numeral
		   is a read-out for anyone close enough to want the exact figure. */
		font-size: clamp(12px, 1.3vw, 16px);
		line-height: 1.05;
		font-family: var(--font-display);
		/* Literal dark, not var(--color-ink): this renders inside .stage-dark where
		   that token flips to cream, and every disc fill is pale. */
		color: #111a14;
		font-variant-numeric: tabular-nums;
	}
	.num.zero {
		opacity: 0.28;
		font-weight: 600;
		color: var(--color-muted);
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
		animation: cg-fade var(--dur-slow, 480ms) var(--ease-out-quart, ease) var(--dur-stage, 800ms) forwards;
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
