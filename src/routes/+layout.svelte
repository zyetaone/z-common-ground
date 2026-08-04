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

	/**
	 * Recover a tab left open across a deploy.
	 *
	 * Chunk filenames are content-hashed, so after a redeploy an open tab still
	 * asks for hashes that no longer exist — the route import 404s and the
	 * navigation dies where it stands. Clicking "Open analysis" simply does
	 * nothing, which is the worst possible moment to discover it.
	 *
	 * One reload fixes it, and the guard makes looping impossible: the flag is
	 * set BEFORE reloading and never cleared, so this fires at most once per tab
	 * session. If the asset is genuinely missing rather than stale, the second
	 * failure surfaces as a normal error instead of a reload cycle. (An earlier
	 * attempt at this reloaded on a version poll with no such guard and could
	 * spin — hence the belt and braces.)
	 */
	onMount(() => {
		const KEY = 'cg-stale-chunk-reload';
		const onPreloadError = () => {
			try {
				if (sessionStorage.getItem(KEY)) return;
				sessionStorage.setItem(KEY, '1');
			} catch {
				return; // no storage, no guard — do not risk a loop
			}
			location.reload();
		};
		window.addEventListener('vite:preloadError', onPreloadError);
		return () => window.removeEventListener('vite:preloadError', onPreloadError);
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
