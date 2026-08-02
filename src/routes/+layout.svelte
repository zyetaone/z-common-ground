<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { session } from '$lib/state';

	let { children } = $props();

	onMount(() => session.boot());

	onNavigate((nav) => {
		if (typeof document === 'undefined' || !document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#FDF8ED" />
</svelte:head>

{@render children()}
