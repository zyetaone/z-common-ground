<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { SESSION } from '$lib/state';

	/** Legacy seat URL → table board (no seats in hierarchy). */
	onMount(() => {
		const table = page.params.table;
		goto(`/play/${SESSION}/${table}`, { replaceState: true });
	});
</script>

<p class="p">Opening table board…</p>

<style>
	.p {
		padding: 48px;
		text-align: center;
		color: var(--color-muted);
	}
</style>
