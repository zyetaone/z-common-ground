<script lang="ts">
	import { onMount } from 'svelte';
	import { ROUND_COUNT, SCENARIOS, boardTokenSum, formatUsd, tablePersona } from '$lib/game';
	import { host, SESSION, session } from '$lib/state';

	onMount(() => {
		host.syncOnce(session.room);
	});

	const scenario = $derived(SCENARIOS[session.room?.round ?? 0]);
	const st = $derived(session.room);

	const imageCount = $derived(
		(st?.finaleImageUrl ? 1 : 0) +
		(st?.tables.filter((t) => t.imageUrl).length ?? 0)
	);

	async function saveBudget() {
		await session.setConfig({ roomBountyTokens: host.roomBountyTokens });
	}

	async function resetSession() {
		if (!confirm('Delete / reset the whole session? Boards clear.')) return;
		await session.ensure({ reset: true, tableCount: host.tableCount });
		host.resync(session.room);
	}

	function downloadImage(url: string, name: string) {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.target = '_blank';
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function downloadAll() {
		const urls: { url: string; name: string }[] = [];
		if (st?.finaleImageUrl) urls.push({ url: st.finaleImageUrl, name: 'finale-room.png' });
		for (const t of st?.tables ?? []) {
			if (t.imageUrl) {
				const fn = tablePersona(t.id);
				urls.push({ url: t.imageUrl, name: `table-${t.id}-${fn.name.toLowerCase().replace(/\s+/g, '-')}.png` });
			}
		}
		urls.forEach((u, i) => setTimeout(() => downloadImage(u.url, u.name), i * 500));
	}

	function exportSessionJSON() {
		if (!st) return;
		const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `common-ground-session-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(a.href);
	}
</script>

<svelte:head>
	<title>Host · LIVE</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-6 py-10">
	<header class="mb-8">
		<p class="font-mono text-xs uppercase tracking-[0.3em] text-gold">Host controls</p>
		<h1 class="font-display mt-2 text-4xl font-bold">COMMON <span class="text-gold">GROUND</span></h1>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2">
				<span class="font-mono text-xl font-bold tracking-widest text-ink">SESSION: LIVE</span>
				<span class="font-mono text-xs uppercase tracking-widest font-semibold"
					class:text-teal={session.connected} class:text-muted={!session.connected}>
					{session.connected ? '● Connected' : '○ Offline'}
				</span>
			</div>
			<a href="/present/{SESSION}" target="_blank" class="rounded-xl border border-gold/50 px-4 py-2 font-display text-sm font-bold text-gold hover:bg-gold/10">
				Presenter →
			</a>
			<a href="/" target="_blank" class="rounded-xl border border-line px-4 py-2 text-sm hover:border-gold">
				Table Directory
			</a>
		</div>
	</header>

	<div class="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
		<!-- LEFT COLUMN -->
		<div class="space-y-6">
			<!-- Status -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5">
				<h2 class="mb-2 text-[11px] uppercase tracking-[0.26em] text-muted">Status</h2>
				{#if st?.phase === 'round' && scenario}
					<div class="text-sm">
						<span class="font-mono text-gold font-bold">R{st.round + 1}</span>
						<span class="text-muted"> · {scenario.question}</span>
					</div>
				{:else if st?.phase === 'lobby'}
					<p class="text-sm text-muted">Lobby — presenter starts R1 when ready.</p>
				{:else}
					<p class="text-sm text-muted">Phase: {st?.phase ?? '…'}</p>
				{/if}
				<div class="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line/40 pt-3">
					<div class="flex flex-wrap gap-1.5">
						{#each Array(ROUND_COUNT) as _, i (i)}
							{@const r = i + 1}
							{@const cur = st?.phase === 'round' && (st?.round ?? 0) + 1 === r}
							{@const past = st?.phase === 'round' ? (st?.round ?? 0) + 1 > r : st?.phase === 'reveal' || st?.phase === 'finale'}
							<span class="rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
								class:border-teal={cur} class:bg-teal={cur} class:text-bg={cur}
								class:border-gold={[2,3,5].includes(r) && !cur} class:text-gold={[2,3,5].includes(r) && !cur}
								class:border-line={!cur && ![2,3,5].includes(r)} class:text-muted={!cur && ![2,3,5].includes(r)}
								class:opacity-50={past && !cur}>R{r}{[2,3,5].includes(r) ? '◉' : ''}</span>
						{/each}
					</div>
					<div class="text-right">
						<div class="text-2xl font-bold text-teal">
							{st?.tables.filter((t) => t.lockedThisRound).length ?? 0}
							<span class="text-base text-muted">/{st?.tables.length ?? 0}</span>
						</div>
						<div class="text-[10px] uppercase tracking-widest text-muted">captured</div>
					</div>
				</div>
			</section>

			<!-- Table Controls -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5">
				<h2 class="mb-2 text-[11px] uppercase tracking-[0.26em] text-muted">Tables ({st?.tables.length ?? 0})</h2>
				<div class="grid gap-2.5">
					{#each st?.tables ?? [] as t (t.id)}
						{@const fn = tablePersona(t.id)}
						<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg/50 p-3">
							<div class="flex items-center gap-3 min-w-0">
								<span class="h-3 w-3 shrink-0 rounded-full" style="background:{fn.color}"></span>
								<div class="min-w-0">
									<div class="font-display font-bold text-sm truncate">Table {t.id} · {fn.name}</div>
									<div class="text-xs text-muted">
										{formatUsd(boardTokenSum(t.board))} ·
										<b class={t.lockedThisRound ? 'text-teal' : 'text-gold'}>{t.lockedThisRound ? 'submitted' : 'open'}</b>
									</div>
								</div>
							</div>
							<div class="flex gap-2 shrink-0">
								<a href="/play/{SESSION}/{t.id}" target="_blank" class="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-gold">Open</a>
								{#if t.lockedThisRound}
									<button type="button" onclick={() => session.unlockTable(t.id)} disabled={session.busy}
										class="rounded-lg border border-teal px-3 py-1.5 text-xs text-teal hover:bg-teal/10 disabled:opacity-40">Unlock</button>
								{:else}
									<button type="button" onclick={() => session.lockTable(t.id)} disabled={session.busy}
										class="rounded-lg border border-gold px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40">Lock</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		</div>

		<!-- RIGHT COLUMN -->
		<div class="space-y-6">
			<!-- Budget -->
			<section class="rounded-2xl border border-gold/30 bg-panel/40 p-5 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-[11px] uppercase tracking-[0.26em] text-gold">Room Budget</h2>
						<p class="text-xs text-muted">Total to split across {st?.tables.length ?? 7} tables. Save live — phones pick it up.</p>
					</div>
					<button type="button" onclick={saveBudget} disabled={session.busy}
						class="rounded-xl bg-gold px-5 py-2 font-display text-sm font-bold text-[var(--color-on-gold)] shadow hover:bg-gold/90 disabled:opacity-40">
						Save Budget
					</button>
				</div>
				<label class="block space-y-1.5">
					<span class="text-xs font-semibold text-muted">Room budget ($M)</span>
					<input type="number" min="1" max="9999" bind:value={host.roomBountyTokens}
						class="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold" />
				</label>
				<p class="text-xs text-muted">
					≈ {formatUsd(Math.floor(host.roomBountyTokens / Math.max(1, st?.tables.length ?? 7)))} per table
				</p>
			</section>

			<!-- Export -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5 space-y-3">
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Session Data</h2>
				<p class="text-xs text-muted">Download full session state as JSON for backup or analysis.</p>
				<button type="button" onclick={exportSessionJSON} disabled={!st}
					class="rounded-xl border border-line px-4 py-2 font-display text-xs font-bold hover:border-gold disabled:opacity-30">
					Export JSON ↓
				</button>
			</section>

			<!-- Generated Images -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5 space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Generated Images</h2>
						<p class="text-xs text-muted">
							{#if imageCount > 0}{imageCount} image{imageCount === 1 ? '' : 's'}{:else}None yet{/if}
						</p>
					</div>
					{#if imageCount > 0}
						<button type="button" onclick={downloadAll}
							class="rounded-xl bg-teal px-4 py-2 font-display text-xs font-bold text-[var(--color-on-teal)] shadow hover:bg-teal/90">Save All ↓</button>
					{/if}
				</div>

				{#if imageCount > 0}
					<div class="grid gap-2">
						{#if st?.finaleImageUrl}
							<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
								<img src={st.finaleImageUrl} alt="Room finale" class="h-14 w-24 shrink-0 rounded-lg border border-line object-cover" loading="lazy" />
								<div class="flex-1 min-w-0">
									<div class="font-display font-bold text-xs">Room Finale</div>
								</div>
								<button type="button" onclick={() => downloadImage(st.finaleImageUrl!, 'finale-room.png')}
									class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold">Save</button>
							</div>
						{/if}
						{#each st?.tables ?? [] as t (t.id)}
							{#if t.imageUrl}
								{@const fn = tablePersona(t.id)}
								<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
									<img src={t.imageUrl} alt="Table {t.id} render" class="h-14 w-24 shrink-0 rounded-lg border border-line object-cover" loading="lazy" />
									<div class="flex-1 min-w-0">
										<div class="font-display font-bold text-xs">T{t.id} · {fn.name}</div>
									</div>
									<button type="button"
										onclick={() => downloadImage(t.imageUrl!, `table-${t.id}-${fn.name.toLowerCase().replace(/\s+/g, '-')}.png`)}
										class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold">Save</button>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</section>

			<!-- Reset -->
			<section class="rounded-2xl border border-red/30 bg-panel/40 p-5 space-y-3">
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-red">Reset Session</h2>
				<p class="text-xs text-muted">Wipe all table boards & reset to fresh lobby state.</p>
				<button type="button" onclick={resetSession} disabled={session.busy}
					class="rounded-xl border border-red/50 bg-red/10 px-4 py-2 font-display text-xs font-bold text-red hover:bg-red/20 disabled:opacity-40">Reset Whole Session</button>
			</section>
		</div>
	</div>
</main>
