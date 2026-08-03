<script lang="ts">
	import { FutureWorkspace } from '$lib/components/present';
	import { SESSION, session } from '$lib/state';

	const room = $derived(session.room);
</script>

<svelte:head>
	<meta name="theme-color" content="#10160f" />
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
		<div class="empty-card">
			<p class="empty-title">Waiting for stake</p>
			<p class="empty-sub">Waiting for stake — tables place chips, the analysis builds here.</p>
		</div>
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
	.empty-card {
		margin: auto;
		padding: 48px 24px;
		text-align: center;
		max-width: 480px;
		border-radius: 16px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.empty-title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 800;
		color: var(--color-ink);
		margin: 0 0 8px;
	}
	.empty-sub {
		font-size: 13px;
		color: var(--color-muted);
		margin: 0;
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
