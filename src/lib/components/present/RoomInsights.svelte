<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PERSONAS, PRIORITIES, formatUsd, roomInsights } from '$lib/game';

	/** Screen 2 — the alignment story: ring + lead/fault/blind + table↔room + journey (SSOT: roomInsights). */
	let { room }: { room: RoomState } = $props();

	const i = $derived(roomInsights(room));
	const ring = $derived(Math.min(100, Math.max(0, i.index)));
	const circ = 2 * Math.PI * 42;
	const dash = $derived((ring / 100) * circ);
</script>

<div class="ri">
	<aside class="rail">
		<div class="ring-wrap">
			<svg viewBox="0 0 100 100" class="ring" aria-label="Alignment {ring}">
				<circle class="track" cx="50" cy="50" r="42" />
				<circle class="prog" cx="50" cy="50" r="42" stroke-dasharray="{dash} {circ}" />
			</svg>
			<div class="ring-mid">
				<span class="ring-n">{i.hasData ? ring : '—'}</span>
				<span class="ring-l">align</span>
			</div>
		</div>
		<p class="verdict" class:on={i.hasData}>{i.verdict}</p>

		{#if i.hasData}
			<div class="chips">
				<div class="chip lead"><span class="t">Lead</span><strong>{i.lead}</strong></div>
				<div class="chip fault"><span class="t">Fault</span><strong>{i.fault}</strong></div>
				<div class="chip blind"><span class="t">Blind</span><strong>{i.blind}</strong><small>{i.blindTokens > 0 ? formatUsd(i.blindTokens) : ''}</small></div>
			</div>
		{/if}

		{#if i.journey.length > 0}
			<div class="journey" aria-label="Round totals">
				{#each i.journey as j (j.r)}
					{@const h = Math.max(8, (j.total / i.maxJourney) * 100)}
					<div class="jcol">
						<div class="jbar" style="height:{h}%"></div>
						<span class="jr">R{j.r}</span>
					</div>
				{/each}
			</div>
		{/if}
	</aside>

	<div class="main">
		<section class="align-tables">
			<div class="alab">Table ↔ room alignment</div>
			<div class="arows">
				{#each i.tables as t (t.id)}
					<div class="arow" class:locked={t.locked} style="--c:{t.color};--g:{t.commonGround}%">
						<span class="aname"><i></i>T{t.id} {t.name}</span>
						<div class="atrack"><div class="afill"></div></div>
						<span class="aval">{t.commonGround}</span>
					</div>
				{/each}
			</div>
		</section>

		{#if i.surprise}
			<p class="surprise">
				◈ {PERSONAS[i.surprise.seat]?.name} → {PRIORITIES[i.surprise.priority]}
			</p>
		{/if}
	</div>
</div>

<style>
	.ri {
		display: grid;
		grid-template-columns: minmax(160px, 220px) 1fr;
		gap: 14px;
		height: 100%;
		min-height: 0;
		animation: fade-in 0.4s ease both;
	}
	@media (max-width: 900px) {
		.ri {
			grid-template-columns: 1fr;
			overflow: auto;
		}
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
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 14px 12px;
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
	}
	.ring-wrap {
		position: relative;
		width: 120px;
		height: 120px;
	}
	.ring {
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	.track {
		fill: none;
		stroke: rgba(255, 255, 255, 0.06);
		stroke-width: 8;
	}
	.prog {
		fill: none;
		stroke: var(--color-teal);
		stroke-width: 8;
		stroke-linecap: round;
		transition: stroke-dasharray 0.7s cubic-bezier(0.22, 1, 0.36, 1);
		filter: drop-shadow(0 0 8px rgba(55, 182, 162, 0.4));
	}
	.ring-mid {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.ring-n {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 1.75rem;
		line-height: 1;
		color: var(--color-teal);
	}
	.ring-l {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.verdict {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1rem;
		color: var(--color-muted);
	}
	.verdict.on {
		color: var(--color-gold);
	}
	.chips {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.chip {
		border-radius: 10px;
		padding: 8px 10px;
		background: rgba(0, 0, 0, 0.22);
		border-left: 3px solid var(--color-line);
	}
	.chip.lead {
		border-color: var(--color-teal);
	}
	.chip.fault {
		border-color: var(--color-gold);
	}
	.chip.blind {
		border-color: var(--color-red);
	}
	.chip .t {
		display: block;
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.chip strong {
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 800;
	}
	.chip small {
		display: block;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		color: var(--color-muted);
		margin-top: 1px;
	}
	.journey {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 6px;
		width: 100%;
		height: 64px;
		margin-top: auto;
		padding-top: 8px;
	}
	.jcol {
		flex: 1;
		max-width: 28px;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 3px;
	}
	.jbar {
		width: 100%;
		border-radius: 6px 6px 2px 2px;
		background: linear-gradient(180deg, var(--color-gold), var(--color-teal));
		min-height: 4px;
		animation: bar-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
		transform-origin: bottom;
	}
	@keyframes bar-up {
		from {
			transform: scaleY(0);
		}
		to {
			transform: scaleY(1);
		}
	}
	.jr {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--color-muted);
		font-weight: 700;
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
		min-width: 0;
	}
	.align-tables {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border-radius: 14px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 14px 16px;
	}
	.alab {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
		margin-bottom: 8px;
	}
	.arows {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px 14px;
	}
	@media (max-width: 700px) {
		.arows {
			grid-template-columns: 1fr;
		}
	}
	.arow {
		display: grid;
		grid-template-columns: minmax(72px, 1fr) 1.4fr 28px;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}
	.aname {
		display: flex;
		align-items: center;
		gap: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
	}
	.aname i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--c);
		flex-shrink: 0;
		box-shadow: 0 0 8px var(--c);
	}
	.atrack {
		height: 10px;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}
	.afill {
		height: 100%;
		width: var(--g);
		border-radius: 99px;
		background: linear-gradient(90deg, color-mix(in srgb, var(--c) 70%, transparent), var(--c));
		transition: width 0.55s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.arow.locked .aname {
		color: var(--color-teal);
	}
	.aval {
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: 11px;
		text-align: right;
		color: var(--color-gold);
	}
	.surprise {
		margin: 0;
		font-size: 12px;
		color: var(--color-gold);
		font-family: var(--font-display);
		font-weight: 700;
	}
	@media (prefers-reduced-motion: reduce) {
		.ri,
		.jbar {
			animation: none;
		}
		.afill,
		.prog {
			transition: none;
		}
	}
</style>
