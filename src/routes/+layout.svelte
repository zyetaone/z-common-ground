<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { session } from '$lib/state';

	let { children } = $props();

	onMount(() => {
		const teardown = session.boot();
		return teardown;
	});

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
	<title>Common Ground</title>
	<meta name="description" content="Imagine the future of the workplace." />
	<meta property="og:title" content="Common Ground" />
	<meta property="og:description" content="Imagine the future of the workplace." />
	<meta property="og:type" content="website" />
</svelte:head>

{@render children()}
