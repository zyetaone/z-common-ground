<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import QrCode from '$lib/components/QrCode.svelte';
	import { roomPersonas, tablePersona } from '$lib/game';
	import { SESSION, session } from '$lib/state';

	let origin = $state('');

	/**
	 * Table directory — one function per table.
	 * Live flow: scan printed QR → /play/LIVE/{id}.
	 * This page is for hosts (print/preview) and ?table= deep links only.
	 */
	onMount(() => {
		origin = window.location.origin;
		const fromQuery = Number(page.url.searchParams.get('table'));
		if (fromQuery >= 1 && fromQuery <= 7) {
			goto(`/play/${SESSION}/${fromQuery}`, { replaceState: true });
		}
	});

	function openTable(id: number) {
		goto(`/play/${SESSION}/${id}`);
	}
</script>

<svelte:head>
	<title>7 tables · LIVE</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main class="shell">
	<header>
		<p class="cg-kicker" style="margin:0; --k-track: 0.22em; --k-color: var(--color-gold-ink)">Tech check</p>
		<h1>7 tables</h1>
		<p class="sub">Open a table board — live play uses the printed QR.</p>
	</header>

	<div class="cards">
		{#each roomPersonas(session.room) as p, i (p.seat)}
			{@const id = i + 1}
			{@const persona = tablePersona(id, session.room)}
			{@const url = origin ? `${origin}/play/${SESSION}/${id}` : `/play/${SESSION}/${id}`}
			<article class="card" style="--c:{persona.color}">
				<button type="button" class="open" onclick={() => openTable(id)}>
					<span class="dot"></span>
					<span class="meta">
						<span class="cg-kicker">Table {id}</span>
						<span class="n">{persona.name}</span>
						<span class="l">{persona.lens}</span>
					</span>
					<span class="go">Open board →</span>
				</button>
				{#if origin}
					<div class="qr" aria-hidden="true">
						<QrCode text={url} size={88} />
					</div>
				{/if}
			</article>
		{/each}
	</div>

	<p class="hint">
		Booth: print large QRs from the print sheet and place one on each table.
	</p>
	<a class="link" href="/present/{SESSION}/qrs">Print all 7 QRs →</a>
</main>

<style>
	.shell {
		min-height: 100dvh;
		padding: 18px 14px calc(28px + env(safe-area-inset-bottom));
		max-width: 520px;
		margin: 0 auto;
	}
	h1 {
		font-family: var(--font-display);
		font-size: 1.55rem;
		font-weight: 800;
		margin: 8px 0 0;
	}
	.sub {
		margin: 8px 0 0;
		font-size: 13.5px;
		line-height: 1.45;
		color: var(--color-muted);
	}
	.cards {
		margin-top: 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.card {
		display: flex;
		align-items: stretch;
		gap: 10px;
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--c) 35%, var(--color-line));
		background: color-mix(in srgb, var(--c) 8%, var(--color-panel));
		padding: 10px;
	}
	.open {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		border: none;
		background: transparent;
		color: inherit;
		text-align: left;
		padding: 6px 4px;
		cursor: pointer;
		font: inherit;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--c);
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.n {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.15rem;
		line-height: 1.15;
	}
	.l {
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.3;
	}
	.go {
		margin-top: 4px;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-gold-ink);
	}
	.qr {
		flex-shrink: 0;
		align-self: center;
		border-radius: 10px;
		background: #fff;
		padding: 6px;
	}
	.hint {
		margin: 20px 0 0;
		font-size: 12px;
		color: var(--color-muted);
		text-align: center;
		line-height: 1.4;
	}
	.link {
		display: block;
		text-align: center;
		margin-top: 10px;
		color: var(--color-gold-ink);
		font-weight: 700;
		font-size: 14px;
	}
</style>
