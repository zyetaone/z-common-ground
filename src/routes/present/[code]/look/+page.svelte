<script lang="ts">
	import { FutureWorkspace } from '$lib/components/present';
	import { SESSION, session } from '$lib/state';

	const room = $derived(session.room);
</script>

<svelte:head>
	<title>Concepts · ZyetaI · {SESSION}</title>
	<meta
		name="description"
		content="ZyetaI concept images and lookbook — Common Ground room and function lenses."
	/>
</svelte:head>

<main class="page stage-dark">
	<header class="top">
		<a class="cg-backlink" href="/present/{SESSION}">← Analysis</a>
		<span class="tag">ZyetaI · Look</span>
		<span class="conn" class:on={session.connected} aria-label={session.connected ? 'Live' : 'Offline'}>
			{session.connected ? '● live' : '○ …'}
		</span>
	</header>

	{#if !room}
		<p class="wait">Connecting…</p>
	{:else if room.aggregate.totalCoins <= 0}
		<p class="wait">Waiting for priorities…</p>
	{:else}
		<div class="body">
			<FutureWorkspace room={room} />
		</div>
	{/if}
</main>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 12px 16px 24px;
		background: var(--color-bg);
		color: var(--color-ink);
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
		margin-bottom: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--color-line);
		flex-shrink: 0;
	}
	.tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-teal-ink);
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--color-teal) 35%, transparent);
		background: color-mix(in srgb, var(--color-teal) 8%, transparent);
	}
	.conn {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}
	.conn.on {
		color: var(--color-teal-ink);
	}
	.wait {
		padding: 48px;
		text-align: center;
		color: var(--color-muted);
		font-size: 14px;
	}
	.body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.body :global(.fw) {
		flex: 1;
		min-height: 0;
	}
</style>
