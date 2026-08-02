<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import {
		architecturePresentation,
		drawingSetFromRoom,
		roomInsights,
		zoneContributions
	} from '$lib/game';

	/**
	 * Concept / workspace design composition board.
	 * Prefers generated architectural sheets (plan, section, collage…);
	 * falls back to zone mosaic from concept refs.
	 */
	let { room }: { room: RoomState } = $props();

	const plan = $derived(architecturePresentation(room));
	const insights = $derived(roomInsights(room));
	const zones = $derived(zoneContributions(room).filter((z) => z.pct > 0));
	const preferred = $derived(zones.filter((z) => z.preferred).slice(0, 6));
	const secondary = $derived(zones.filter((z) => !z.preferred).slice(0, 4));
	const drawings = $derived(drawingSetFromRoom(room));
	const designs = $derived(room.workspaceDesigns ?? []);
	const roomUrl = $derived(
		room.finaleImageUrl ?? room.roomConceptUrls?.[0] ?? ''
	);
	const fnDrawings = $derived(drawings.filter((d) => d.kind === 'function'));
	const collage = $derived(designs.find((d) => d.kind === 'collage') ?? designs[0]);
	const otherSheets = $derived(designs.filter((d) => d !== collage));

	function zoneImage(z: (typeof zones)[0]): string {
		const lead = z.byFunction[0];
		if (lead) {
			const d = fnDrawings.find((x) => x.tableId === lead.tableId);
			if (d?.url) return d.url;
		}
		return roomUrl;
	}

	const hasDesigns = $derived(designs.length > 0);
	const hasRefs = $derived(drawings.length > 0);
</script>

{#if hasDesigns}
	<section class="sheet" aria-label="Workspace design composition">
		<header class="titleblock">
			<div class="tb-left">
				<p class="kicker">ZyetaI · workspace design set</p>
				<h2>Architectural composition</h2>
				<p class="sub">{plan.layoutPlan}</p>
			</div>
			<div class="tb-right">
				<span class="badge">From brief + {drawings.length} refs</span>
				{#if insights.hasData}
					<span class="meta">Lead <b>{insights.lead}</b></span>
				{/if}
				<span class="meta mono">{designs.length} sheets</span>
			</div>
		</header>

		{#if collage}
			<figure class="hero-sheet">
				<img src={collage.url} alt={collage.label} />
				<figcaption>
					<span class="rh-lab">A · {collage.label}</span>
					<span class="rh-m">{plan.mandate}</span>
				</figcaption>
			</figure>
		{/if}

		{#if otherSheets.length}
			<div class="sheets-row">
				<p class="zb-lab">B · Plans · sections · elevations · concepts</p>
				<div class="sgrid">
					{#each otherSheets as s (s.url)}
						<figure class="sfig">
							<img src={s.url} alt={s.label} />
							<figcaption>
								<span class="sk">{s.kind}</span>
								{s.label}
							</figcaption>
						</figure>
					{/each}
				</div>
			</div>
		{/if}

		{#if preferred.length}
			<div class="fund">
				<p class="fund-lab">C · Who funds each zone</p>
				<div class="fund-grid">
					{#each preferred as z (z.priority)}
						<div class="frow" style="--zc:{z.color}">
							<span class="fz">{z.zone}</span>
							<div class="fstack">
								{#each z.byFunction.slice(0, 5) as f (f.tableId)}
									<span
										class="fseg"
										style="width:{Math.max(f.shareOfZone, 3)}%;background:{f.color}"
										title="{f.name} {f.shareOfZone}%"
									></span>
								{/each}
							</div>
							<span class="fpct">{z.pct}%</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if fnDrawings.length}
			<div class="lenses">
				<p class="lk">D · Concept reference lenses</p>
				<div class="lrow">
					{#each fnDrawings as d (d.url)}
						<figure class="lfig" style="--c:{d.color}">
							<img src={d.url} alt={d.label} />
							<figcaption>{d.label}</figcaption>
						</figure>
					{/each}
				</div>
			</div>
		{/if}

		<footer class="sheet-foot">
			<span>High-quality sheets from brief + concept refs</span>
			<span class="sf-n">Created by ZyetaI</span>
		</footer>
	</section>
{:else if hasRefs && room.enhancedBrief}
	<section class="sheet pending" aria-label="Awaiting workspace design">
		<header class="titleblock">
			<div class="tb-left">
				<p class="kicker">Concept refs ready</p>
				<h2>Generate workspace design</h2>
				<p class="sub">
					Brief is final and {drawings.length} concept images are ready. Run
					<strong>Generate workspace design from brief</strong> for the central layout collage,
					plan, section, and elevation.
				</p>
			</div>
		</header>
		<div class="zone-mosaic preview">
			{#each preferred as z (z.priority)}
				{@const img = zoneImage(z)}
				<article class="zcell" style="--zc:{z.color}">
					{#if img}
						<img src={img} alt={z.zone} />
					{/if}
					<div class="zcap">
						<span class="zp">{z.pct}%</span>
						<span class="zn">{z.zone}</span>
					</div>
				</article>
			{/each}
		</div>
		{#if secondary.length}
			<div class="sec-zones">
				{#each secondary as z (z.priority)}
					<span class="sz" style="--zc:{z.color}">{z.pct}% {z.zone}</span>
				{/each}
			</div>
		{/if}
	</section>
{:else if room.aggregate.totalCoins > 0}
	<p class="wait">
		Generate concept images and finalise the brief, then create the workspace design collage.
	</p>
{/if}

<style>
	.sheet {
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--color-teal) 42%, var(--color-line));
		background: var(--color-panel);
		overflow: hidden;
		box-shadow: 0 12px 40px color-mix(in srgb, var(--color-ink) 8%, transparent);
	}
	.titleblock {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: flex-start;
		padding: 14px 16px;
		border-bottom: 2px solid color-mix(in srgb, var(--color-teal) 35%, var(--color-line));
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--color-teal) 10%, var(--color-panel)),
			var(--color-panel) 55%
		);
	}
	.kicker {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-teal);
	}
	h2 {
		margin: 3px 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.15rem, 2.2vw, 1.45rem);
		font-weight: 900;
		letter-spacing: -0.025em;
	}
	.sub {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.4;
		max-width: 52ch;
	}
	.tb-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 5px;
		flex-shrink: 0;
	}
	.badge {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--color-teal) 45%, transparent);
		background: color-mix(in srgb, var(--color-teal) 12%, transparent);
		color: var(--color-teal);
	}
	.meta {
		font-size: 11px;
		color: var(--color-muted);
	}
	.meta b {
		color: var(--color-ink);
		font-weight: 800;
	}
	.meta.mono {
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.hero-sheet {
		margin: 0;
		position: relative;
		background: #0a0f1a;
	}
	.hero-sheet img {
		width: 100%;
		max-height: 360px;
		object-fit: cover;
		display: block;
	}
	.hero-sheet figcaption {
		position: absolute;
		inset: auto 0 0 0;
		padding: 16px 14px 12px;
		background: linear-gradient(to top, rgba(8, 12, 22, 0.94), transparent);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rh-lab {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-teal);
	}
	.rh-m {
		font-size: 12px;
		font-weight: 600;
		color: #f0e8d4;
		line-height: 1.35;
		max-width: 52ch;
	}
	.sheets-row {
		padding: 12px 12px 10px;
		background: #0a0f1a;
	}
	.zb-lab,
	.fund-lab,
	.lk {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #8a8578;
	}
	.sgrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 8px;
	}
	.sfig {
		margin: 0;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, #fff 12%, transparent);
	}
	.sfig img {
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
		display: block;
	}
	.sfig figcaption {
		padding: 6px 8px;
		font-size: 10px;
		font-weight: 700;
		color: #d8d0bc;
		background: #121820;
	}
	.sk {
		display: block;
		font-family: var(--font-mono);
		font-size: 8px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-teal);
		margin-bottom: 2px;
	}
	.fund {
		padding: 12px 14px 10px;
		border-top: 1px solid var(--color-line);
	}
	.fund-grid {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.frow {
		display: grid;
		grid-template-columns: minmax(72px, 110px) 1fr 36px;
		gap: 8px;
		align-items: center;
	}
	.fz {
		font-size: 11px;
		font-weight: 700;
		border-left: 3px solid var(--zc);
		padding-left: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.fstack {
		display: flex;
		height: 10px;
		border-radius: 99px;
		overflow: hidden;
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
	}
	.fseg {
		display: block;
		height: 100%;
		min-width: 2px;
	}
	.fpct {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		text-align: right;
		color: var(--color-muted);
	}
	.lenses {
		padding: 12px 14px 14px;
		border-top: 1px solid var(--color-line);
	}
	.lk {
		color: var(--color-muted);
	}
	.lrow {
		display: flex;
		gap: 8px;
		overflow-x: auto;
	}
	.lfig {
		margin: 0;
		flex: 0 0 120px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--c) 42%, var(--color-line));
	}
	.lfig img {
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
		display: block;
	}
	.lfig figcaption {
		padding: 5px 8px;
		font-size: 10px;
		font-weight: 700;
		background: color-mix(in srgb, var(--c) 12%, var(--color-panel));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sheet-foot {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 14px;
		border-top: 1px solid var(--color-line);
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--color-muted);
	}
	.sf-n {
		font-weight: 800;
		color: var(--color-teal);
	}
	.zone-mosaic {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 8px;
		background: #0a0f1a;
		min-height: 120px;
	}
	.zone-mosaic.preview {
		opacity: 0.9;
	}
	.zcell {
		position: relative;
		flex: 1 1 40%;
		min-width: 100px;
		min-height: 90px;
		overflow: hidden;
		border-radius: 6px;
		border: 1px solid color-mix(in srgb, var(--zc) 55%, transparent);
	}
	.zcell img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		min-height: 90px;
	}
	.zcap {
		position: absolute;
		inset: auto 0 0 0;
		padding: 8px;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.88), transparent);
		display: flex;
		flex-direction: column;
	}
	.zp {
		font-family: var(--font-mono);
		font-weight: 800;
		font-size: 14px;
		color: #fff;
	}
	.zn {
		font-size: 11px;
		font-weight: 800;
		color: #f3ecd8;
	}
	.sec-zones {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 14px;
	}
	.sz {
		font-size: 10px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--zc) 45%, transparent);
		background: color-mix(in srgb, var(--zc) 14%, transparent);
		color: var(--color-muted);
	}
	.wait {
		margin: 0;
		padding: 14px;
		font-size: 12px;
		color: var(--color-muted);
		border-radius: 12px;
		border: 1px dashed var(--color-line);
		text-align: center;
	}
</style>
