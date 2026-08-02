<script lang="ts">
	import QrCode from '$lib/components/QrCode.svelte';
	import { roomPersonas, tablePersona } from '$lib/game';
	import { SESSION, session } from '$lib/state';

	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
	const personas = $derived(roomPersonas(session.room));
</script>

<svelte:head>
	<title>Table QRs · LIVE</title>
</svelte:head>

<main class="min-h-screen bg-bg p-6 text-ink">
	<header class="mb-8 flex flex-wrap items-end justify-between gap-4 print:mb-4">
		<div>
			<p class="font-mono text-xs uppercase tracking-[0.28em] text-gold">Print sheet · LIVE</p>
			<h1 class="font-display mt-1 text-3xl font-bold">7 function table QRs</h1>
			<p class="mt-1 text-sm text-muted">
				One QR per table. No phone selection — scan lands on that function’s board.
			</p>
		</div>
		<div class="flex gap-2 print:hidden">
			<button
				type="button"
				onclick={() => window.print()}
				class="rounded-xl bg-gold px-5 py-2.5 font-display font-bold text-[var(--color-on-gold)]"
			>
				Print all
			</button>
			<a href="/present/{SESSION}" class="rounded-xl border border-line px-5 py-2.5 text-sm hover:border-gold"
				>← Presenter</a
			>
			<a href="/host/{SESSION}" class="rounded-xl border border-line px-5 py-2.5 text-sm hover:border-gold"
				>Host</a
			>
		</div>
	</header>

	<ol class="mb-8 space-y-1 text-sm text-muted print:text-black/80">
		<li>1. Print this page — one QR on each physical table</li>
		<li>2. Players scan their table only (no choose-table step)</li>
		<li>3. Place tokens on the 7 priorities for that function</li>
		<li>4. Submit seals the table until presenter advances</li>
	</ol>

	<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
		{#each personas as p, i (p.seat)}
			{@const id = i + 1}
			{@const persona = tablePersona(id, session.room)}
			{@const url = origin ? `${origin}/play/${SESSION}/${id}` : `/play/${SESSION}/${id}`}
			<article
				class="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel/30 p-6 print:break-inside-avoid print:border-black/15 print:bg-white print:text-black"
			>
				<div class="flex items-center gap-2">
					<span class="h-3 w-3 rounded-full" style="background:{persona.color}"></span>
					<div class="text-center">
						<div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted print:text-black/55">
							Table {id}
						</div>
						<div class="font-display text-xl font-bold">{persona.name}</div>
						<div class="text-xs text-muted print:text-black/65">{persona.lens}</div>
					</div>
				</div>
				<div class="rounded-xl bg-white p-3">
					{#if origin}
						<QrCode text={url} size={160} />
					{/if}
				</div>
				<div class="break-all text-center font-mono text-[10px] tracking-wide text-muted print:text-black/60">
					{url}
				</div>
			</article>
		{/each}
	</div>
</main>

<style>
	@media print {
		:global(body) {
			background: white !important;
		}
	}
</style>
