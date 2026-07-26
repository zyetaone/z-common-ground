<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { SESSION } from '$lib/state';

	/** Legacy → table board. */
	onMount(() => {
		const tableId = page.params.table;
		goto(`/play/${SESSION}/${tableId}`, { replaceState: true });
	});
</script>

<p class="p">Opening table…</p>

<style>
	.p {
		padding: 48px;
		text-align: center;
		color: var(--color-muted);
	}
</style>
