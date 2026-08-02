<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import ExpandImage from '$lib/components/ExpandImage.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import type { WorkspaceZone, ZyetaIRunMode } from '$lib/game';
	import {
		LOOK_REGEN_OPTIONS,
		designCardsFromRoom,
		formatUsd,
		functionLensDiffs,
		priorityMix,
		roomConceptPalette,
		roomPriorities,
		tableBountyTokens,
		tablePersona,
		workspaceLayoutBrief,
		workspaceZonesFromMatrix,
		withLensSection
	} from '$lib/game';
	import { SESSION, session } from '$lib/state';
	import ArchitecturalBriefReport from './ArchitecturalBriefReport.svelte';
	import ZyetaIGenerating from './ZyetaIGenerating.svelte';
	import { futureUi } from './future.svelte';

	/**
	 * Look page:
	 *   Lenses (with their concept thumbs) · Common Ground palette (+ / −)
	 *   Brief + DBR → modal · Drawings → /design
	 *   Pipeline steps only in generation modal
	 */
	let { room }: { room: RoomState } = $props();

	const hasData = $derived(room.aggregate.totalCoins > 0);
	const brief = $derived(room.enhancedBrief ?? '');
	const labels = $derived(roomPriorities(room));
	const lensDiffs = $derived(functionLensDiffs(room));
	const lensById = $derived(
		Object.fromEntries(lensDiffs.map((d) => [d.tableId, d])) as Record<
			number,
			(typeof lensDiffs)[0]
		>
	);
	const designCards = $derived(designCardsFromRoom(room));
	const roomCard = $derived(designCards.find((c) => c.kind === 'room'));
	const palette = $derived(roomConceptPalette(room));
	const primaryUrl = $derived(room.finaleImageUrl ?? palette[0] ?? '');
	const hasLenses = $derived(room.tables.some((t) => (t.matrix ?? []).some((n) => n > 0)));
	const hasFnImages = $derived(room.tables.some((t) => !!t.imageUrl));
	const generating = $derived(session.busy && !!futureUi.progress);
	/** pipeline = full ZyetaI steps · room = palette + only */
	let genMode = $state<'pipeline' | 'room'>('pipeline');

	const lensRows = $derived(
		room.tables.map((t) => {
			const p = tablePersona(t.id, room);
			const mix = priorityMix(t.matrix ?? [], labels)
				.filter((m) => m.pct > 0)
				.slice(0, 3);
			const lead = mix[0];
			return {
				id: t.id,
				name: p.name,
				color: p.color,
				lead: lead?.name ?? '—',
				leadPct: lead?.pct ?? 0,
				imageUrl: t.imageUrl as string | undefined,
				hasStake: (t.matrix ?? []).some((n) => n > 0),
				note: lensById[t.id]?.note
			};
		})
	);

	let expandOpen = $state(false);
	let expandSrc = $state('');
	let expandTitle = $state('Workplace');
	let expandCaption = $state('');
	let expandLayout = $state('');
	let expandZones = $state<WorkspaceZone[]>([]);
	let expandBrand = $state('#1F8B78');
	let expandKind = $state<'room' | 'function'>('room');
	let paletteBusy = $state(false);
	let lensBusy = $state<Record<number, boolean>>({});

	function openExpand(
		src: string,
		title: string,
		opts: {
			caption?: string;
			layoutBrief?: string;
			zones?: WorkspaceZone[];
			brandColor?: string;
			kind?: 'room' | 'function';
		} = {}
	) {
		if (!src) return;
		expandSrc = src;
		expandTitle = title;
		expandCaption = opts.caption ?? '';
		expandLayout = opts.layoutBrief ?? '';
		expandZones = opts.zones ?? [];
		expandBrand = opts.brandColor ?? '#1F8B78';
		expandKind = opts.kind ?? 'room';
		expandOpen = true;
	}

	/** Generate or regenerate a single function's lens concept image. */
	async function generateLensConcept(tableId: number) {
		if (lensBusy[tableId] || session.busy || paletteBusy) return;
		lensBusy = { ...lensBusy, [tableId]: true };
		futureUi.clearErr();
		const name = (lensById[tableId] as { name?: string } | undefined)?.name ?? `Table ${tableId}`;
		futureUi.progress = `Rendering ${name} concept…`;
		try {
			const res = await session.generateTableRender(tableId);
			if (res.imageError === 'no_key') {
				futureUi.err = 'Images need FAL_API_KEY on the worker.';
			} else if (!res.url) {
				futureUi.err = res.imageError
					? `${name} failed — try again.`
					: `No image returned for ${name} — check FAL key and try again.`;
			}
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : `Generate failed for ${name}`;
		} finally {
			lensBusy = { ...lensBusy, [tableId]: false };
			futureUi.progress = '';
		}
	}

	function openFunctionExpand(tableId: number, src: string, name: string) {
		const d = lensById[tableId];
		const card = designCards.find((c) => c.tableId === tableId);
		const t = room.tables.find((x) => x.id === tableId);
		const persona = tablePersona(tableId, room);
		const z = workspaceZonesFromMatrix(t?.matrix ?? []);
		const layout = workspaceLayoutBrief(z, {
			kind: 'function',
			name,
			brandColor: persona.color,
			budgetLabel: formatUsd(tableBountyTokens(room))
		});
		const pref = z
			.filter((x) => x.preferred)
			.map((x) => `${x.pct}% ${x.zone}`)
			.join(' · ');
		openExpand(src, `${name} · lens concept`, {
			kind: 'function',
			brandColor: persona.color,
			zones: z,
			layoutBrief: layout,
			caption: `${card ? `Lead ${card.lead} ${card.leadPct}%. ` : ''}${pref || '—'}. ${d?.note ?? ''}`.trim()
		});
	}

	function openRoomExpand(url: string) {
		const z = workspaceZonesFromMatrix(room.aggregate.matrix);
		const layout = workspaceLayoutBrief(z, { kind: 'room', name: 'Room' });
		const pref = z
			.filter((x) => x.preferred)
			.map((x) => `${x.pct}% ${x.zone}`)
			.join(' · ');
		openExpand(url, 'Common Ground · room concept', {
			kind: 'room',
			brandColor: '#1F8B78',
			zones: z,
			layoutBrief: layout,
			caption: roomCard
				? `Lead ${roomCard.lead} ${roomCard.leadPct}%. ${pref}`
				: pref
		});
	}

	async function runPipeline(mode: ZyetaIRunMode) {
		if (session.busy || !hasData) return;
		if (mode === 'design') return;
		futureUi.closeRegen();
		futureUi.clearErr();
		genMode = 'pipeline';
		if (mode === 'full') futureUi.resetPipeline();
		try {
			const res = await session.generateZyetaIPackage(
				(msg) => {
					futureUi.progress = msg;
				},
				{ mode, onStep: (n) => futureUi.markStep(n) }
			);
			if (res && 'imageError' in res && res.imageError === 'no_key') {
				futureUi.err = 'Images need FAL_API_KEY — brief may still be ready.';
			}
			const r = session.room;
			if (r?.enhancedBrief) {
				session.updateBrief(withLensSection(r.enhancedBrief, r));
			} else if (r) {
				const full = withLensSection(r.enhancedBrief ?? '', r);
				if (full.trim()) session.updateBrief(full);
			}
			if (mode === 'lookbook' || mode === 'brief') {
				futureUi.markStep(5);
				futureUi.openBrief();
			} else {
				futureUi.markStep(5);
			}
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'ZyetaI pipeline failed';
		} finally {
			futureUi.progress = '';
			futureUi.step = 0;
		}
	}

	/** Add another Common Ground variant to the palette (+ button) */
	async function addRoomConcept() {
		if (session.busy || paletteBusy || !hasData) return;
		paletteBusy = true;
		futureUi.clearErr();
		genMode = 'room';
		futureUi.progress = 'Rendering Common Ground concept…';
		try {
			// Image-only path — does not rewrite brief (unlike full finale)
			const res = await session.generateRoomConcept();
			if (res.imageError === 'no_key') {
				futureUi.err = 'Images need FAL_API_KEY on the worker.';
			} else if (!res.url) {
				futureUi.err = res.imageError
					? 'Room concept failed — try again.'
					: 'No image returned — check FAL key and try again.';
			}
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'Generate failed';
		} finally {
			paletteBusy = false;
			futureUi.progress = '';
		}
	}

	async function selectPalette(url: string) {
		if (url === primaryUrl) return;
		try {
			await session.selectRoomConcept(url);
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'Select failed';
		}
	}

	async function removeSelected() {
		if (!primaryUrl || paletteBusy) return;
		paletteBusy = true;
		try {
			await session.removeRoomConcept(primaryUrl);
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'Remove failed';
		} finally {
			paletteBusy = false;
		}
	}


	function primaryCta() {
		if (hasFnImages || primaryUrl || brief) futureUi.openRegen();
		else void runPipeline('full');
	}
</script>

<div class="fw">
	<header class="head">
		<ZyetaI variant="badge" />
		<div class="head-acts">
			<button type="button" class="cta" disabled={session.busy || !hasData} onclick={primaryCta}>
				{#if generating}
					Generating…
				{:else if hasFnImages || primaryUrl}
					Regenerate…
				{:else}
					Generate concepts
				{/if}
			</button>
			{#if brief}
				<button type="button" class="ghost" onclick={() => futureUi.openBrief()}>Brief + DBR</button>
			{/if}
			<a class="ghost link" href="/present/{SESSION}/design">Drawings →</a>
		</div>
	</header>

	{#if futureUi.err}
		<p class="err">{futureUi.err}</p>
	{/if}

	<div class="split" role="group" aria-label="Lenses and Common Ground palette">
		<!-- Lenses with their concept thumbs (no duplicate gallery) -->
		<section class="col lenses">
			<header class="col-h">
				<h2>Lenses</h2>
				<span class="sub">Priority shape + concept still</span>
			</header>
			<ul class="lens-list">
				{#each lensRows as row (row.id)}
					<li class="lens" style="--fn:{row.color}">
						<span class="dot"></span>
						<div class="lens-body">
							<span class="ln">{row.name}</span>
							<span class="ll"
								>{row.leadPct > 0 ? `${row.lead} · ${row.leadPct}%` : 'No stake yet'}</span
							>
						</div>
						{#if row.imageUrl}
							<span class="thumbwrap">
								<button
									type="button"
									class="thumb"
									onclick={() => openFunctionExpand(row.id, row.imageUrl!, row.name)}
									aria-label="Open {row.name} concept"
								>
									<img src={row.imageUrl} alt="" />
								</button>
								<button
									type="button"
									class="lens-regen"
									disabled={session.busy || !!lensBusy[row.id]}
									onclick={() => generateLensConcept(row.id)}
									title="Regenerate {row.name} concept"
									aria-label="Regenerate {row.name} concept"
								>
									{#if lensBusy[row.id]}<span class="spinner" aria-hidden="true">…</span>{:else}↻{/if}
								</button>
							</span>
						{:else if row.hasStake}
							<button
								type="button"
								class="thumb empty"
								disabled={!!lensBusy[row.id] || !hasData}
								onclick={() => generateLensConcept(row.id)}
								aria-label="Generate {row.name} concept"
								title={hasData ? `Render ${row.name} lens concept` : 'Waiting for stake'}
							>
								{#if lensBusy[row.id]}
									<span class="spinner" aria-hidden="true">…</span>
								{:else}
									<span class="gen-mark">+</span>
								{/if}
							</button>
						{:else}
							<span class="thumb empty" aria-hidden="true"></span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<!-- Common Ground palette only -->
		<section class="col room">
			<header class="col-h">
				<div>
					<h2>Common Ground</h2>
					<span class="sub">Room concepts · palette for drawings</span>
				</div>
				<div class="palette-acts">
					<button
						type="button"
						class="icon-btn plus"
						disabled={session.busy || paletteBusy || !hasData}
						onclick={addRoomConcept}
						title="Add another Common Ground concept"
						aria-label="Add Common Ground concept"
					>
						+
					</button>
					<button
						type="button"
						class="icon-btn minus"
						disabled={session.busy || paletteBusy || !primaryUrl}
						onclick={removeSelected}
						title="Remove selected concept"
						aria-label="Remove selected Common Ground concept"
					>
						−
					</button>
				</div>
			</header>

			{#if primaryUrl}
				<button type="button" class="hero" onclick={() => openRoomExpand(primaryUrl)}>
					<img src={primaryUrl} alt="Common Ground room concept" />
					<span class="hero-cap">
						Common Ground
						<small>Created by ZyetaI · {palette.length} in palette</small>
					</span>
				</button>
				{#if palette.length > 0}
					<div class="palette" role="listbox" aria-label="Room concept palette">
						{#each palette as url, i (url)}
							<button
								type="button"
								class="pchip"
								class:on={url === primaryUrl}
								role="option"
								aria-selected={url === primaryUrl}
								onclick={() => selectPalette(url)}
								aria-label="Select concept {i + 1}"
							>
								<img src={url} alt="" />
							</button>
						{/each}
						<button
							type="button"
							class="pchip add"
							disabled={session.busy || paletteBusy || !hasData}
							onclick={addRoomConcept}
							aria-label="Generate another concept"
							title="Generate another"
						>
							+
						</button>
					</div>
				{/if}
			{:else}
				<div class="hero empty-hero">
					<p>No Common Ground concept yet.</p>
					<button
						type="button"
						class="cta"
						disabled={session.busy || !hasData}
						onclick={() => (hasLenses ? addRoomConcept() : runPipeline('full'))}
					>
						{hasLenses ? 'Generate room concept' : 'Generate concepts'}
					</button>
				</div>
			{/if}
		</section>
	</div>

	{#if brief || roomCard}
		<section class="brief-strip">
			<div class="bs-text">
				<span class="bs-k">Brief + DBR</span>
				{#if roomCard}
					<p class="bs-lead">
						Lead <b>{roomCard.lead}</b> {roomCard.leadPct}%
						{#if roomCard.zones?.filter((z) => z.preferred).length}
							· {roomCard.zones
								.filter((z) => z.preferred)
								.slice(0, 3)
								.map((z) => `${z.pct}% ${z.zone}`)
								.join(' · ')}
						{/if}
					</p>
				{:else if brief}
					<p class="bs-lead mono">{brief.slice(0, 160)}{brief.length > 160 ? '…' : ''}</p>
				{/if}
			</div>
			<button type="button" class="ghost" onclick={() => futureUi.openBrief()}>Open full brief</button>
		</section>
	{/if}

	<p class="foot-hint">
		Palette + lens stills feed architectural drawings on the next page.
		<a href="/present/{SESSION}/design">Workspace design →</a>
	</p>
</div>

<ZyetaIGenerating
	open={generating}
	mode={genMode}
	step={futureUi.step}
	completedThrough={futureUi.completedThrough}
	progress={futureUi.progress}
/>

<Modal open={futureUi.regenOpen} label="Regenerate" onclose={() => futureUi.closeRegen()}>
	<div class="regen">
		<div class="regen-head">
			<ZyetaI variant="badge" />
			<div>
				<p class="gm-k">Regenerate</p>
				<h3>What should ZyetaI redo?</h3>
			</div>
		</div>
		<ul class="ropts">
			{#each LOOK_REGEN_OPTIONS as o (o.mode)}
				<li>
					<button
						type="button"
						class="ropt"
						disabled={session.busy || !hasData}
						onclick={() => runPipeline(o.mode)}
					>
						<span class="rl">{o.label}</span>
						<span class="rh">{o.hint}</span>
					</button>
				</li>
			{/each}
		</ul>
		<button type="button" class="rcancel" onclick={() => futureUi.closeRegen()}>Cancel</button>
	</div>
</Modal>

<Modal open={futureUi.briefOpen} label="Brief + DBR" onclose={() => futureUi.closeBrief()}>
	<ArchitecturalBriefReport
		{room}
		onClose={() => futureUi.closeBrief()}
		onRegen={() => {
			futureUi.closeBrief();
			futureUi.openRegen();
		}}
	/>
</Modal>

<ExpandImage
	bind:open={expandOpen}
	src={expandSrc}
	title={expandTitle}
	caption={expandCaption}
	layoutBrief={expandLayout}
	zones={expandZones}
	brandColor={expandBrand}
	kind={expandKind}
/>

<style>
	.fw {
		display: flex;
		flex-direction: column;
		gap: 14px;
		height: 100%;
		min-height: 0;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-shrink: 0;
	}
	.head-acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.cta {
		border: none;
		background: var(--color-teal);
		color: var(--color-on-teal);
		border-radius: 12px;
		padding: 10px 16px;
		font-weight: 800;
		font-size: 13px;
		cursor: pointer;
		min-height: 44px;
	}
	.cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.ghost {
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		border-radius: 12px;
		padding: 10px 14px;
		font-weight: 700;
		font-size: 12px;
		cursor: pointer;
		min-height: 44px;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}
	.ghost.link {
		color: var(--color-gold);
		border-color: color-mix(in srgb, var(--color-gold) 40%, transparent);
	}
	.err {
		margin: 0;
		padding: 8px 12px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-red) 12%, var(--color-panel));
		color: var(--color-red);
		font-size: 12px;
	}
	.split {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
		gap: 14px;
	}
	@media (max-width: 900px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
	.col {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 12px;
	}
	.col-h {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
		flex-shrink: 0;
	}
	.col-h h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.sub {
		font-size: 11px;
		color: var(--color-muted);
	}
	.palette-acts {
		display: flex;
		gap: 6px;
	}
	.icon-btn {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: 1px solid var(--color-line);
		background: transparent;
		font-size: 22px;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		color: var(--color-ink);
	}
	.icon-btn.plus {
		border-color: color-mix(in srgb, var(--color-teal) 45%, transparent);
		color: var(--color-teal);
	}
	.icon-btn.minus {
		border-color: color-mix(in srgb, var(--color-red) 40%, transparent);
		color: var(--color-red);
	}
	.icon-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.lens-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
		min-height: 0;
	}
	.lens {
		display: grid;
		grid-template-columns: 10px 1fr 52px;
		gap: 10px;
		align-items: center;
		padding: 8px 10px;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--fn) 28%, var(--color-line));
		background: color-mix(in srgb, var(--fn) 6%, transparent);
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--fn);
	}
	.lens-body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ln {
		font-weight: 800;
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ll {
		font-size: 11px;
		color: var(--color-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.thumb {
		width: 52px;
		height: 34px;
		padding: 0;
		border: none;
		border-radius: 6px;
		overflow: hidden;
		cursor: pointer;
		background: #111;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.thumbwrap {
		position: relative;
		width: 52px;
		height: 34px;
		flex-shrink: 0;
	}
	.lens-regen {
		position: absolute;
		right: -6px;
		top: -6px;
		width: 20px;
		height: 20px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--fn) 55%, var(--color-line));
		background: var(--color-panel);
		color: var(--fn);
		font-size: 11px;
		font-weight: 800;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background var(--dur-fast, 180ms) ease,
			border-color var(--dur-fast, 180ms) ease;
	}
	.lens-regen:hover:not(:disabled) {
		background: color-mix(in srgb, var(--fn) 18%, var(--color-panel));
		border-color: var(--fn);
	}
	.lens-regen:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.thumb.empty {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--fn) 8%, transparent);
		border: 1px dashed color-mix(in srgb, var(--fn) 45%, transparent);
		cursor: pointer;
		color: var(--fn);
		font-family: var(--font-mono);
		font-size: 18px;
		font-weight: 700;
		transition: background var(--dur-fast, 180ms) ease, border-color var(--dur-fast, 180ms) ease;
	}
	.thumb.empty:hover:not(:disabled) {
		background: color-mix(in srgb, var(--fn) 18%, transparent);
		border-color: var(--fn);
	}
	.thumb.empty:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.gen-mark {
		line-height: 1;
	}
	.spinner {
		font-size: 12px;
		animation: spin 1.2s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.hero {
		position: relative;
		flex: 1;
		min-height: 180px;
		padding: 0;
		border: none;
		border-radius: 12px;
		overflow: hidden;
		background: #0a0f1a;
		cursor: pointer;
		aspect-ratio: 16 / 9;
		max-height: 360px;
	}
	.hero img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.hero-cap {
		position: absolute;
		left: 10px;
		bottom: 10px;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.72);
		border-left: 3px solid var(--color-teal);
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
	}
	.hero-cap small {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #b8932e;
	}
	.empty-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		cursor: default;
		aspect-ratio: auto;
		min-height: 200px;
	}
	.empty-hero p {
		margin: 0;
		color: var(--color-muted);
		font-size: 13px;
	}
	.palette {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		flex-shrink: 0;
		padding-bottom: 2px;
	}
	.pchip {
		flex-shrink: 0;
		width: 64px;
		height: 42px;
		padding: 0;
		border-radius: 8px;
		border: 2px solid transparent;
		overflow: hidden;
		cursor: pointer;
		background: #111;
	}
	.pchip.on {
		border-color: var(--color-teal);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-teal) 25%, transparent);
	}
	.pchip img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.pchip.add {
		display: grid;
		place-items: center;
		font-size: 22px;
		font-weight: 700;
		color: var(--color-teal);
		background: color-mix(in srgb, var(--color-teal) 10%, var(--color-panel));
		border: 1px dashed color-mix(in srgb, var(--color-teal) 45%, transparent);
	}
	.pchip.add:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.brief-strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid var(--color-line);
		background: color-mix(in srgb, var(--color-teal) 5%, var(--color-panel));
		flex-shrink: 0;
	}
	.bs-k {
		display: block;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-teal);
		font-weight: 700;
		margin-bottom: 4px;
	}
	.bs-lead {
		margin: 0;
		font-size: 13px;
		line-height: 1.35;
		max-width: 52ch;
	}
	.bs-lead.mono {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}
	.foot-hint {
		margin: 0;
		font-size: 12px;
		color: var(--color-muted);
		flex-shrink: 0;
	}
	.foot-hint a {
		color: var(--color-gold);
		font-weight: 700;
		text-decoration: none;
	}
	.foot-hint a:hover {
		text-decoration: underline;
	}

	.regen {
		padding: 8px 4px 4px;
		max-width: 400px;
	}
	.regen-head {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 4px;
	}
	.gm-k {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-teal);
		font-weight: 800;
	}
	.regen h3 {
		margin: 4px 0 14px;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 800;
	}
	.ropts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ropt {
		width: 100%;
		text-align: left;
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.ropt:hover:not(:disabled) {
		border-color: var(--color-teal);
	}
	.ropt:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.rl {
		font-weight: 800;
		font-size: 13px;
	}
	.rh {
		font-size: 11px;
		color: var(--color-muted);
	}
	.rcancel {
		margin-top: 12px;
		width: 100%;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 12px;
		padding: 8px;
		cursor: pointer;
	}
</style>
