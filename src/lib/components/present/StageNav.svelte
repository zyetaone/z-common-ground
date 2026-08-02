<script lang="ts">
	let {
		page,
		total = 5,
		labels = [] as string[],
		title = '',
		onprev,
		onnext,
		ongo,
		/** When on last screen, primary becomes a link (e.g. Concepts) */
		endHref = '',
		endLabel = 'Concepts →'
	}: {
		page: number;
		total?: number;
		labels?: string[];
		title?: string;
		onprev: () => void;
		onnext: () => void;
		ongo?: (n: number) => void;
		endHref?: string;
		endLabel?: string;
	} = $props();

	const atEnd = $derived(page >= total);
	const nextLabel = $derived(
		atEnd ? endLabel : labels[page] ? `Next · ${labels[page]}` : 'Next →'
	);
</script>

<nav class="nav" aria-label="Analysis screens">
	{#if title}
		<p class="cg-kicker title" aria-live="polite">{title}</p>
	{/if}
	<div class="dots" role="group" aria-label="Screen {page} of {total}">
		{#each Array(total) as _, i (i)}
			<button
				type="button"
				class="dot"
				class:on={i + 1 === page}
				title={labels[i] ?? `Screen ${i + 1}`}
				aria-label={labels[i] ?? `Screen ${i + 1}`}
				aria-current={i + 1 === page ? 'step' : undefined}
				onclick={() => ongo?.(i + 1)}
				disabled={!ongo}
			></button>
		{/each}
	</div>

	<div class="row">
		<button type="button" class="back" disabled={page <= 1} onclick={onprev}>← Back</button>
		{#if atEnd && endHref}
			<a class="next link" href={endHref}>{endLabel}</a>
		{:else}
			<button type="button" class="next" disabled={atEnd && !endHref} onclick={onnext}>
				{nextLabel}
			</button>
		{/if}
	</div>
</nav>

<style>
	.nav {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 12px 0 8px;
		border-top: 1px solid var(--color-line);
		margin-top: 4px;
		flex-shrink: 0;
	}
	.title {
		margin: 0;
		--k-size: 11px;
		--k-track: 0.08em;
		text-align: center;
	}
	.dots {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.dot {
		/* 44px hit, 10px face */
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: none;
		padding: 0;
		background: transparent;
		cursor: pointer;
		position: relative;
		display: grid;
		place-items: center;
	}
	.dot::after {
		content: '';
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-ink) 14%, transparent);
		transition:
			width var(--dur-base, 280ms) var(--ease-out-quart, cubic-bezier(0.22, 1, 0.36, 1)),
			background var(--dur-base, 280ms) var(--ease-out-quart, cubic-bezier(0.22, 1, 0.36, 1));
	}
	.dot:disabled {
		cursor: default;
	}
	.dot.on::after {
		width: 28px;
		background: var(--color-teal);
	}
	.dot:focus-visible {
		outline: 2px solid var(--color-gold);
		outline-offset: 2px;
	}
	.row {
		display: flex;
		gap: 12px;
		width: min(520px, 100%);
		padding: 0 12px;
	}
	.back {
		flex: 0 0 auto;
		min-width: 100px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-muted);
		padding: 12px 16px;
		font-weight: 600;
		cursor: pointer;
	}
	.back:disabled {
		opacity: 0.25;
		cursor: default;
	}
	.next {
		flex: 1;
		min-height: 44px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--color-teal);
		color: var(--color-on-teal);
		padding: 12px 18px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1rem;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.next.link:hover {
		filter: brightness(1.05);
	}
	.next:disabled {
		opacity: 0.35;
		cursor: default;
	}
	@media (prefers-reduced-motion: reduce) {
		.dot::after {
			transition: none;
		}
	}
</style>
