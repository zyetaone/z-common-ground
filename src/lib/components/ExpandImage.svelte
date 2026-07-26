<script lang="ts">
	/**
	 * z-corenet-style expand / download lightbox for AI images.
	 */
	let {
		src,
		title = 'Workplace',
		open = $bindable(false)
	}: {
		src: string;
		title?: string;
		open?: boolean;
	} = $props();

	function close() {
		open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			close();
		}
	}

	async function download() {
		// fal image URLs are cross-origin — the `download` attribute is ignored
		// for those, so fetch to a blob and download the object URL instead.
		try {
			const res = await fetch(src, { mode: 'cors' });
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${title.replace(/\s+/g, '_')}_${Date.now()}.png`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch {
			window.open(src, '_blank', 'noopener');
		}
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open && src}
	<div class="root" role="dialog" aria-modal="true" aria-label={title}>
		<button type="button" class="backdrop" onclick={close} aria-label="Close"></button>
		<div class="sheet">
			<header>
				<div>
					<p class="kicker">Expand</p>
					<h3>{title}</h3>
				</div>
				<div class="acts">
					<button type="button" class="btn" onclick={download}>Download</button>
					<a class="btn" href={src} target="_blank" rel="noopener">Open tab</a>
					<button type="button" class="btn x" onclick={close}>Close · Esc</button>
				</div>
			</header>
			<div class="stage">
				<img {src} alt={title} />
			</div>
		</div>
	</div>
{/if}

<style>
	.root {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		animation: in 0.2s ease both;
	}
	@keyframes in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.backdrop {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.88);
		backdrop-filter: blur(10px);
		cursor: pointer;
	}
	.sheet {
		position: relative;
		z-index: 1;
		width: min(1100px, 100%);
		max-height: min(92vh, 960px);
		display: flex;
		flex-direction: column;
		border-radius: 18px;
		border: 1px solid color-mix(in srgb, var(--color-gold) 35%, transparent);
		background: #0a0f1a;
		overflow: hidden;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-line);
	}
	.kicker {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-gold);
	}
	h3 {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 800;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.btn {
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		border-radius: 999px;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
	}
	.btn:hover {
		border-color: var(--color-gold);
		color: var(--color-gold);
	}
	.btn.x {
		color: var(--color-muted);
	}
	.stage {
		flex: 1;
		min-height: 0;
		display: grid;
		place-items: center;
		padding: 12px;
		overflow: auto;
		background: #05080f;
	}
	.stage img {
		max-width: 100%;
		max-height: min(78vh, 820px);
		object-fit: contain;
		border-radius: 10px;
	}
</style>
