<script lang="ts">
	import ExpandImage from '$lib/components/ExpandImage.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		downloadLinkedInFrame,
		linkedInShareText,
		openLinkedInShare
	} from '$lib/client/linkedin-frame';
	import type { RoomState, Vec7 } from '$lib/game/types';
	import { formatUsdFull, tablePersona } from '$lib/game';
	import { session } from '$lib/state';

	let {
		room,
		tableId,
		counts
	}: {
		room: RoomState;
		tableId: number;
		counts: Vec7;
	} = $props();

	const persona = $derived(tablePersona(tableId, room));
	const total = $derived(counts.reduce((a, b) => a + b, 0));
	const imageUrl = $derived(room.tables.find((t) => t.id === tableId)?.imageUrl ?? '');
	const roomImage = $derived(room.finaleImageUrl ?? '');
	const shareText = $derived(linkedInShareText(persona.name, total));

	let progress = $state('');
	let err = $state('');
	let showLinkedinFrame = $state(false);
	let selfieUrl = $state('');
	let copied = $state(false);
	let downloading = $state(false);
	let expandOpen = $state(false);
	let expandSrc = $state('');
	let expandTitle = $state('Workplace');

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && showLinkedinFrame) showLinkedinFrame = false;
	}

	async function genTable() {
		if (session.busy || total <= 0) return;
		err = '';
		progress = 'Composing your function workplace…';
		try {
			const res = await session.generateTableRender(tableId);
			if (!res.url)
				err =
					res.imageError === 'no_key'
						? 'Image needs a FAL_API_KEY on the worker.'
						: 'Image generation failed — try again.';
		} catch (e) {
			err = e instanceof Error ? e.message : 'Render failed';
		} finally {
			progress = '';
		}
	}

	function openExpand(src: string, title: string) {
		if (!src) return;
		expandSrc = src;
		expandTitle = title;
		expandOpen = true;
	}

	function handleSelfie(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			selfieUrl = String(ev.target?.result ?? '');
		};
		reader.onerror = () => {
			err = 'Could not read selfie.';
		};
		reader.readAsDataURL(file);
	}

	async function downloadCompositeImage() {
		if (!imageUrl) return;
		downloading = true;
		err = '';
		try {
			// Combine this table's render + room finale + other table renders when present
			const others = room.tables
				.filter((t) => t.id !== tableId && t.imageUrl)
				.map((t) => t.imageUrl!)
				.slice(0, 5);
			if (roomImage && roomImage !== imageUrl) others.unshift(roomImage);
			await downloadLinkedInFrame({
				aiImageUrl: imageUrl,
				selfieDataUrl: selfieUrl || undefined,
				functionName: persona.name,
				tokens: total,
				tableImageUrls: others
			});
		} catch (e) {
			err = e instanceof Error ? e.message : 'Frame export failed';
		} finally {
			downloading = false;
		}
	}

	async function shareLinkedIn() {
		await copyShareText();
		// No SSR fallback origin: openLinkedInShare calls window.open, so this
		// only ever runs in the browser. The old fallback named the retired
		// workers.dev host, which now 404s — a hardcoded origin here can only
		// ever be wrong after a domain move, and is unreachable besides.
		openLinkedInShare(window.location.origin);
	}

	async function copyShareText() {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(shareText);
				copied = true;
				setTimeout(() => (copied = false), 2000);
			}
		} catch {
			/* ignore */
		}
	}
</script>

<div class="mr">
	<section class="card">
		<div class="head">
			<div class="cg-kicker" style="--k-track: 0.16em">Your lens · {persona.name}</div>
			<ZyetaI compact />
		</div>
		<p class="sub">
			AI workplace from <b>your</b> board ({formatUsdFull(total)}).
		</p>

		<div class="frame">
			{#if imageUrl}
				<button
					type="button"
					class="img-hit"
					onclick={() => openExpand(imageUrl, `${persona.name} workplace`)}
					aria-label="Expand workplace image"
				>
					<img src={imageUrl} alt="{persona.name} workplace render" />
					<span class="expand-hint">Expand</span>
				</button>
				<div class="watermark"><span class="wm-dot"></span><span>Created by <b>ZyetaI</b></span></div>
			{:else}
				<div class="empty">
					<div class="icon"><Icon name="building" size={40} /></div>
					<p>No table render yet</p>
					<p class="hint">Generate after placing stake.</p>
				</div>
			{/if}
			{#if session.busy && progress}
				<div class="overlay">
					<div class="spin"></div>
					<p>{progress}</p>
				</div>
			{/if}
		</div>

		<div class="btn-row">
			<button
				type="button"
				class="gen"
				disabled={session.busy || total <= 0}
				onclick={genTable}
			>
				{session.busy && progress
					? 'Generating…'
					: imageUrl
						? 'Regenerate'
						: 'Generate workplace'}
			</button>
			{#if imageUrl}
				<button type="button" class="share-btn" onclick={() => (showLinkedinFrame = true)}>
					Selfie & LinkedIn
				</button>
			{/if}
		</div>
	</section>

	<section class="card dim">
		<div class="head">
			<div class="cg-kicker" style="--k-track: 0.16em">Room render · presenter only</div>
			<ZyetaI compact />
		</div>
		<p class="sub">Appears when presenter generates Future workspace.</p>
		<div class="frame sm">
			{#if roomImage}
				<button
					type="button"
					class="img-hit"
					onclick={() => openExpand(roomImage, 'Room workplace')}
					aria-label="Expand room image"
				>
					<img src={roomImage} alt="Room workplace render" />
					<span class="expand-hint">Expand</span>
				</button>
			{:else}
				<div class="empty">
					<div class="icon"><Icon name="broadcast" size={40} /></div>
					<p>Waiting for presenter…</p>
				</div>
			{/if}
		</div>
	</section>

	{#if err}
		<p class="cg-error">{err}</p>
	{/if}
</div>

<svelte:window onkeydown={onKey} />

<ExpandImage bind:open={expandOpen} src={expandSrc} title={expandTitle} />

{#if showLinkedinFrame && imageUrl}
	<div class="li-root" role="dialog" aria-modal="true" aria-label="LinkedIn frame">
		<button type="button" class="li-back" onclick={() => (showLinkedinFrame = false)} aria-label="Close"
		></button>
		<div class="li-sheet">
			<header class="li-head">
				<div>
					<p class="cg-kicker" style="--k-track: 0.16em; --k-color: var(--color-gold-ink)">LinkedIn moment</p>
					<h2>#WeFoundCommonGround</h2>
				</div>
				<ZyetaI compact />
			</header>

			<div class="li-tag">
				<span class="gold">{persona.name}</span>
				<span class="muted">{formatUsdFull(total)}</span>
			</div>

			<div class="li-grid">
				<div class="li-box">
					{#if selfieUrl}
						<img src={selfieUrl} alt="Your selfie" class="cover" />
						<label class="retake">
							Retake
							<input type="file" accept="image/*" capture="user" class="sr-file" onchange={handleSelfie} />
						</label>
					{:else}
						<label class="selfie-cta">
							<span class="big"><Icon name="camera" size={32} /></span>
							<span class="gold">Selfie with stage</span>
							<span class="hint">Pose with presenter screen behind you</span>
							<span class="pill">Open camera</span>
							<input type="file" accept="image/*" capture="user" class="sr-file" onchange={handleSelfie} />
						</label>
					{/if}
				</div>
				<button
					type="button"
					class="li-box img-hit"
					onclick={() => openExpand(imageUrl, `${persona.name} workplace`)}
				>
					<img src={imageUrl} alt="{persona.name} workplace" class="cover" />
					<span class="expand-hint">Expand</span>
				</button>
			</div>

			<div class="li-help">
				<p><b>1.</b> Optional selfie · <b>2.</b> Download frame · <b>3.</b> Open LinkedIn & attach PNG</p>
				<p class="hint">LinkedIn only opens a URL — caption is copied for you.</p>
			</div>

			<button
				type="button"
				class="gen"
				onclick={downloadCompositeImage}
				disabled={downloading}
			>
				{downloading ? 'Creating frame…' : '1. Download frame PNG'}
			</button>
			<button type="button" class="li-post" onclick={shareLinkedIn}>
				2. Open LinkedIn (caption copied)
			</button>
			<div class="li-row">
				<button type="button" class="ghost" onclick={copyShareText}>
					{copied ? '✓ Copied' : 'Copy caption only'}
				</button>
				<button type="button" class="ghost" onclick={() => (showLinkedinFrame = false)}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.mr {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 12px 20px;
	}
	.card {
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 14px;
	}
	.card.dim {
		opacity: 0.95;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
	}
	.gold {
		color: var(--color-gold-ink);
	}
	.sub {
		margin: 0 0 10px;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.frame {
		position: relative;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		overflow: hidden;
		min-height: 200px;
		background: rgba(0, 0, 0, 0.35);
	}
	.frame.sm {
		min-height: 150px;
	}
	.img-hit {
		display: block;
		width: 100%;
		height: 100%;
		min-height: inherit;
		padding: 0;
		border: none;
		background: transparent;
		cursor: zoom-in;
		position: relative;
	}
	.img-hit img,
	.cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		min-height: 150px;
	}
	.expand-hint {
		position: absolute;
		right: 8px;
		bottom: 8px;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 3px 8px;
		border-radius: 999px;
		background: rgba(10, 15, 26, 0.85);
		border: 1px solid color-mix(in srgb, var(--color-gold) 40%, transparent);
		color: var(--color-gold);
	}
	.watermark {
		position: absolute;
		bottom: 8px;
		left: 8px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(10, 15, 26, 0.88);
		border: 1px solid color-mix(in srgb, var(--color-teal) 45%, transparent);
		border-radius: 999px;
		padding: 4px 10px 4px 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		color: #c8c0a8;
		pointer-events: none;
		letter-spacing: 0.04em;
	}
	.watermark b {
		color: #3fb6a2;
		font-weight: 800;
	}
	.wm-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: linear-gradient(135deg, #1f8b78, #b8932e);
		flex-shrink: 0;
	}
	.empty {
		min-height: 150px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px;
		text-align: center;
		color: var(--color-muted);
	}
	.icon {
		font-size: 2rem;
		margin-bottom: 8px;
	}
	.hint {
		font-size: 11px;
		color: var(--color-muted);
		margin-top: 4px;
	}
	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(10, 15, 26, 0.85);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font-size: 12px;
		color: var(--color-gold);
	}
	.spin {
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-line);
		border-top-color: var(--color-gold);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	.btn-row {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}
	.gen {
		flex: 1;
		border: none;
		border-radius: var(--radius-sm);
		padding: 12px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.95rem;
		background: var(--color-teal);
		color: var(--color-on-teal);
		cursor: pointer;
	}
	.gen:disabled {
		opacity: 0.4;
	}
	.share-btn {
		border-radius: var(--radius-sm);
		border: 1px solid #0a66c2;
		background: #0a66c2;
		color: #fff;
		padding: 0 12px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.8rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.li-root {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.li-back {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.88);
		backdrop-filter: blur(10px);
	}
	.li-sheet {
		position: relative;
		z-index: 1;
		width: min(480px, 100%);
		max-height: 92vh;
		overflow: auto;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in srgb, var(--color-gold) 40%, transparent);
		background: var(--color-bg2);
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.li-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}
	.li-head h2 {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 800;
	}
	.li-tag {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in srgb, var(--color-gold) 30%, transparent);
		background: color-mix(in srgb, var(--color-gold) 8%, transparent);
		font-size: 12px;
		font-weight: 700;
	}
	.muted {
		color: var(--color-muted);
	}
	.li-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.li-box {
		position: relative;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.4);
		overflow: hidden;
		min-height: 160px;
		padding: 0;
	}
	.selfie-cta {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 160px;
		padding: 12px;
		text-align: center;
		cursor: pointer;
	}
	.selfie-cta .big {
		font-size: 1.75rem;
	}
	.pill {
		margin-top: 4px;
		border-radius: 999px;
		background: var(--color-gold);
		color: var(--color-on-gold);
		padding: 4px 10px;
		font-size: 10px;
		font-weight: 800;
	}
	.retake {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.75);
		border: 1px solid color-mix(in srgb, var(--color-gold) 35%, transparent);
		color: var(--color-gold);
		border-radius: 999px;
		padding: 4px 10px;
		font-size: 10px;
		font-family: var(--font-mono);
		cursor: pointer;
	}
	/* Keyboard-reachable file input: stays focusable (unlike display:none),
	   and the wrapping label shows the focus ring via :focus-within below. */
	.sr-file {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.selfie-cta:focus-within,
	.retake:focus-within {
		outline: 2px solid var(--color-gold);
		outline-offset: 2px;
	}
	.li-help {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.45;
	}
	.li-post {
		border: none;
		border-radius: var(--radius-sm);
		padding: 12px;
		font-family: var(--font-display);
		font-weight: 800;
		background: #0a66c2;
		color: #fff;
		cursor: pointer;
	}
	.li-row {
		display: flex;
		gap: 8px;
	}
	.ghost {
		flex: 1;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-muted);
		border-radius: var(--radius-sm);
		padding: 10px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}
</style>
