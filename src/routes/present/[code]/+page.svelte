<script lang="ts">
	import {
		FutureWorkspace,
		RoomGlance,
		RoomInsights,
		StageNav,
		WinnersLosers
	} from '$lib/components/present';
	import {
		Headlines,
		PriorityConstellation,
		ReachIntensityQuadrant
	} from '$lib/components/analytics';
	import RoundQuestion from '$lib/components/RoundQuestion.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { advanceLabel as advLabel, canAdvance as canAdv, canRetreat as canRet } from '$lib/client/present-labels';
	import { ROUND_COUNT, SCENARIOS, boardTokenSum, formatUsd, tablePersona } from '$lib/game';
	import { present, SESSION, session } from '$lib/state';

	const SCREENS = [
		{ title: 'Combined Board Heatmap', subtitle: 'Live totals · combined matrix', short: 'Combined Board' },
		{ title: 'Room Insights & Alignment', subtitle: 'Alignment ring · journey & verdict', short: 'Insights' },
		{ title: 'Priority Constellation', subtitle: 'Room tokens stacked by function', short: 'Constellation' },
		{ title: 'Trade-offs & Table Personas', subtitle: 'Champions & table personality', short: 'Trade-offs' },
		{ title: 'Future Workspace & AI Brief', subtitle: 'Room + table AI · ZyetaI', short: 'Future Workspace' }
	] as const;

	type ExtraTab = 'quadrant' | 'headlines';

	const labels = SCREENS.map((s) => s.short);
	const meta = $derived(SCREENS[Math.min(present.screen, SCREENS.length) - 1]);
	const st = $derived(session.room);
	const phase = $derived(session.phase);
	const round = $derived(st?.round ?? 0);
	const roundLabel = $derived(round + 1);
	const roundCount = $derived(st?.roundCount ?? ROUND_COUNT);
	const scenario = $derived(SCENARIOS[Math.min(round, SCENARIOS.length - 1)] ?? SCENARIOS[0]);
	const open = $derived(session.analysisOpen);

	let showExtra = $state(false);
	let extraTab = $state<ExtraTab>('quadrant');

	const lockedCount = $derived(st?.tables.filter((t) => t.lockedThisRound).length ?? 0);
	const totalTables = $derived(st?.tables.length ?? 7);
	const canAdvance = $derived(canAdv(phase));
	const canRetreat = $derived(canRet(phase));
	const advanceLabel = $derived(advLabel(phase, roundLabel));

	function onKey(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;

		if (e.key === 'Escape' && showExtra) {
			e.preventDefault();
			showExtra = false;
			return;
		}
		if ((e.key === 'e' || e.key === 'E') && st) {
			e.preventDefault();
			showExtra = !showExtra;
			return;
		}
		if ((e.key === 'a' || e.key === 'A') && canAdvance && !session.busy) {
			e.preventDefault();
			advanceRound();
			return;
		}
		if (!open || showExtra) return;
		if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'n' || e.key === 'N') {
			e.preventDefault();
			present.next();
		} else if (e.key === 'ArrowLeft' || e.key === 'b' || e.key === 'B') {
			e.preventDefault();
			present.prev();
		}
	}

	async function retreatRound() {
		if (session.busy) return;
		if (!confirm('Step back one round? Boards reopen so tables can fix mistakes. Tokens stay.')) return;
		await session.retreat();
		present.enterAnalysis();
		await session.refresh();
	}

	async function advanceRound() {
		if (session.busy || !canAdvance) return;
		await session.advance();
		present.enterAnalysis();
		await session.refresh();
	}

</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
	<title>Present · LIVE</title>
</svelte:head>

<main class="stage">
	<header class="top">
		<div class="brand-row">
			<h1 class="brand">COMMON <span class="gold">GROUND</span></h1>
			<span class="live-tag">LIVE</span>
		</div>
		<div class="meta">
			{#if phase === 'round'}
				<span class="pill">R{roundLabel}/{roundCount}</span>
				<span class="pill">{lockedCount}/{totalTables}</span>
			{:else}
				<span class="pill dim">{phase}</span>
			{/if}
			<span class:live={session.connected} class:off={!session.connected}>
				{session.connected ? '●' : '○'}
			</span>
			<ZyetaI compact />
			<a href="/host/{SESSION}" class="admin-link">Admin</a>
		</div>
	</header>

	<div class="round-rail" aria-label="Round control">
		<div class="rungs">
			{#each Array(roundCount) as _, i (i)}
				{@const r = i + 1}
				{@const current = phase === 'round' && roundLabel === r}
				{@const done =
					phase === 'lobby' ? false : phase === 'round' ? r < roundLabel : true}
				{@const evo = [2, 3, 5].includes(r)}
				<span class="rung" class:on={current} class:done={done && !current} class:evo={evo}>
					R{r}
				</span>
			{/each}
			{#if phase === 'reveal' || phase === 'finale'}
				<span class="rung on">{phase}</span>
			{/if}
		</div>

		<div class="rail-actions">
			<button
				type="button"
				class="rail-btn ghost subtle"
				disabled={!st}
				onclick={() => (showExtra = true)}
			>
				Extra analysis
			</button>
			{#if canRetreat}
				<button
					type="button"
					class="rail-btn ghost"
					disabled={session.busy}
					onclick={retreatRound}
					title="Correct a mistake — re-open previous step"
				>
					← Step Back
				</button>
			{/if}
			<button
				type="button"
				class="rail-btn primary"
				disabled={session.busy || !canAdvance}
				onclick={advanceRound}
			>
				{session.busy ? '…' : advanceLabel}
			</button>
		</div>
	</div>

	{#if phase === 'round' && scenario && !open}
		<div class="q-banner">
			<RoundQuestion {scenario} roundIndex={round} {roundCount} compact />
		</div>
	{/if}

	{#if !st}
		<div class="center muted">Connecting…</div>
	{:else if !open}
		<div class="center lobby">
			{#if phase === 'lobby'}
				<div class="code">LIVE</div>
				<p class="muted">Tables scan QR · start when ready</p>
			{:else if phase === 'round'}
				<div class="space-y-4 w-full max-w-4xl mx-auto my-4 text-left">
					<div class="flex items-center justify-between font-mono text-xs text-muted border-b border-line pb-2">
						<span class="text-gold font-bold uppercase tracking-widest">Live Table Submissions (R{roundLabel})</span>
						<span class="text-teal font-bold">{lockedCount}/{totalTables} Tables Submitted</span>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
						{#each st.tables as t (t.id)}
							{@const fn = tablePersona(t.id)}
							{@const n = boardTokenSum(t.board)}
							<div
								class="rounded-2xl border p-3.5 text-center space-y-2 transition-all duration-300 shadow-lg"
								class:border-teal={t.lockedThisRound}
								class:bg-teal={t.lockedThisRound}
								class:text-[var(--color-on-teal)]={t.lockedThisRound}
								class:border-line={!t.lockedThisRound}
								class:bg-panel={!t.lockedThisRound}
								class:text-muted={!t.lockedThisRound}
							>
								<div class="flex items-center justify-center gap-1.5">
									<span class="h-2.5 w-2.5 rounded-full" style="background:{t.lockedThisRound ? 'var(--color-on-teal)' : fn.color}"></span>
									<span class="font-display font-bold text-xs">{fn.name}</span>
								</div>

								{#if t.lockedThisRound}
									<div class="font-mono text-[10px] font-black uppercase tracking-wider text-[var(--color-on-teal)] bg-white/40 rounded-full py-1 px-1.5">
										✓ SUBMITTED
									</div>
									<div class="font-mono text-[11px] font-bold">{formatUsd(n)}</div>
								{:else}
									<div class="font-mono text-[11px] text-gold font-semibold">
										{#if n > 0}
											{formatUsd(n)}
										{:else}
											<span class="inline-flex items-center gap-1"><Icon name="hourglass" size={12} /> Waiting…</span>
										{/if}
									</div>
									<div class="text-[10px] text-muted font-mono">{n > 0 ? formatUsd(n) : 'Open'}</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				<div class="round-big">Reveal</div>
				<button type="button" class="next-big" disabled={session.busy} onclick={() => present.enterAnalysis()}>
					Open deck →
				</button>
			{:else}
				<div class="round-big">Finale</div>
				<button type="button" class="next-big" disabled={session.busy} onclick={() => present.enterAnalysis()}>
					Open deck →
				</button>
			{/if}
		</div>
	{:else}
		<div class="hero-title">
			<h2>{meta.title}</h2>
		</div>

		<div class="canvas">
			{#key present.screen}
				<div class="pane">
					{#if present.screen === 1}
						<RoomGlance room={st} />
					{:else if present.screen === 2}
						<RoomInsights room={st} />
					{:else if present.screen === 3}
						<PriorityConstellation room={st} />
					{:else if present.screen === 4}
						<WinnersLosers room={st} />
					{:else}
						<FutureWorkspace room={st} />
					{/if}
				</div>
			{/key}
		</div>

		<StageNav
			page={present.screen}
			total={present.total}
			{labels}
			onprev={() => present.prev()}
			onnext={() => present.next()}
		/>
	{/if}
</main>

{#if showExtra && st}
	<div class="modal-root" role="dialog" aria-modal="true" aria-label="Extra analysis">
		<button type="button" class="modal-backdrop" onclick={() => (showExtra = false)} aria-label="Close"
		></button>
		<div class="modal-sheet">
			<header class="modal-head">
				<div>
					<p class="modal-kicker">Extra · facilitation</p>
					<h2 class="modal-title">Deep dive</h2>
				</div>
				<button type="button" class="modal-x" onclick={() => (showExtra = false)}>Close · Esc</button>
			</header>

			<div class="modal-tabs" role="tablist">
				{#each [
					['quadrant', 'Shape'],
					['headlines', 'Headlines']
				] as [id, lab] (id)}
					<button
						type="button"
						role="tab"
						class="modal-tab"
						class:on={extraTab === id}
						aria-selected={extraTab === id}
						onclick={() => (extraTab = id as ExtraTab)}
					>
						{lab}
					</button>
				{/each}
			</div>

			<div class="modal-body">
				{#if extraTab === 'quadrant'}
					<ReachIntensityQuadrant room={st} />
				{:else}
					<Headlines room={st} />
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.stage {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 16px 20px 12px;
		background: var(--color-bg);
		color: var(--color-ink);
	}
	.round-rail {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 10px 0 8px;
		padding: 10px 12px;
		border-radius: 14px;
		border: 1px solid var(--color-line);
		background: rgba(10, 61, 43, 0.55);
	}
	.rungs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.rung {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 700;
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		color: var(--color-muted);
	}
	.rung.on {
		background: var(--color-gold);
		border-color: var(--color-gold);
		color: var(--color-on-gold);
		font-weight: 900;
		box-shadow: 0 2px 0 #b8892e;
	}
	.rung.done {
		opacity: 0.4;
	}
	.rung.evo:not(.on) {
		border-color: color-mix(in srgb, var(--color-gold) 55%, transparent);
		color: var(--color-gold);
	}
	.rail-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.rail-btn {
		border-radius: 12px;
		padding: 10px 14px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 13px;
		cursor: pointer;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
	}
	.rail-btn.primary {
		border: none;
		background: var(--color-teal);
		color: var(--color-on-teal);
	}
	.rail-btn.ghost {
		color: var(--color-muted);
	}
	.rail-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.q-banner {
		margin-bottom: 8px;
		max-width: 720px;
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--color-line);
	}
	.brand-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.brand {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.02em;
	}
	.live-tag {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		padding: 4px 8px;
		border-radius: 6px;
		border: 1px solid var(--color-line);
		color: var(--color-teal);
	}
	.gold {
		color: var(--color-gold);
	}
	.admin-link {
		opacity: 0.55;
	}
	.admin-link:hover {
		opacity: 1;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.meta a {
		color: var(--color-gold);
		text-decoration: underline;
	}
	.pill {
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--color-gold) 40%, transparent);
		background: color-mix(in srgb, var(--color-gold) 12%, transparent);
		color: var(--color-gold);
		padding: 4px 10px;
	}
	.pill.dim {
		border-color: var(--color-line);
		background: transparent;
		color: var(--color-muted);
	}
	.live {
		color: var(--color-teal);
	}
	.off {
		color: var(--color-red);
	}
	.center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 12px;
	}
	.lobby .code {
		font-family: var(--font-display);
		font-size: 4rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.round-big {
		font-family: var(--font-display);
		font-size: 3.5rem;
		font-weight: 800;
	}
	.muted {
		color: var(--color-muted);
	}
	.next-big {
		width: min(360px, 100%);
		border: none;
		border-radius: 16px;
		background: var(--color-gold);
		color: var(--color-on-gold);
		padding: 18px 22px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.15rem;
		cursor: pointer;
		box-shadow: 0 4px 0 #b8892e;
	}
	.next-big:disabled {
		opacity: 0.4;
	}
	.hero-title {
		text-align: left;
		padding: 10px 0 4px;
	}
	.hero-title h2 {
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 3.5vw, 3rem);
		font-weight: 800;
		margin: 0;
		line-height: 1.15;
	}
	.canvas {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.pane {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.rail-btn.subtle {
		font-weight: 600;
		font-size: 12px;
		opacity: 0.75;
	}
	.modal-root {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}
	.modal-backdrop {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.82);
		backdrop-filter: blur(8px);
		cursor: pointer;
	}
	.modal-sheet {
		position: relative;
		z-index: 1;
		width: min(920px, 100%);
		max-height: min(88vh, 900px);
		display: flex;
		flex-direction: column;
		border-radius: 20px;
		border: 1px solid color-mix(in srgb, var(--color-gold) 35%, transparent);
		background: var(--color-bg2);
		padding: 18px 20px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
		animation: modal-in 0.25s ease both;
	}
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.modal-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--color-line);
	}
	.modal-kicker {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-gold);
	}
	.modal-title {
		margin: 4px 0 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 800;
	}
	.modal-x {
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-muted);
		border-radius: 999px;
		padding: 8px 14px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}
	.modal-x:hover {
		border-color: var(--color-gold);
		color: var(--color-gold);
	}
	.modal-tabs {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		padding: 4px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid var(--color-line);
		margin-bottom: 12px;
	}
	.modal-tab {
		border: none;
		background: transparent;
		color: var(--color-muted);
		border-radius: 9px;
		padding: 10px 6px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		cursor: pointer;
	}
	.modal-tab.on {
		background: var(--color-gold);
		color: var(--color-on-gold);
	}
	.modal-body {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
</style>
