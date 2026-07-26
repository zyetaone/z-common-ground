<script lang="ts">
	/** Small AI attribution — powered by ZyetaI */
	let { compact = false }: { compact?: boolean } = $props();
</script>

<p class="zi" class:compact>
	{#if compact}
		AI · ZyetaI
	{:else}
		AI powered by <span>ZyetaI</span>
	{/if}
</p>

<style>
	.zi {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.zi span {
		color: var(--color-teal);
		font-weight: 700;
	}
	.zi.compact {
		letter-spacing: 0.1em;
	}
</style>
