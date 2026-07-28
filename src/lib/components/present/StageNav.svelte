<script lang="ts">
	let {
		page,
		total = 5,
		labels = [] as string[],
		onprev,
		onnext
	}: {
		page: number;
		total?: number;
		labels?: string[];
		onprev: () => void;
		onnext: () => void;
	} = $props();

	const atEnd = $derived(page >= total);
	const nextLabel = $derived(
		atEnd ? 'Done' : labels[page] ? `Next · ${labels[page]}` : 'Next →'
	);
</script>

<nav class="nav" aria-label="Analysis screens">
	<div class="dots" role="group" aria-label="Screen {page} of {total}">
		{#each Array(total) as _, i (i)}
			<span class="dot" class:on={i + 1 === page} title={labels[i] ?? `Screen ${i + 1}`}></span>
		{/each}
	</div>

	<div class="row">
		<button type="button" class="back" disabled={page <= 1} onclick={onprev}>
			← Back
		</button>
		<button type="button" class="next" disabled={atEnd} onclick={onnext}>
			{nextLabel}
		</button>
	</div>
</nav>

<style>
	.nav {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 14px 0 8px;
		border-top: 1px solid var(--color-line);
		margin-top: 8px;
	}
	.dots {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.15);
		transition:
			width 0.25s,
			background 0.25s;
	}
	.dot.on {
		width: 28px;
		background: var(--color-teal);
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
		border-radius: 14px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-muted);
		padding: 14px 18px;
		font-weight: 600;
		cursor: pointer;
	}
	.back:disabled {
		opacity: 0.25;
		cursor: default;
	}
	.next {
		flex: 1;
		border: none;
		border-radius: 14px;
		background: var(--color-gold);
		color: var(--color-on-gold);
		padding: 16px 20px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		cursor: pointer;
		box-shadow: 0 3px 0 #b8892e;
	}
	.next:disabled {
		opacity: 0.35;
		cursor: default;
		box-shadow: none;
	}
	.next:not(:disabled):active {
		transform: translateY(2px);
		box-shadow: 0 1px 0 #b8892e;
	}
</style>
