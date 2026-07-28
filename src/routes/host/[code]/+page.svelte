<script lang="ts">
	import { onMount } from 'svelte';
	import RoundQuestion from '$lib/components/RoundQuestion.svelte';
	import {
		CAPTURE_ROUNDS,
		ROUND_COUNT,
		SCENARIOS,
		boardTokenSum,
		formatUsd,
		tablePersona,
		tokenUnitLabel
	} from '$lib/game';
	import { host, SESSION, session } from '$lib/state';

	onMount(() => {
		host.syncOnce(session.room);
	});

	const scenario = $derived(SCENARIOS[session.room?.round ?? 0]);
	const st = $derived(session.room);
	const perTableTok = $derived(
		Math.floor(host.roomBountyTokens / Math.max(1, host.tableCount))
	);

	const imageCount = $derived(
		(st?.finaleImageUrl ? 1 : 0) +
		(st?.tables.filter((t) => t.imageUrl).length ?? 0)
	);

	async function saveAllSettings() {
		await session.setTables(host.tableCount);
		await session.setConfig({
			roomBountyTokens: host.roomBountyTokens
		});
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
</script>

<svelte:head>
	<title>Admin · Host · LIVE</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-6 py-10">
	<!-- Header -->
	<header class="mb-8">
		<p class="font-mono text-xs uppercase tracking-[0.3em] text-gold">Admin · host</p>
		<h1 class="font-display mt-2 text-4xl font-bold">COMMON <span class="text-gold">GROUND</span></h1>
		<p class="mt-2 max-w-lg text-sm text-muted">
			Settings & live table controls. Presenter runs the room.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2">
				<span class="font-mono text-xl font-bold tracking-widest text-ink">SESSION: LIVE</span>
				<span
					class="font-mono text-xs uppercase tracking-widest font-semibold"
					class:text-teal={session.connected}
					class:text-muted={!session.connected}
				>
					{session.connected ? '● Connected' : '○ Offline'}
				</span>
			</div>
			<a
				href="/present/{SESSION}"
				target="_blank"
				class="rounded-xl border border-gold/50 px-4 py-2 font-display text-sm font-bold text-gold hover:bg-gold/10"
			>
				Presenter →
			</a>
			<a
				href="/"
				target="_blank"
				class="rounded-xl border border-line px-4 py-2 text-sm hover:border-gold"
			>
				Table Directory
			</a>
		</div>
	</header>

	<!-- Live ops (left) · setup (right) — side by side on laptop, stacked on mobile -->
	<div class="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
	<div>
	<!-- Live Session Status -->
	<section class="mb-6 rounded-2xl border border-line bg-panel/40 p-5">
		<h2 class="mb-2 text-[11px] uppercase tracking-[0.26em] text-muted">Status</h2>
		{#if st?.phase === 'round' && scenario}
			<RoundQuestion scenario={scenario} roundIndex={st.round} roundCount={ROUND_COUNT} compact />
		{:else if st?.phase === 'lobby'}
			<p class="text-sm text-muted">Lobby — presenter starts R1 when ready.</p>
		{:else}
			<p class="text-sm text-muted">Phase: {st?.phase ?? '…'}</p>
		{/if}
		<div class="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line/40 pt-3">
			<div class="flex flex-wrap gap-1.5">
				{#each Array(ROUND_COUNT) as _, i (i)}
					{@const r = i + 1}
					{@const current = st?.phase === 'round' && (st?.round ?? 0) + 1 === r}
					{@const done =
						st?.phase === 'round'
							? (st?.round ?? 0) + 1 > r
							: st?.phase === 'reveal' || st?.phase === 'finale'}
					{@const evo = [2, 3, 5].includes(r)}
					<span
						class="rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
						class:border-teal={current}
						class:bg-teal={current}
						class:text-bg={current}
						class:border-gold={evo && !current}
						class:text-gold={evo && !current}
						class:border-line={!current && !evo}
						class:text-muted={!current && !evo}
						class:opacity-50={done && !current}
					>
						R{r}{evo ? '◉' : ''}
					</span>
				{/each}
			</div>
			<div class="text-right">
				<div class="text-2xl font-bold text-teal">
					{st?.tables.filter((t) => t.lockedThisRound).length ?? 0}<span
						class="text-base text-muted">/{st?.tables.length ?? 0}</span
					>
				</div>
				<div class="text-[10px] uppercase tracking-widest text-muted">captured</div>
			</div>
		</div>
	</section>

	<!-- Table Controls -->
	<section class="mb-6 rounded-2xl border border-line bg-panel/40 p-5">
		<div class="flex items-center justify-between mb-2">
			<div>
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Tables ({st?.tables.length ?? 0})</h2>
				<p class="text-xs text-muted">Manual Lock / Unlock override for each function table.</p>
			</div>
		</div>
		<div class="mt-3 grid gap-3">
			{#each st?.tables ?? [] as t (t.id)}
				{@const fn = tablePersona(t.id)}
				<div
					class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg/50 p-3.5"
				>
					<div class="flex items-start gap-3">
						<span class="mt-1 h-3 w-3 shrink-0 rounded-full" style="background:{fn.color}"></span>
						<div>
							<div class="font-display font-bold text-sm">Table {t.id} · {fn.name}</div>
							<div class="text-xs text-muted">
								{fn.lens} · {formatUsd(boardTokenSum(t.board))} ·
								<b class={t.lockedThisRound ? 'text-teal' : 'text-gold'}>
									{t.lockedThisRound ? 'submitted' : 'open'}
								</b>
							</div>
						</div>
					</div>
					<div class="flex gap-2">
						<a
							href="/play/{SESSION}/{t.id}"
							target="_blank"
							class="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-gold"
						>
							Open
						</a>
						{#if t.lockedThisRound}
							<button
								type="button"
								onclick={() => session.unlockTable(t.id)}
								disabled={session.busy}
								class="rounded-lg border border-teal px-3 py-1.5 text-xs text-teal hover:bg-teal/10 disabled:opacity-40"
							>
								Unlock
							</button>
						{:else}
							<button
								type="button"
								onclick={() => session.lockTable(t.id)}
								disabled={session.busy}
								class="rounded-lg border border-gold px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40"
							>
								Lock Table
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</section>
	</div>

	<div>
	<!-- Unified Settings Card -->
	<section class="mb-6 rounded-2xl border border-gold/30 bg-panel/40 p-5 space-y-5">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-gold">Session Settings</h2>
				<p class="text-xs text-muted">
					Each table: {formatUsd(10)} · chips {tokenUnitLabel()}. Spend stake to find room common ground.
				</p>
			</div>
			<button
				type="button"
				onclick={saveAllSettings}
				disabled={session.busy}
				class="rounded-xl bg-gold px-5 py-2 font-display text-sm font-bold text-[var(--color-on-gold)] shadow hover:bg-gold/90 disabled:opacity-40"
			>
				Save All Settings
			</button>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="space-y-1">
				<span class="text-xs font-semibold text-muted">Table Count</span>
				<input
					type="number"
					min="1"
					max="20"
					bind:value={host.tableCount}
					class="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
				/>
			</label>

			<label class="space-y-1">
				<span class="text-xs font-semibold text-muted">Room budget · $M (chips {tokenUnitLabel()})</span>
				<input
					type="number"
					min="1"
					max="9999"
					bind:value={host.roomBountyTokens}
					class="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
				/>
			</label>
		</div>
		<p class="text-xs text-muted">
			Per table target = {formatUsd(perTableTok)}.
		</p>

		<!-- Capture rounds (fixed) -->
		<div class="border-t border-line/40 pt-4 space-y-2">
			<h3 class="text-[11px] uppercase tracking-[0.2em] text-muted">Capture Rounds</h3>
			<div class="flex flex-wrap items-center gap-2">
				{#each Array(ROUND_COUNT) as _, i (i)}
					{@const r = i + 1}
					{@const capture = (CAPTURE_ROUNDS as readonly number[]).includes(r)}
					<span
						class="rounded-full border px-4 py-1.5 font-mono text-xs font-bold"
						class:border-gold={capture}
						class:text-gold={capture}
						class:border-line={!capture}
						class:text-muted={!capture}
					>
						R{r}
					</span>
				{/each}
			</div>
			<p class="text-xs text-muted">Tables seal board state on <b class="text-gold">R2 · R3 · R5</b> — fixed.</p>
		</div>
	</section>

	<!-- Generated Images -->
	<section class="mb-6 rounded-2xl border border-line bg-panel/40 p-5">
		<div class="flex items-center justify-between mb-3">
			<div>
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Generated Images</h2>
				<p class="text-xs text-muted">
					{#if imageCount > 0}
						{imageCount} image{imageCount === 1 ? '' : 's'} generated
					{:else}
						No images yet — generate from the Presenter deck or table renders
					{/if}
				</p>
			</div>
			{#if imageCount > 0}
				<button
					type="button"
					onclick={downloadAll}
					class="rounded-xl bg-teal px-4 py-2 font-display text-xs font-bold text-[var(--color-on-teal)] shadow hover:bg-teal/90"
				>
					Save All ↓
				</button>
			{/if}
		</div>

		{#if imageCount > 0}
			<div class="grid gap-3">
				<!-- Room finale -->
				{#if st?.finaleImageUrl}
					<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
						<div class="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-line">
							<img
								src={st.finaleImageUrl}
								alt="Room finale render"
								class="h-full w-full object-cover"
								loading="lazy"
							/>
						</div>
						<div class="flex-1 min-w-0">
							<div class="font-display font-bold text-sm">Room Finale</div>
							<div class="text-xs text-muted truncate">{st.finaleImageUrl}</div>
						</div>
						<button
							type="button"
							onclick={() => downloadImage(st.finaleImageUrl!, 'finale-room.png')}
							class="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs hover:border-gold"
						>
							Save
						</button>
					</div>
				{/if}

				<!-- Per-table renders -->
				{#each st?.tables ?? [] as t (t.id)}
					{#if t.imageUrl}
						{@const fn = tablePersona(t.id)}
						<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
							<div class="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-line">
								<img
									src={t.imageUrl}
									alt="Table {t.id} render"
									class="h-full w-full object-cover"
									loading="lazy"
								/>
							</div>
							<div class="flex-1 min-w-0">
								<div class="font-display font-bold text-sm">Table {t.id} · {fn.name}</div>
								<div class="text-xs text-muted truncate">{t.imageUrl}</div>
							</div>
							<button
								type="button"
								onclick={() => downloadImage(t.imageUrl!, `table-${t.id}-${fn.name.toLowerCase().replace(/\s+/g, '-')}.png`)}
								class="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs hover:border-gold"
							>
								Save
							</button>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</section>

	<!-- Reset Session -->
	<section class="mb-6 rounded-2xl border border-red/30 bg-panel/40 p-5">
		<h2 class="text-[11px] uppercase tracking-[0.26em] text-red">Reset Session</h2>
		<p class="mt-1 text-xs text-muted">Wipe all table boards & reset to fresh lobby state.</p>
		<button
			type="button"
			onclick={resetSession}
			disabled={session.busy}
			class="mt-3 rounded-xl border border-red/50 bg-red/10 px-4 py-2 font-display text-xs font-bold text-red hover:bg-red/20 disabled:opacity-40"
		>
			Reset Whole Session
		</button>
	</section>
	</div>
	</div>
</main>
