<script lang="ts">
	import { WorkspaceDesignStudio } from '$lib/components/present';
	import { SESSION, session } from '$lib/state';

	const room = $derived(session.room);
</script>

<svelte:head>
	<title>Workspace design · ZyetaI · {SESSION}</title>
	<meta
		name="description"
		content="ZyetaI architectural drawing set — plan, section, elevation, collage from Common Ground brief and concept refs."
	/>
</svelte:head>

<main class="page">
	<header class="top">
		<a class="back" href="/present/{SESSION}">← COMMON <span class="gold">GROUND</span></a>
		<span class="tag">ZyetaI · Workspace design</span>
		<span class="conn" class:on={session.connected} aria-label={session.connected ? 'Live' : 'Offline'}>
			{session.connected ? '● live' : '○ …'}
		</span>
	</header>

	{#if !room}
		<p class="wait">Connecting…</p>
	{:else}
		<WorkspaceDesignStudio {room} />
	{/if}
</main>

<style>
	.page {
		min-height: 100dvh;
		padding: 12px 16px 40px;
		background: var(--color-bg);
		color: var(--color-ink);
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 16px;
		margin-bottom: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--color-line);
	}
	.back {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 0.95rem;
		letter-spacing: -0.02em;
		text-decoration: none;
		color: var(--color-ink);
	}
	.gold {
		color: var(--color-gold);
	}
	.tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-teal);
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
		color: var(--color-teal);
	}
	.wait {
		padding: 48px;
		text-align: center;
		color: var(--color-muted);
	}
</style>
