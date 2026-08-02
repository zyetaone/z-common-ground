<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import {
		designCardsFromRoom,
		drawingSetFromRoom,
		roomInsights,
		roomRoundStory,
		roomThesis
	} from '$lib/game';
	import { SESSION, session } from '$lib/state';
	import ZyetaI from '$lib/components/ZyetaI.svelte';

	/**
	 * Lookbook modal — editable brief + concept refs.
	 * Full architectural drawing set → /present/LIVE/design (extra page).
	 */
	let {
		room,
		onClose,
		onRegen
	}: {
		room: RoomState;
		onClose: () => void;
		onRegen?: () => void;
	} = $props();

	const cards = $derived(designCardsFromRoom(room));
	const roomCard = $derived(cards.find((c) => c.kind === 'room'));
	const fnCards = $derived(cards.filter((c) => c.kind === 'function'));
	const drawings = $derived(drawingSetFromRoom(room));
	const insights = $derived(roomInsights(room));
	const story = $derived(roomRoundStory(room));
	const thesis = $derived(roomThesis(room));
	const narrative = $derived(room.enhancedBrief ?? '');

	let drawIdx = $state(0);
	const activeDraw = $derived(drawings[Math.min(drawIdx, Math.max(0, drawings.length - 1))]);

	let editing = $state(false);
	let draft = $state('');

	$effect(() => {
		if (drawIdx >= drawings.length) drawIdx = 0;
	});

	function startEdit() {
		draft = narrative;
		editing = true;
	}
	function cancelEdit() {
		editing = false;
		draft = '';
	}
	function saveEdit() {
		session.updateBrief(draft);
		editing = false;
	}

	function copyNarrative() {
		const t = narrative || '';
		if (typeof navigator !== 'undefined' && navigator.clipboard && t) {
			navigator.clipboard.writeText(t);
		}
	}
</script>

<div class="report">
	<header class="cover">
		<div>
			<div class="cover-brand">
				<ZyetaI variant="badge" />
			</div>
			<p class="kicker">Lookbook · brief + concept refs</p>
			<h1>Common Ground</h1>
			<p class="sub">{thesis.wallet} {thesis.commonGround}</p>
			{#if insights.hasData}
				<div class="stats">
					<span class="stat"><b>{insights.index}</b> CGI · {insights.verdict}</span>
					<span class="stat">Lead <b>{insights.lead}</b></span>
					<span class="stat">Fault <b>{insights.fault}</b></span>
					<span class="stat">Blind <b>{insights.blind}</b></span>
				</div>
			{/if}
		</div>
		<div class="cover-acts">
			<button type="button" class="btn ghost" onclick={onClose}>Close</button>
		</div>
	</header>

	<section class="sec narr">
		<div class="sec-h">
			<h2>01 · Brief</h2>
			<div class="acts-inline">
				{#if editing}
					<button type="button" class="btn ghost" onclick={cancelEdit}>Cancel</button>
					<button type="button" class="btn primary" onclick={saveEdit}>Save</button>
				{:else}
					<button type="button" class="btn ghost" onclick={copyNarrative}>Copy</button>
					<button type="button" class="btn" onclick={startEdit}>Edit</button>
				{/if}
			</div>
		</div>
		{#if editing}
			<textarea class="edit-area" bind:value={draft} rows="12" aria-label="Edit brief"></textarea>
		{:else if narrative}
			<pre class="narr-body">{narrative}</pre>
		{:else}
			<p class="muted">No brief yet — generate concepts first.</p>
		{/if}
	</section>

	{#if drawings.length}
		<section class="sec drawings">
			<div class="sec-h">
				<h2>02 · Concept references</h2>
				<span class="count">{drawIdx + 1} / {drawings.length}</span>
			</div>
			<div class="draw-stage">
				{#if activeDraw}
					<img src={activeDraw.url} alt={activeDraw.label} />
					<div class="draw-meta" style="--c:{activeDraw.color}">
						<span class="dm-lab">{activeDraw.label}</span>
						<span class="dm-kind"
							>{activeDraw.kind === 'room' ? 'Common Ground' : 'Function lens'}</span
						>
					</div>
				{/if}
			</div>
			<div class="draw-nav">
				<button
					type="button"
					class="btn"
					disabled={drawIdx <= 0}
					onclick={() => (drawIdx = Math.max(0, drawIdx - 1))}>←</button
				>
				<div class="thumbs">
					{#each drawings as d, i (d.url + i)}
						<button
							type="button"
							class="thumb"
							class:on={i === drawIdx}
							style="--c:{d.color}"
							onclick={() => (drawIdx = i)}
							aria-label={d.label}
						>
							<img src={d.url} alt="" />
						</button>
					{/each}
				</div>
				<button
					type="button"
					class="btn"
					disabled={drawIdx >= drawings.length - 1}
					onclick={() => (drawIdx = Math.min(drawings.length - 1, drawIdx + 1))}>→</button
				>
			</div>
		</section>
	{/if}

	{#if roomCard}
		<section class="sec">
			<h2>03 · Room DBR (snapshot)</h2>
			<p class="lead">
				<strong>{roomCard.lead}</strong> at {roomCard.leadPct}% · {roomCard.spatial}
			</p>
			{#if roomCard.zones?.filter((z) => z.preferred).length}
				<div class="zone-row">
					{#each roomCard.zones.filter((z) => z.preferred) as z (z.name + z.zone)}
						<span class="zone" style="--zc:{z.color}">{z.pct}% {z.zone}</span>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if fnCards.length}
		<section class="sec">
			<h2>04 · Function lenses</h2>
			<div class="fn-grid">
				{#each fnCards as c (c.tableId ?? c.functionName)}
					<article class="fn-card" style="--fn:{c.color ?? '#999'}">
						<header>
							<span class="dot"></span>
							<h3>{c.functionName}</h3>
						</header>
						{#if c.imageUrl}
							<img class="fn-img" src={c.imageUrl} alt={c.functionName} />
						{/if}
						<p class="mix-line">
							Lead <b>{c.lead}</b> {c.leadPct}%
						</p>
					</article>
				{/each}
			</div>
		</section>
	{/if}

	{#if story.ready}
		<section class="sec">
			<p class="lead muted">{story.headline}</p>
		</section>
	{/if}

	<section class="sec extra-call">
		<p class="extra-k">Extra · ZyetaI architectural set</p>
		<p class="muted">
			Plans, sections, elevations, and collage are on a separate page — keep the analysis deck
			clean.
		</p>
		<a class="design-cta" href="/present/{SESSION}/design">Open workspace design →</a>
	</section>

	<footer class="foot">
		{#if onRegen}
			<button type="button" class="btn" onclick={onRegen}>Regenerate concepts…</button>
		{/if}
		<button type="button" class="btn" onclick={onClose}>Close</button>
	</footer>
</div>

<style>
	.report {
		width: min(720px, 100vw - 20px);
		max-height: min(90dvh, 880px);
		overflow: auto;
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-bg);
		padding: 0 0 16px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
	}
	.cover {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 18px 20px;
		border-bottom: 1px solid var(--color-line);
		background: var(--color-panel);
	}
	.cover-brand {
		margin-bottom: 8px;
	}
	.kicker {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.cover h1 {
		margin: 4px 0 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 900;
		letter-spacing: -0.03em;
	}
	.sub {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--color-muted);
		max-width: 40ch;
		line-height: 1.4;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}
	.stat {
		font-size: 11px;
		padding: 4px 9px;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		background: var(--color-bg);
		color: var(--color-muted);
	}
	.stat b {
		color: var(--color-ink);
	}
	.cover-acts {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
	.sec {
		padding: 14px 20px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-line) 80%, transparent);
	}
	.sec h2 {
		margin: 0 0 8px;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 800;
	}
	.sec-h {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}
	.sec-h h2 {
		margin: 0;
	}
	.acts-inline {
		display: flex;
		gap: 6px;
	}
	.count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}
	.lead {
		margin: 0 0 8px;
		font-size: 13px;
		line-height: 1.4;
	}
	.muted {
		color: var(--color-muted);
		font-size: 12px;
	}
	.zone-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.zone {
		font-size: 11px;
		font-weight: 700;
		padding: 3px 9px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--zc) 45%, transparent);
		background: color-mix(in srgb, var(--zc) 12%, transparent);
	}
	.draw-stage {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid var(--color-line);
		background: #0a0f1a;
		aspect-ratio: 16 / 9;
		max-height: 240px;
	}
	.draw-stage img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.draw-meta {
		position: absolute;
		left: 8px;
		bottom: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.65);
		border-left: 3px solid var(--c);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.dm-lab {
		font-weight: 800;
		font-size: 12px;
		color: #fff;
	}
	.dm-kind {
		font-family: var(--font-mono);
		font-size: 9px;
		color: #c8c0a8;
	}
	.draw-nav {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
	}
	.thumbs {
		flex: 1;
		display: flex;
		gap: 5px;
		overflow-x: auto;
	}
	.thumb {
		flex-shrink: 0;
		width: 48px;
		height: 32px;
		padding: 0;
		border-radius: 5px;
		border: 2px solid transparent;
		overflow: hidden;
		cursor: pointer;
		background: #111;
	}
	.thumb.on {
		border-color: var(--c, var(--color-teal));
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.fn-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px;
	}
	.fn-card {
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--fn) 35%, var(--color-line));
		background: color-mix(in srgb, var(--fn) 6%, var(--color-panel));
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.fn-card header {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--fn);
		flex-shrink: 0;
	}
	.fn-card h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 800;
	}
	.fn-img {
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
		border-radius: 6px;
	}
	.mix-line {
		margin: 0;
		font-size: 10px;
		color: var(--color-muted);
	}
	.narr-body {
		margin: 0;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.45;
		white-space: pre-wrap;
		max-height: 220px;
		overflow: auto;
	}
	.edit-area {
		width: 100%;
		min-height: 180px;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--color-teal) 35%, var(--color-line));
		background: var(--color-panel);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.45;
		resize: vertical;
		box-sizing: border-box;
		color: var(--color-ink);
	}
	.extra-call {
		background: color-mix(in srgb, var(--color-teal) 5%, var(--color-bg));
	}
	.extra-k {
		margin: 0 0 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-teal);
		font-weight: 700;
	}
	.design-cta {
		display: inline-block;
		margin-top: 10px;
		font-size: 13px;
		font-weight: 800;
		color: var(--color-teal);
		text-decoration: none;
	}
	.design-cta:hover {
		text-decoration: underline;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
		padding: 14px 20px 0;
	}
	.btn {
		border: 1px solid var(--color-line);
		background: transparent;
		border-radius: 10px;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		color: var(--color-ink);
	}
	.btn.ghost {
		color: var(--color-muted);
	}
	.btn.primary {
		background: var(--color-teal);
		border-color: var(--color-teal);
		color: var(--color-on-teal);
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
