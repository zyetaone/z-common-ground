<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ROUND_COUNT,
		boardTokenSum,
		formatUsd,
		isCaptureRound,
		tablePersona,
		roomScenarios
	} from '$lib/game';
	import { host, SESSION, session } from '$lib/state';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';
	import HostPhotos from '$lib/components/host/HostPhotos.svelte';
	import HostGameConfig from '$lib/components/host/HostGameConfig.svelte';

	onMount(() => {
		host.syncOnce(session.room);
	});

	const st = $derived(session.room);
	const rs = $derived(roomScenarios(st));
	const scenario = $derived(rs[st?.round ?? 0]);
	const lockedCount = $derived(st?.tables.filter((t) => t.lockedThisRound).length ?? 0);
	const openCount = $derived((st?.tables.length ?? 0) - lockedCount);
	const roundLabel = $derived((st?.round ?? 0) + 1);
	const captureRound = $derived(
		st?.phase === 'round' && isCaptureRound(roundLabel, st)
	);

	let resetOpen = $state(false);
	let resetConfirm = $state('');
	let lockingAll = $state(false);
	let emulateBusy = $state(false);
	let emulateMsg = $state('');

	async function resetSession() {
		if (resetConfirm !== 'LIVE') return;
		await session.ensure({ reset: true, tableCount: host.tableCount });
		host.resync(session.room);
		resetOpen = false;
		resetConfirm = '';
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

	async function sealAll() {
		if (!st) return;
		lockingAll = true;
		try {
			for (const t of st.tables) {
				if (!t.lockedThisRound) await session.lockTable(t.id);
			}
		} finally {
			lockingAll = false;
		}
	}

	async function unsealAll() {
		if (!st) return;
		lockingAll = true;
		try {
			for (const t of st.tables) {
				if (t.lockedThisRound) await session.unlockTable(t.id);
			}
		} finally {
			lockingAll = false;
		}
	}

	/** Solo demo: random bias-weighted boards for every table this round. */
	async function runEmulate() {
		emulateBusy = true;
		emulateMsg = '';
		try {
			await session.emulateDemoPlay(Date.now());
			emulateMsg = captureRound
				? 'Demo boards sealed for all tables. Open Presenter → analysis.'
				: 'Demo boards saved (no seal this round). Advance or open analysis as needed.';
		} catch (e) {
			emulateMsg = e instanceof Error ? e.message : 'Emulate failed';
		} finally {
			emulateBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Host · LIVE</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-5 sm:px-6 py-8 sm:py-10">
	{#if session.error}
		<div class="mb-4 rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
			{session.error}
		</div>
	{/if}

	<header class="mb-8">
		<p class="font-mono text-xs uppercase tracking-[0.3em] text-gold">Host control</p>
		<h1 class="font-display mt-2 text-3xl sm:text-4xl font-bold">
			COMMON <span class="text-gold">GROUND</span>
		</h1>
		<p class="mt-2 text-sm text-muted max-w-xl">
			Run tables, edit questions & board options, demo-play without people, manage photo archive.
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
			<div class="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2">
				<span class="font-mono text-sm sm:text-lg font-bold tracking-widest text-ink">LIVE</span>
				<span
					class="font-mono text-[10px] uppercase tracking-widest font-semibold"
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
				Directory
			</a>
			<a
				href="/present/{SESSION}/qrs"
				target="_blank"
				class="rounded-xl border border-line px-4 py-2 text-sm hover:border-gold"
			>
				Print QRs
			</a>
		</div>
	</header>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
		<!-- RUN COLUMN -->
		<div class="space-y-5">
			<section class="rounded-2xl border border-line bg-panel/40 p-5">
				<h2 class="mb-2 text-[11px] uppercase tracking-[0.26em] text-muted">Status</h2>
				{#if st?.phase === 'round' && scenario}
					<div class="text-sm">
						<span class="font-mono text-gold font-bold">R{st.round + 1}</span>
						<span class="text-muted"> · {scenario.question}</span>
					</div>
					{#if scenario.hint}
						<p class="mt-1.5 text-xs text-muted leading-relaxed">{scenario.hint}</p>
					{/if}
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
							{@const past =
								st?.phase === 'round'
									? (st?.round ?? 0) + 1 > r
									: st?.phase === 'reveal' || st?.phase === 'finale'}
							<span
								class="rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
								class:border-teal={cur}
								class:bg-teal={cur}
								class:text-bg={cur}
								class:border-gold={[2, 3, 5].includes(r) && !cur}
								class:text-gold={[2, 3, 5].includes(r) && !cur}
								class:border-line={!cur && ![2, 3, 5].includes(r)}
								class:text-muted={!cur && ![2, 3, 5].includes(r)}
								class:opacity-50={past && !cur}>R{r}{[2, 3, 5].includes(r) ? '◉' : ''}</span
							>
						{/each}
					</div>
					<div class="text-right">
						<div class="text-2xl font-bold text-teal">
							{lockedCount}
							<span class="text-base text-muted">/{st?.tables.length ?? 0}</span>
						</div>
						<div class="text-[10px] uppercase tracking-widest text-muted">sealed</div>
					</div>
				</div>
			</section>

			<!-- Solo demo -->
			<section class="rounded-2xl border border-gold/35 bg-panel/40 p-5 space-y-3">
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-gold">Demo play (no people)</h2>
				<p class="text-xs text-muted leading-relaxed">
					Fills every table with a <b class="text-ink">bias-weighted random board</b> for this round
					(join + freeze + {captureRound ? 'seal' : 'save without seal'}). Use when you need analysis
					or images without phones in the room.
				</p>
				<button
					type="button"
					onclick={runEmulate}
					disabled={session.busy || emulateBusy || !st}
					class="rounded-xl bg-gold px-4 py-2.5 font-display text-xs font-bold text-[var(--color-on-gold)] hover:bg-gold/90 disabled:opacity-40"
				>
					{emulateBusy ? 'Emulating…' : 'Emulate all tables'}
				</button>
				{#if emulateMsg}
					<p class="text-xs" class:text-teal={!emulateMsg.includes('fail') && !emulateMsg.includes('need')} class:text-red={emulateMsg.includes('fail') || emulateMsg.includes('need')}>
						{emulateMsg}
					</p>
				{/if}
			</section>

			<section class="rounded-2xl border border-line bg-panel/40 p-5">
				<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
					<div>
						<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">
							Tables ({st?.tables.length ?? 0})
						</h2>
						<p class="text-[10px] text-muted mt-0.5 max-w-sm">
							<b class="text-ink">Seal</b> = capture this round’s board (like player submit on R2/R3/R5).
							<b class="text-ink">Unseal</b> = reopen so they can edit again. Not a door lock.
						</p>
					</div>
					<div class="flex flex-wrap gap-1.5">
						<button
							type="button"
							onclick={sealAll}
							disabled={session.busy || lockingAll || openCount === 0}
							class="rounded-lg border border-gold px-2.5 py-1 text-[10px] font-bold text-gold hover:bg-gold/10 disabled:opacity-40"
							title="Seal all open tables for this round"
						>
							Seal all
						</button>
						<button
							type="button"
							onclick={unsealAll}
							disabled={session.busy || lockingAll || lockedCount === 0}
							class="rounded-lg border border-teal px-2.5 py-1 text-[10px] font-bold text-teal hover:bg-teal/10 disabled:opacity-40"
							title="Unseal all — reopen boards"
						>
							Unseal all
						</button>
					</div>
				</div>
				<div class="grid gap-2.5">
					{#each st?.tables ?? [] as t (t.id)}
						{@const fn = tablePersona(t.id, st)}
						<div
							class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg/50 p-3"
						>
							<div class="flex items-center gap-3 min-w-0">
								<span class="h-3 w-3 shrink-0 rounded-full" style="background:{fn.color}"></span>
								<div class="min-w-0">
									<div class="font-display font-bold text-sm truncate">
										Table {t.id} · {fn.name}
									</div>
									<div class="text-xs text-muted">
										{formatUsd(boardTokenSum(t.board))} ·
										<b class={t.lockedThisRound ? 'text-teal' : 'text-gold'}
											>{t.lockedThisRound ? 'sealed' : 'open'}</b
										>
										{#if t.physicallyDone && !t.lockedThisRound}
											· <span class="text-gold">frozen</span>
										{/if}
									</div>
								</div>
							</div>
							<div class="flex gap-2 shrink-0">
								<a
									href="/play/{SESSION}/{t.id}"
									target="_blank"
									class="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-gold"
									>Open</a
								>
								{#if t.lockedThisRound}
									<button
										type="button"
										onclick={() => session.unlockTable(t.id)}
										disabled={session.busy}
										title="Unseal — reopen this table’s board for edits"
										class="rounded-lg border border-teal px-3 py-1.5 text-xs text-teal hover:bg-teal/10 disabled:opacity-40"
										>Unseal</button
									>
								{:else}
									<button
										type="button"
										onclick={() => session.lockTable(t.id)}
										disabled={session.busy}
										title="Seal — capture current board for this round (host force-submit)"
										class="rounded-lg border border-gold px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40"
										>Seal</button
									>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section class="rounded-2xl border border-line bg-panel/40 p-5 space-y-3">
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Session data</h2>
				<p class="text-xs text-muted">Export full room JSON for backup or offline analysis.</p>
				<button
					type="button"
					onclick={exportSessionJSON}
					disabled={!st}
					class="rounded-xl border border-line px-4 py-2 font-display text-xs font-bold hover:border-gold disabled:opacity-30"
				>
					Export JSON ↓
				</button>
			</section>

			<section class="rounded-2xl border border-red/30 bg-panel/40 p-5 space-y-3">
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-red">Reset session</h2>
				<p class="text-xs text-muted">Wipe all boards and return to lobby. Archive photos are kept.</p>
				<button
					type="button"
					onclick={() => {
						resetConfirm = '';
						resetOpen = true;
					}}
					disabled={session.busy}
					class="rounded-xl border border-red/50 bg-red/10 px-4 py-2 font-display text-xs font-bold text-red hover:bg-red/20 disabled:opacity-40"
				>
					Reset whole session
				</button>
			</section>
		</div>

		<!-- CONTENT + PHOTOS -->
		<div class="space-y-5">
			<HostGameConfig />
			<HostPhotos />
		</div>
	</div>
</main>

<Modal bind:open={resetOpen} label="Reset session" onclose={() => (resetConfirm = '')}>
	<div class="rounded-2xl border border-red/40 bg-panel p-6 max-w-md space-y-4">
		<div>
			<p class="font-mono text-[10px] uppercase tracking-[0.2em] text-red">Danger zone</p>
			<h2 class="font-display text-xl font-bold mt-1">Reset the whole session?</h2>
			<p class="text-sm text-muted mt-2">
				Boards clear. Tables return to lobby. Photo archive is kept. This cannot be undone.
			</p>
		</div>
		<label class="block space-y-1.5">
			<span class="text-xs font-semibold text-muted"
				>Type <span class="font-mono text-ink">LIVE</span> to confirm</span
			>
			<input
				type="text"
				bind:value={resetConfirm}
				autocomplete="off"
				spellcheck="false"
				class="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm font-mono outline-none focus:border-red"
				placeholder="LIVE"
			/>
		</label>
		<div class="flex flex-wrap gap-2 justify-end">
			<Button variant="outline" onclick={() => (resetOpen = false)}>Cancel</Button>
			<Button
				variant="danger"
				disabled={session.busy || resetConfirm !== 'LIVE'}
				onclick={resetSession}
			>
				{session.busy ? 'Resetting…' : 'Reset session'}
			</Button>
		</div>
	</div>
</Modal>
