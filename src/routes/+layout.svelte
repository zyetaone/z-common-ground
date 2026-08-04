<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { updated } from '$app/state';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { session } from '$lib/state';

	let { children } = $props();

	onMount(() => {
		const teardown = session.boot();
		return teardown;
	});

	/**
	 * Reload when a new build is deployed mid-session.
	 *
	 * Every device holds one tab open for the whole game and SvelteKit chunks are
	 * content-hashed, so a tab loaded before a deploy keeps running the old code
	 * — the fix ships, the room doesn't see it, and nobody knows why. The version
	 * poll (vite.config.ts) flips `updated`; reload on the next idle moment.
	 *
	 * Guarded on phase: never yank the page out from under someone mid-entry.
	 */
	$effect(() => {
		if (!updated.current) return;
		if (session.busy) return;
		if (session.phase === 'round') return;
		location.reload();
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
