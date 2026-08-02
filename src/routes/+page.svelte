<script lang="ts">
	import { onMount } from 'svelte';
	import QrCode from '$lib/components/QrCode.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import {
		R2_FULL_BUDGET,
		formatUsd,
		roomPersonas,
		tablePersona
	} from '$lib/game';
	import { SESSION, session } from '$lib/state';

	let origin = $state('');
	let activeQr = $state<{ id: number; name: string; url: string; color: string } | null>(null);
	let copied = $state(false);

	onMount(() => {
		origin = window.location.origin;
	});

	function copyUrl(url: string) {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}
</script>

<svelte:head>
	<title>Common Ground · LIVE</title>
	<meta
		name="description"
		content="Each function has $100M. Where would they spend it? Find Common Ground — and what that workplace looks like."
	/>
	<meta property="og:title" content="Common Ground · LIVE" />
	<meta
		property="og:description"
		content="Same $100M wallet per function. Different priorities. One Common Ground. AI shows what it looks like."
	/>
	<meta property="og:type" content="website" />
</svelte:head>

<main class="mx-auto min-h-screen max-w-5xl px-5 py-10">
	<header class="text-center">
		<p class="font-mono text-xs uppercase tracking-[0.32em] text-gold-ink">Common Ground · LIVE</p>
		<h1 class="font-display mt-2 text-4xl font-bold tracking-tight md:text-5xl">
			If your function had <span class="text-gold-ink">{formatUsd(R2_FULL_BUDGET)}</span>
		</h1>
		<p class="mx-auto mt-3 max-w-xl text-sm text-muted leading-relaxed">
			Where would you put it? Seven functions · same wallet · five rounds. Stats find Common Ground.
			AI shows what that mix looks like — for the room and for each table.
		</p>

		<ol
			class="mx-auto mt-6 max-w-lg text-left text-sm text-muted space-y-2.5 rounded-2xl border border-line bg-panel/40 px-5 py-4"
		>
			<li class="flex gap-3">
				<span class="font-mono text-gold-ink font-bold shrink-0">1</span>
				<span><b class="text-ink">Scan your table QR</b> — one function, one $100M wallet.</span>
			</li>
			<li class="flex gap-3">
				<span class="font-mono text-gold-ink font-bold shrink-0">2</span>
				<span
					><b class="text-ink">Prioritise</b> — physical board first; R2 full {formatUsd(R2_FULL_BUDGET)} · R3
					cut · R5 restructure.</span
				>
			</li>
			<li class="flex gap-3">
				<span class="font-mono text-gold-ink font-bold shrink-0">3</span>
				<span
					><b class="text-ink">Reveal</b> — shape of the room · Common Ground · what it looks like.</span
				>
			</li>
		</ol>

		<nav class="mt-6 flex flex-wrap items-center justify-center gap-3">
			<Button href="/play/{SESSION}" variant="primary">Join a table</Button>
			<Button href="/present/{SESSION}" variant="secondary">Presenter</Button>
			<Button href="/host/{SESSION}" variant="secondary">Host console</Button>
		</nav>
	</header>

	<div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		{#each roomPersonas(session.room) as p, i (p.seat)}
			{@const id = i + 1}
			{@const persona = tablePersona(id, session.room)}
			{@const url = origin ? `${origin}/play/${SESSION}/${id}` : `/play/${SESSION}/${id}`}
			<div
				class="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel/40 p-5 transition hover:border-gold/50"
				style="border-color: color-mix(in srgb, {persona.color} 40%, transparent)"
			>
				<div class="flex items-center gap-2">
					<span
						class="h-4 w-4 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-[var(--color-panel)]"
						style="background:{persona.color}; --tw-ring-color: {persona.color}55"
					></span>
					<div class="text-center min-w-0">
						<div class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
							Table {id}
						</div>
						<a
							href="/play/{SESSION}/{id}"
							class="font-display text-lg font-bold hover:text-gold-ink block truncate"
						>
							{persona.name}
						</a>
						<div class="text-sm text-muted line-clamp-2 leading-snug mt-0.5">{persona.lens}</div>
						{#if persona.hashtag}
							<div
								class="font-mono text-[11px] font-bold tracking-wide text-gold-ink mt-0.5"
								data-testid="persona-hashtag"
							>
								{persona.hashtag}
							</div>
						{/if}
					</div>
				</div>
				{#if origin}
					<button
						type="button"
						class="group relative rounded-xl bg-white p-3 transition hover:scale-105"
						onclick={() => (activeQr = { id, name: persona.name, url, color: persona.color })}
						aria-label="Expand QR code for Table {id}"
					>
						<QrCode text={url} size={132} />
						<span
							class="absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl bg-black/60 font-mono text-xs font-bold text-white opacity-0 transition group-hover:opacity-100"
						>
							<Icon name="search" size={16} /> Expand
						</span>
					</button>
				{:else}
					<div class="h-[132px] w-[132px] animate-pulse rounded-xl bg-panel"></div>
				{/if}
				<div class="flex gap-2 text-xs">
					<a href="/play/{SESSION}/{id}" class="text-gold-ink underline">Open Board →</a>
				</div>
			</div>
		{/each}
	</div>

	<footer class="mt-10 flex flex-col items-center gap-4 text-xs text-muted">
		<div class="flex flex-wrap justify-center gap-x-4 gap-y-1">
			<a href="/present/{SESSION}/qrs" class="underline hover:text-gold-ink">Print all 7 QRs</a>
		</div>
		<div class="flex flex-col items-center gap-2">
			<ZyetaI variant="badge" tagline />
			<p class="text-[11px] tracking-wide opacity-80">Imagine the future of the workplace</p>
		</div>
	</footer>
</main>

<Modal
	open={activeQr !== null}
	onclose={() => (activeQr = null)}
	label={activeQr ? `Table ${activeQr.id} · ${activeQr.name}` : 'QR'}
>
	{#if activeQr}
		<div
			class="flex flex-col items-center gap-4 rounded-2xl border bg-panel p-8 text-center shadow-2xl"
			style="border-color: color-mix(in srgb, {activeQr.color} 60%, transparent)"
		>
			<div class="flex items-center gap-2">
				<span class="h-4 w-4 rounded-full" style="background:{activeQr.color}"></span>
				<h2 class="font-display text-2xl font-bold">
					Table {activeQr.id} · {activeQr.name}
				</h2>
			</div>
			<div class="rounded-2xl bg-white p-4 shadow-inner">
				<QrCode text={activeQr.url} size={240} />
			</div>
			<p class="font-mono text-xs text-muted">{activeQr.url}</p>
			<div class="flex gap-3">
				<Button variant="primary" onclick={() => copyUrl(activeQr!.url)}>
					{copied ? '✓ Copied!' : 'Copy Link'}
				</Button>
				<Button variant="secondary" onclick={() => (activeQr = null)}>Close</Button>
			</div>
		</div>
	{/if}
</Modal>
