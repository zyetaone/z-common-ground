<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import ExpandImage from '$lib/components/ExpandImage.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import type { WorkspaceZone, ZyetaIRunMode } from '$lib/game';
	import {
		designCardsFromRoom,
		formatUsd,
		functionLensDiffs,
		roomConceptPalette,
		tableBountyTokens,
		tablePersona,
		workspaceLayoutBrief,
		workspaceZonesFromMatrix,
		withLensSection
	} from '$lib/game';
	import { SESSION, session } from '$lib/state';
	import ArchitecturalBriefReport from './ArchitecturalBriefReport.svelte';
	import CommonGroundPalette from './CommonGroundPalette.svelte';
	import LensRail from './LensRail.svelte';
	import RegenPicker from './RegenPicker.svelte';
	import ZyetaIGenerating from './ZyetaIGenerating.svelte';
	import { futureUi } from './future.svelte';

	/**
	 * Look page shell. Owns the ZyetaI pipeline run, the shared lightbox and the
	 * modals; the two columns (LensRail, CommonGroundPalette) own their own
	 * per-item generation and in-flight state.
	 */
	let { room }: { room: RoomState } = $props();

	const hasData = $derived(room.aggregate.totalCoins > 0);
	const brief = $derived(room.enhancedBrief ?? '');
	const lensById = $derived(
		Object.fromEntries(functionLensDiffs(room).map((d) => [d.tableId, d])) as Record<
			number,
			ReturnType<typeof functionLensDiffs>[0]
		>
	);
	const designCards = $derived(designCardsFromRoom(room));
	const roomCard = $derived(designCards.find((c) => c.kind === 'room'));
	const primaryUrl = $derived(room.finaleImageUrl ?? roomConceptPalette(room)[0] ?? '');
	const hasLenses = $derived(room.tables.some((t) => (t.matrix ?? []).some((n) => n > 0)));
	const hasFnImages = $derived(room.tables.some((t) => !!t.imageUrl));
	const generating = $derived(session.busy && !!futureUi.progress);
	/** pipeline = full ZyetaI steps · room = palette + only */
	let genMode = $state<'pipeline' | 'room'>('pipeline');

	let expandOpen = $state(false);
	let expandSrc = $state('');
	let expandTitle = $state('Workplace');
	let expandCaption = $state('');
	let expandLayout = $state('');
	let expandZones = $state<WorkspaceZone[]>([]);
	let expandBrand = $state('#1F8B78');
	let expandKind = $state<'room' | 'function'>('room');

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
			caption: roomCard ? `Lead ${roomCard.lead} ${roomCard.leadPct}%. ${pref}` : pref
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
			futureUi.markStep(5);
			if (mode === 'lookbook' || mode === 'brief') futureUi.openBrief();
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'ZyetaI pipeline failed';
		} finally {
			futureUi.progress = '';
			futureUi.step = 0;
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
		<LensRail {room} {hasData} onExpand={openFunctionExpand} />
		<CommonGroundPalette
			{room}
			{hasData}
			{hasLenses}
			onExpand={openRoomExpand}
			onRunFullPipeline={() => runPipeline('full')}
		/>
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

<RegenPicker
	open={futureUi.regenOpen}
	{hasData}
	onPick={runPipeline}
	onClose={() => futureUi.closeRegen()}
/>

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
		gap: 12px;
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.head-acts {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.cta {
		border-radius: 999px;
		border: 1px solid var(--color-teal);
		background: var(--color-teal);
		color: var(--color-on-teal, #fff);
		font-size: 12px;
		font-weight: 700;
		padding: 7px 14px;
		cursor: pointer;
	}
	.cta:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.ghost {
		border-radius: 999px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		font-size: 11px;
		font-weight: 700;
		padding: 6px 12px;
		cursor: pointer;
		text-decoration: none;
	}
	.ghost:hover {
		border-color: var(--color-teal);
		color: var(--color-teal);
	}
	.ghost.link {
		display: inline-flex;
		align-items: center;
	}
	.err {
		margin: 0;
		font-size: 11px;
		color: var(--color-red);
		border: 1px solid color-mix(in srgb, var(--color-red) 40%, transparent);
		background: color-mix(in srgb, var(--color-red) 8%, transparent);
		border-radius: 8px;
		padding: 6px 10px;
	}

	.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		gap: 12px;
		min-width: 0;
	}
	@media (max-width: 900px) {
		.split {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.brief-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border: 1px solid var(--color-line);
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-panel) 60%, transparent);
		padding: 10px 12px;
		min-width: 0;
	}
	.bs-k {
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.bs-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.bs-lead {
		margin: 0;
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bs-lead.mono {
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		color: var(--color-muted);
	}

	.foot-hint {
		margin: 0;
		font-size: 10px;
		color: var(--color-muted);
	}
	.foot-hint a {
		color: var(--color-teal);
		text-decoration: none;
		font-weight: 700;
	}
	.foot-hint a:hover {
		text-decoration: underline;
	}
</style>
