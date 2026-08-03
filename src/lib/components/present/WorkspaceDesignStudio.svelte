<script lang="ts">
	import type { RoomState, WorkspaceDesignKind } from '$lib/game/types';
	import ExpandImage from '$lib/components/ExpandImage.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import { drawingSetFromRoom, WORKSPACE_SHEET_SPECS } from '$lib/game';
	import { SESSION, session } from '$lib/state';
	import ArchitecturePresentation from './ArchitecturePresentation.svelte';
	import ConceptLayoutSheet from './ConceptLayoutSheet.svelte';
	import { futureUi } from './future.svelte';

	/**
	 * Standalone ZyetaI workspace design studio (not part of analysis deck).
	 * Plans · sections · elevations · collage from final brief + concept refs.
	 * Sheets generate one-by-one (per-sheet buttons, or the sequential set
	 * button) — no blocking modal; each sheet lands as it finishes.
	 */
	let { room }: { room: RoomState } = $props();

	const hasData = $derived(room.aggregate.totalCoins > 0);
	const brief = $derived(room.enhancedBrief ?? '');
	const drawings = $derived(drawingSetFromRoom(room));
	const designs = $derived(room.workspaceDesigns ?? []);
	const ready = $derived(!!brief.trim() && drawings.length > 0);

	/** Canonical slot rail — hero concept first, plus any legacy sheets from
	 *  older multi-sheet sets so they stay visible. */
	const slots = $derived(
		WORKSPACE_SHEET_SPECS.map((s) => ({
			...s,
			sheet: designs.find((d) => d.kind === s.kind)
		})).concat(
			designs
				.filter((d) => !WORKSPACE_SHEET_SPECS.some((s) => s.kind === d.kind))
				.map((d) => ({ kind: d.kind, label: d.label, sheet: d }))
		)
	);
	const generatedCount = $derived(slots.filter((s) => s.sheet).length);

	let sheetIdx = $state(0);
	// Clamp on read, not by writing back in an $effect.
	const si = $derived(Math.min(sheetIdx, Math.max(0, slots.length - 1)));
	const active = $derived(slots[si]);

	let expandOpen = $state(false);
	let expandSrc = $state('');
	let expandTitle = $state('');

	/** Per-sheet in-flight flags. */
	let sheetBusy = $state<Record<string, boolean>>({});
	/** True while the sequential set-generation loop runs. */
	let running = $state(false);

	/** Generate/regen a single sheet. */
	async function genSheet(kind: WorkspaceDesignKind) {
		if (session.busy || sheetBusy[kind] || !ready) return;
		sheetBusy = { ...sheetBusy, [kind]: true };
		futureUi.clearErr();
		try {
			const res = await session.generateWorkspaceDesignSheet(kind);
			if (res?.imageError === 'no_key') {
				futureUi.err = 'Images need FAL_API_KEY on the worker.';
			} else if (res && res.count === 0) {
				futureUi.err = 'Sheet failed — try again.';
			}
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'Sheet generation failed';
		} finally {
			sheetBusy = { ...sheetBusy, [kind]: false };
		}
	}

	/** Sequential one-by-one set generation — no modal; sheets land as they finish. */
	async function generateAll(regen: boolean) {
		if (running || session.busy || !ready) return;
		running = true;
		futureUi.clearErr();
		const targets = slots.filter((s) => regen || !s.sheet);
		const failed: string[] = [];
		try {
			for (let i = 0; i < targets.length; i++) {
				const s = targets[i]!;
				sheetBusy = { ...sheetBusy, [s.kind]: true };
				futureUi.progress = `Sheet ${i + 1} of ${targets.length} — ${s.label}…`;
				try {
					const res = await session.generateWorkspaceDesignSheet(s.kind);
					if (res?.imageError === 'no_key') {
						failed.push('FAL_API_KEY missing');
						break;
					}
					if (res && res.count === 0) failed.push(s.label);
				} catch {
					failed.push(s.label);
				} finally {
					sheetBusy = { ...sheetBusy, [s.kind]: false };
				}
			}
			if (failed.length) futureUi.err = `Failed: ${failed.join(', ')} — retry from the sheet rail.`;
		} finally {
			running = false;
			futureUi.progress = '';
		}
	}

	function openSheet(url: string, label: string) {
		expandSrc = url;
		expandTitle = label;
		expandOpen = true;
	}
</script>

<div class="studio">
	<header class="head">
		<div class="head-left">
			<ZyetaI variant="hero" tagline />
			<p class="lead">
				One hero frame — the entire workspace design concept in a single 16:9 image, minimal
				text. Created by ZyetaI from your brief and concept refs.
			</p>
		</div>
		<div class="head-acts">
			<a class="link" href="/present/{SESSION}">← Analysis deck</a>
			<a class="link muted" href="/present/{SESSION}/look">Concepts</a>
		</div>
	</header>

	{#if futureUi.err}
		<p class="cg-error">{futureUi.err}</p>
	{/if}

	<section class="gate">
		<div class="checks">
			<span class="chk" class:on={hasData}>Stake</span>
			<span class="chk" class:on={!!brief.trim()}>Brief</span>
			<span class="chk" class:on={drawings.length > 0}>Concepts ({drawings.length})</span>
			<span class="chk" class:on={designs.length > 0}>Designs ({generatedCount}/{slots.length})</span>
		</div>
		<button
			type="button"
			class="gen"
			disabled={!ready || session.busy || running}
			onclick={() => generateAll(generatedCount === slots.length)}
		>
			{#if running}
				{futureUi.progress}
			{:else if generatedCount === 0}
				Generate workspace concept
			{:else if generatedCount < slots.length}
				Generate missing sheets ({slots.length - generatedCount})
			{:else}
				Regenerate workspace concept
			{/if}
		</button>
		{#if !ready}
			<p class="hint">
				Finish the Look pipeline first (concept images + brief), then generate the concept frame
				here.
			</p>
		{:else}
			<p class="hint">One image — the entire workspace concept. Regenerate anytime.</p>
		{/if}
	</section>

	{#if hasData}
		<section class="sheets" aria-label="Architectural sheets">
			<div class="sec-h">
				<h2>Architectural sheets</h2>
				<span class="count">{generatedCount} / {slots.length}</span>
			</div>
			{#if active?.sheet}
				<button
					type="button"
					class="stage"
					onclick={() => active.sheet && openSheet(active.sheet.url, active.label)}
				>
					<img src={active.sheet.url} alt={active.label} />
					<span class="cap">
						<span class="ck">{active.kind}</span>
						{active.label}
						<small class="by">Created by ZyetaI</small>
					</span>
				</button>
			{:else if active}
				<div class="stage pending-stage">
					<span class="ck">{active.kind}</span>
					<p class="ps-label">{active.label}</p>
					<button
						type="button"
						class="gen-inline"
						disabled={!ready || session.busy || running || !!sheetBusy[active.kind]}
						onclick={() => genSheet(active.kind)}
					>
						{#if sheetBusy[active.kind]}Rendering…{:else}Generate this sheet{/if}
					</button>
				</div>
			{/if}
			{#if slots.length > 1}
				<div class="nav">
					<button
						type="button"
						class="nb"
						disabled={si <= 0}
						onclick={() => (sheetIdx = Math.max(0, si - 1))}>←</button
					>
					<div class="thumbs">
					{#each slots as s, i (s.kind)}
						{#if s.sheet}
							<span class="thumbwrap">
								<button
									type="button"
									class="thumb"
									class:on={i === si}
									onclick={() => (sheetIdx = i)}
									aria-label={s.label}
								>
									<img src={s.sheet.url} alt="" />
								</button>
								<button
									type="button"
									class="sheet-regen"
									disabled={session.busy || running || !!sheetBusy[s.kind]}
									onclick={() => genSheet(s.kind)}
									title="Regenerate {s.label}"
									aria-label="Regenerate {s.label}"
								>
									{#if sheetBusy[s.kind]}…{:else}↻{/if}
								</button>
							</span>
						{:else}
							<button
								type="button"
								class="thumb pending"
								class:on={i === si}
								disabled={!ready || session.busy || running || !!sheetBusy[s.kind]}
								onclick={() => genSheet(s.kind)}
								title="Generate {s.label}"
								aria-label="Generate {s.label}"
							>
								{#if sheetBusy[s.kind]}…{:else}+{/if}
							</button>
						{/if}
					{/each}
				</div>
					<button
						type="button"
						class="nb"
						disabled={si >= slots.length - 1}
						onclick={() => (sheetIdx = Math.min(slots.length - 1, si + 1))}>→</button
					>
				</div>
			{/if}
		</section>

		<section class="comp">
			<ConceptLayoutSheet {room} />
		</section>
	{:else}
		<section class="empty-comp">
			<ConceptLayoutSheet {room} />
		</section>
	{/if}

	{#if hasData}
		<section class="plan">
			<h2>Presentation plan</h2>
			<p class="muted">Who funds each zone — use with the drawing set on stage.</p>
			<ArchitecturePresentation {room} compact />
		</section>
	{/if}
</div>

<ExpandImage bind:open={expandOpen} src={expandSrc} title={expandTitle} kind="room" brandColor="#1F8B78" />

<style>
	.studio {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 1100px;
		margin: 0 auto;
		padding: 8px 4px 32px;
		min-height: 0;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 16px;
		align-items: flex-start;
		padding: 16px 18px;
		border-radius: 16px;
		border: 1px solid var(--color-zi-border, color-mix(in srgb, var(--color-teal) 35%, var(--color-line)));
		background: var(--color-zi-bg, color-mix(in srgb, var(--color-teal) 8%, var(--color-panel)));
		box-shadow: var(--shadow-zi, none);
	}
	.lead {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--color-muted);
		line-height: 1.45;
		max-width: 48ch;
	}
	.head-acts {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}
	.link {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-teal-ink);
		text-decoration: none;
	}
	.link:hover {
		text-decoration: underline;
	}
	.link.muted {
		color: var(--color-muted);
		font-weight: 600;
	}
	.gate {
		padding: 16px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
	}
	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}
	.chk {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		color: var(--color-muted);
		opacity: 0.55;
	}
	.chk.on {
		opacity: 1;
		border-color: color-mix(in srgb, var(--color-teal) 40%, transparent);
		color: var(--color-teal-ink);
		background: color-mix(in srgb, var(--color-teal) 10%, transparent);
	}
	/* State must not be color-only */
	.chk.on::before {
		content: '✓ ';
	}
	.gen {
		width: 100%;
		border: none;
		background: var(--color-teal);
		color: var(--color-on-teal);
		border-radius: var(--radius-sm);
		padding: 14px 18px;
		font-weight: 800;
		font-size: 14px;
		cursor: pointer;
	}
	.gen:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.hint {
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.sheets {
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 14px;
	}
	.sec-h {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 10px;
	}
	.sec-h h2,
	.plan h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
	}
	.count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}
	.stage {
		position: relative;
		width: 100%;
		padding: 0;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--color-well);
		cursor: pointer;
		aspect-ratio: 16 / 9;
		max-height: 420px;
	}
	.stage img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.cap {
		position: absolute;
		left: 12px;
		bottom: 12px;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.72);
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-align: left;
	}
	.ck {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-teal-ink);
	}
	.by {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #b8932e;
		opacity: 0.95;
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}
	.nb {
		position: relative;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-line);
		background: transparent;
		font-weight: 800;
		cursor: pointer;
		color: var(--color-ink);
	}
	/* 44×44 hit slot over the 36px face (StageNav dot pattern) */
	.nb::after {
		content: '';
		position: absolute;
		inset: -4px;
	}
	.nb:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.thumbs {
		flex: 1;
		display: flex;
		gap: 6px;
		overflow-x: auto;
	}
	.thumb {
		flex-shrink: 0;
		width: 64px;
		height: 40px;
		padding: 0;
		border-radius: var(--radius-sm);
		border: 2px solid transparent;
		overflow: hidden;
		cursor: pointer;
		background: var(--color-well);
	}
	.thumb.on {
		border-color: var(--color-teal);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.thumbwrap {
		position: relative;
		flex-shrink: 0;
		width: 64px;
		height: 40px;
	}
	.thumbwrap .thumb {
		width: 100%;
		height: 100%;
	}
	.sheet-regen {
		position: absolute;
		right: -6px;
		top: -6px;
		width: 20px;
		height: 20px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--color-teal) 55%, var(--color-line));
		background: var(--color-panel);
		color: var(--color-teal-ink);
		font-size: 11px;
		font-weight: 800;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.sheet-regen:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-teal) 18%, var(--color-panel));
		border-color: var(--color-teal);
	}
	/* 44×44 hit slot over the 20px face (StageNav dot pattern) */
	.sheet-regen::after {
		content: '';
		position: absolute;
		inset: -12px;
	}
	.sheet-regen:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.thumb.pending {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, var(--color-teal) 6%, transparent);
		border: 1px dashed color-mix(in srgb, var(--color-teal) 45%, transparent);
		color: var(--color-teal-ink);
		font-family: var(--font-mono);
		font-size: 16px;
		font-weight: 700;
	}
	.thumb.pending:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-teal) 14%, transparent);
	}
	.thumb.pending:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.pending-stage {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: color-mix(in srgb, var(--color-teal) 5%, var(--color-panel));
		cursor: default;
	}
	.ps-label {
		margin: 0;
		font-weight: 700;
		font-size: 14px;
		color: var(--color-muted);
	}
	.gen-inline {
		border: 1px solid color-mix(in srgb, var(--color-teal) 45%, transparent);
		background: color-mix(in srgb, var(--color-teal) 10%, transparent);
		color: var(--color-teal-ink);
		border-radius: 10px;
		padding: 8px 14px;
		font-weight: 800;
		font-size: 12px;
		cursor: pointer;
		min-height: 36px;
	}
	.gen-inline:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.comp,
	.empty-comp {
		min-width: 0;
	}
	.plan {
		padding: 14px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
	}
	.muted {
		margin: 6px 0 12px;
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
