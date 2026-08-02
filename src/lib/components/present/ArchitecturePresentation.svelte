<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { architecturePresentation } from '$lib/game';

	/**
	 * Architecture concept + presentation plan.
	 * Images are references; zones show who funded the Common Ground layout.
	 */
	let {
		room,
		compact = false
	}: {
		room: RoomState;
		compact?: boolean;
	} = $props();

	const plan = $derived(architecturePresentation(room));
	let slide = $state(0);
	// Clamp on read, not by writing back in an $effect — writing state inside an
	// effect that also reads it is the shape that caused effect_update_depth_exceeded.
	const idx = $derived(Math.min(slide, Math.max(0, plan.slides.length - 1)));
	const active = $derived(plan.slides[idx]);
</script>

<div class="ap" class:compact>
	<header class="head">
		<div>
			<p class="cg-kicker" style="margin:0; --k-color: var(--color-teal-ink)">Architecture concept · presentation plan</p>
			<p class="mandate">{plan.mandate}</p>
		</div>
		{#if plan.drawingCount}
			<span class="badge">{plan.drawingCount} ref drawings</span>
		{/if}
	</header>

	{#if plan.slides.length}
		<div class="slide">
			{#if active?.imageUrl}
				<img src={active.imageUrl} alt={active.title} />
			{:else}
				<div class="ph">Reference drawing pending</div>
			{/if}
			<div class="slide-body" style="--c:{active?.color ?? 'var(--color-teal)'}">
				<p class="st">{active?.title}</p>
				<p class="sb">{active?.body}</p>
			</div>
		</div>
		<div class="nav">
			<button type="button" class="nb" disabled={idx <= 0} onclick={() => (slide = Math.max(0, idx - 1))}
				>←</button
			>
			<div class="dots">
				{#each plan.slides as s, i (s.title + i)}
					<button
						type="button"
						class="dot"
						class:on={i === idx}
						style="--c:{s.color ?? 'var(--color-teal)'}"
						onclick={() => (slide = i)}
						aria-label={s.title}
					></button>
				{/each}
			</div>
			<button
				type="button"
				class="nb"
				disabled={idx >= plan.slides.length - 1}
				onclick={() => (slide = Math.min(plan.slides.length - 1, idx + 1))}>→</button
			>
		</div>
	{/if}

	<section class="zones" aria-label="Function contribution to Common Ground zones">
		<p class="cg-kicker" style="margin:0; --k-track: 0.12em">Who built each Common Ground zone</p>
		<p class="zs">{plan.layoutPlan}</p>
		{#each plan.zones.filter((z) => z.preferred || z.pct >= 8) as z (z.priority)}
			<div class="zrow">
				<div class="zmeta">
					<span class="zname" style="color:{z.color}">{z.zone}</span>
					<span class="zpct">{z.pct}% of plan</span>
				</div>
				<div class="stack" title="Share of this zone by function">
					{#each z.byFunction as f (f.tableId)}
						{#if f.shareOfZone > 0}
							<div
								class="seg"
								style="width:{Math.max(f.shareOfZone, 2)}%;background:{f.color}"
								title="{f.name}: {f.shareOfZone}% of zone"
							></div>
						{/if}
					{/each}
				</div>
				<div class="contrib">
					{#each z.byFunction.slice(0, 4) as f (f.tableId)}
						<span class="cf" style="--c:{f.color}">{f.name} {f.shareOfZone}%</span>
					{/each}
				</div>
			</div>
		{:else}
			<p class="empty">Place stake to see function → zone contributions.</p>
		{/each}
	</section>
</div>

<style>
	.ap {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.head {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: flex-start;
	}
	.mandate {
		margin: 4px 0 0;
		font-size: 13px;
		line-height: 1.4;
		font-weight: 600;
		color: var(--color-ink);
	}
	.badge {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		padding: 4px 8px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--color-teal) 40%, transparent);
		color: var(--color-teal-ink);
	}
	.slide {
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--color-line);
		background: var(--color-well);
	}
	.slide img {
		width: 100%;
		aspect-ratio: 16 / 9;
		max-height: 200px;
		object-fit: cover;
		display: block;
	}
	.compact .slide img {
		max-height: 140px;
	}
	.ph {
		aspect-ratio: 16 / 9;
		max-height: 140px;
		display: grid;
		place-items: center;
		color: var(--color-muted);
		font-size: 12px;
		background: var(--color-well);
	}
	.slide-body {
		padding: 10px 12px;
		background: color-mix(in srgb, var(--c) 12%, var(--color-panel));
		border-top: 2px solid var(--c);
	}
	.st {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 13px;
	}
	.sb {
		margin: 4px 0 0;
		font-size: 12px;
		line-height: 1.4;
		color: var(--color-muted);
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.nb {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		cursor: pointer;
		font-weight: 800;
	}
	.nb:disabled {
		opacity: 0.35;
	}
	.dots {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		justify-content: center;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: none;
		padding: 0;
		background: var(--color-line);
		cursor: pointer;
	}
	.dot.on {
		background: var(--c, var(--color-teal));
		box-shadow: 0 0 8px var(--c, var(--color-teal));
	}
	.zones {
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 10px 12px;
	}
	.zs {
		margin: 4px 0 10px;
		font-size: 11px;
		color: var(--color-ink);
		font-weight: 600;
		line-height: 1.35;
	}
	.zrow {
		margin-bottom: 10px;
	}
	.zmeta {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 4px;
	}
	.zname {
		font-size: 12px;
		font-weight: 800;
	}
	.zpct {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
	}
	.stack {
		display: flex;
		height: 10px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
	}
	.seg {
		height: 100%;
		min-width: 2px;
	}
	.contrib {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 4px;
	}
	.cf {
		font-size: 9px;
		font-weight: 700;
		padding-left: 6px;
		border-left: 2px solid var(--c);
		color: var(--color-muted);
	}
	.empty {
		margin: 0;
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
