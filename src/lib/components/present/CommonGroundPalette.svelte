<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { roomConceptPalette } from '$lib/game';
	import { session } from '$lib/state';
	import { futureUi } from './future.svelte';

	/**
	 * Right column of the Look page — the room-level "Common Ground" concept:
	 * one hero image plus the palette of alternates, with add/remove/select.
	 *
	 * Generation here is image-only (generateRoomConcept) and never rewrites
	 * the brief — that is the full pipeline's job, owned by the parent.
	 */
	let {
		room,
		hasData,
		hasLenses,
		onExpand,
		onRunFullPipeline
	}: {
		room: RoomState;
		hasData: boolean;
		/** True once at least one function has stake, so a room concept is meaningful. */
		hasLenses: boolean;
		onExpand: (url: string) => void;
		/** Empty state with no lenses yet falls back to the full pipeline. */
		onRunFullPipeline: () => void;
	} = $props();

	const palette = $derived(roomConceptPalette(room));
	const primaryUrl = $derived(room.finaleImageUrl ?? palette[0] ?? '');

	let busy = $state(false);

	/** Add another Common Ground variant to the palette (+ button). */
	async function add() {
		if (session.busy || busy || !hasData) return;
		busy = true;
		futureUi.clearErr();
		// No futureUi.progress here — single renders use the local busy state,
		// not the full-pipeline ZyetaIGenerating overlay.
		try {
			const res = await session.generateRoomConcept();
			if (!res.ok) return; // busy — another action in flight
			if (res.imageError === 'no_key') {
				futureUi.err = 'Images need FAL_API_KEY on the worker.';
			} else if (!res.url) {
				futureUi.err = res.imageError
					? 'Room concept failed — try again.'
					: 'No image returned — check FAL key and try again.';
			}
		} catch (e) {
			console.error('[CommonGroundPalette] generate failed:', e);
			futureUi.err = 'Generation failed — try again.';
		} finally {
			busy = false;
		}
	}

	async function select(url: string) {
		if (url === primaryUrl) return;
		try {
			await session.selectRoomConcept(url);
		} catch (e) {
			console.error('[CommonGroundPalette] select failed:', e);
			futureUi.err = 'Select failed — try again.';
		}
	}

	async function removeSelected() {
		if (!primaryUrl || busy) return;
		busy = true;
		try {
			await session.removeRoomConcept(primaryUrl);
		} catch (e) {
			console.error('[CommonGroundPalette] remove failed:', e);
			futureUi.err = 'Remove failed — try again.';
		} finally {
			busy = false;
		}
	}
</script>

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
				disabled={session.busy || busy || !hasData}
				onclick={add}
				title="Add another Common Ground concept"
				aria-label="Add Common Ground concept"
			>
				+
			</button>
			<button
				type="button"
				class="icon-btn minus"
				disabled={session.busy || busy || !primaryUrl}
				onclick={removeSelected}
				title="Remove selected concept"
				aria-label="Remove selected Common Ground concept"
			>
				−
			</button>
		</div>
	</header>

	{#if primaryUrl}
		<button type="button" class="hero" onclick={() => onExpand(primaryUrl)}>
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
						onclick={() => select(url)}
						aria-label="Select concept {i + 1}"
					>
						<img src={url} alt="" />
					</button>
				{/each}
				<button
					type="button"
					class="pchip add"
					disabled={session.busy || busy || !hasData}
					onclick={add}
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
				onclick={() => (hasLenses ? add() : onRunFullPipeline())}
			>
				{hasLenses ? 'Generate room concept' : 'Generate concepts'}
			</button>
		</div>
	{/if}
</section>

<style>
	.col {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-panel) 60%, transparent);
		padding: 12px;
	}
	.col-h {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.col-h h2 {
		margin: 0;
		font-family: var(--font-display, 'Playfair Display', serif);
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.sub {
		font-size: 10px;
		color: var(--color-muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.palette-acts {
		display: flex;
		gap: 6px;
	}
	.icon-btn {
		position: relative;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		display: grid;
		place-items: center;
		padding: 0;
	}
	/* 44×44 hit slot over the 26px face (StageNav dot pattern) */
	.icon-btn::after {
		content: '';
		position: absolute;
		inset: -9px;
	}
	.icon-btn.plus:hover:not(:disabled) {
		border-color: var(--color-teal);
		color: var(--color-teal-ink);
	}
	.icon-btn.minus:hover:not(:disabled) {
		border-color: var(--color-red);
		color: var(--color-red);
	}
	.icon-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.hero {
		position: relative;
		border-radius: var(--radius-lg);
		overflow: hidden;
		border: 1px solid var(--color-line);
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
		padding: 0;
		cursor: pointer;
		display: block;
		width: 100%;
	}
	.hero img {
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		display: block;
	}
	.hero-cap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 8px 10px;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.hero-cap small {
		font-weight: 400;
		font-size: 10px;
		opacity: 0.85;
	}
	.empty-hero {
		display: grid;
		place-items: center;
		gap: 10px;
		aspect-ratio: 16 / 9;
		border-style: dashed;
		cursor: default;
	}
	.empty-hero p {
		margin: 0;
		font-size: 12px;
		color: var(--color-muted);
	}

	.palette {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pchip {
		width: 46px;
		height: 30px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 1px solid var(--color-line);
		background: transparent;
		padding: 0;
		cursor: pointer;
	}
	.pchip.on {
		border-color: var(--color-teal);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-teal) 30%, transparent);
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
		border-style: dashed;
		color: var(--color-muted);
		font-size: 14px;
	}
	.pchip.add:disabled {
		opacity: 0.4;
		cursor: default;
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
</style>
