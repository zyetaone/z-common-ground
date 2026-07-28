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
	<!-- ── Single consolidated header bar ── -->
	<header class="topbar">
		<div class="tb-left">
			<h1 class="brand">COMMON <span class="gold">GROUND</span></h1>
			<span class="conn" class:on={session.connected} aria-label={session.connected ? 'Connected' : 'Reconnecting'}>
				{session.connected ? '●' : '○'}
			</span>
		</div>

		<div class="tb-rungs">
			{#each Array(roundCount) as _, i (i)}
				{@const r = i + 1}
				{@const cur = phase === 'round' && roundLabel === r}
				{@const past = phase === 'lobby' ? false : phase === 'round' ? r < roundLabel : true}
				{@const evo = [2, 3, 5].includes(r)}
				<span class="rung" class:on={cur} class:past={past && !cur} class:evo={evo}>R{r}</span>
			{/each}
			{#if phase === 'reveal' || phase === 'finale'}
				<span class="rung on">{phase}</span>
			{/if}
		</div>

		<div class="tb-right">
			{#if phase === 'round' && lockedCount > 0}
				<span class="count-chip">{lockedCount}/{totalTables}</span>
			{/if}
			<a href="/host/{SESSION}" class="host-link" target="_blank">Host</a>
		</div>
	</header>

	<!-- ── Scenario + action bar ── -->
	{#if phase === 'round' && scenario && !open}
		<div class="sc-bar">
			<div class="sc-left">
				<span class="sc-emoji">{scenario.emoji}</span>
				<span class="sc-q">{scenario.question}</span>
			</div>
			<div class="sc-act">
				{#if canRetreat}
					<button type="button" class="sc-btn ghost" disabled={session.busy} onclick={retreatRound}>← Back</button>
				{/if}
				<button type="button" class="sc-btn primary" disabled={session.busy || !canAdvance} onclick={advanceRound}>
					{session.busy ? '…' : advanceLabel}
				</button>
			</div>
		</div>
	{:else if !open && (phase === 'reveal' || phase === 'finale')}
		<div class="sc-bar finale">
			<div class="sc-left">
				<span class="sc-emoji">{phase === 'reveal' ? '📊' : '🏆'}</span>
				<span class="sc-q">All rounds complete</span>
			</div>
			<div class="sc-act">
				<button type="button" class="sc-btn ghost" disabled={session.busy} onclick={() => (showExtra = true)}>Analysis</button>
				<button type="button" class="sc-btn primary" disabled={session.busy} onclick={() => present.enterAnalysis()}>
					Open deck →
				</button>
			</div>
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
				<div class="submissions">
					<div class="sub-head">
						<span class="sub-title">Live Table Submissions</span>
						<span class="sub-count">{lockedCount}/{totalTables} Submitted</span>
					</div>

					<div class="sub-grid">
						{#each st.tables as t (t.id)}
							{@const fn = tablePersona(t.id)}
							{@const n = boardTokenSum(t.board)}
							<div
								class="sub-card"
								class:locked={t.lockedThisRound}
							>
								<div class="sub-card-top">
									<span class="sub-dot" style="background:{t.lockedThisRound ? 'var(--color-teal)' : fn.color}"></span>
									<span class="sub-name">{fn.name}</span>
								</div>

								{#if t.lockedThisRound}
									<div class="sub-badge">✓ Submitted</div>
									<div class="sub-amount">{formatUsd(n)}</div>
								{:else}
									<div class="sub-amount gold">
										{#if n > 0}
											{formatUsd(n)}
										{:else}
											<span class="sub-wait"><Icon name="hourglass" size={12} /> Waiting…</span>
										{/if}
									</div>
									<div class="sub-status">{n > 0 ? 'Editing…' : 'Open'}</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
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
		padding: 12px 16px 10px;
		background: var(--color-bg);
		color: var(--color-ink);
	}

	/* ── Top bar: brand · rungs · host ── */
	.topbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
	}
	.tb-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.brand {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}
	.gold { color: var(--color-gold); }
	.conn {
		font-size: 10px;
		color: var(--color-muted);
	}
	.conn.on { color: var(--color-teal); }
	.tb-rungs {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: 1;
		justify-content: center;
	}
	.rung {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		padding: 4px 8px;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		color: var(--color-muted);
	}
	.rung.on {
		background: var(--color-gold);
		border-color: var(--color-gold);
		color: var(--color-on-gold);
		font-weight: 900;
	}
	.rung.past { opacity: 0.35; }
	.rung.evo:not(.on) {
		border-color: color-mix(in srgb, var(--color-gold) 55%, transparent);
		color: var(--color-gold);
	}
	.tb-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.count-chip {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-teal);
		background: color-mix(in srgb, var(--color-teal) 15%, transparent);
		border-radius: 999px;
		padding: 3px 8px;
	}
	.host-link {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		text-decoration: none;
		opacity: 0.6;
	}
	.host-link:hover { opacity: 1; }

	/* ── Scenario bar ── */
	.sc-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
	}
	.sc-bar.finale {
		border-color: color-mix(in srgb, var(--color-gold) 40%, var(--color-line));
	}
	.sc-left {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
	}
	.sc-emoji { font-size: 18px; flex-shrink: 0; }
	.sc-q {
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sc-act {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.sc-btn {
		border-radius: 10px;
		padding: 8px 12px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 12px;
		cursor: pointer;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		white-space: nowrap;
	}
	.sc-btn.primary {
		border: none;
		background: var(--color-teal);
		color: var(--color-on-teal);
	}
	.sc-btn.ghost { color: var(--color-muted); }
	.sc-btn:disabled { opacity: 0.4; cursor: default; }

	/* ── Submissions ── */
	.submissions {
		width: 100%;
		max-width: 56rem;
		margin: 0 auto;
	}
	.sub-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 0 2px 8px;
		border-bottom: 1px solid var(--color-line);
		margin-bottom: 12px;
	}
	.sub-title {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-gold);
	}
	.sub-count {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-teal);
	}
	.sub-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px;
	}
	.sub-card {
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 12px;
		text-align: center;
		transition: border-color 0.2s;
	}
	.sub-card.locked {
		border-color: color-mix(in srgb, var(--color-teal) 55%, var(--color-line));
		background: color-mix(in srgb, var(--color-teal) 8%, var(--color-panel));
		animation: lock-pop 0.35s ease-out;
	}
	@keyframes lock-pop {
		0% { transform: scale(0.94); opacity: 0.65; }
		40% { transform: scale(1.04); }
		100% { transform: scale(1); opacity: 1; }
	}
	.sub-card-top {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-bottom: 8px;
	}
	.sub-dot {
		width: 8px; height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.sub-name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 13px;
	}
	.sub-badge {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-teal);
		background: color-mix(in srgb, var(--color-teal) 15%, transparent);
		border-radius: 999px;
		padding: 3px 10px;
		display: inline-block;
		margin-bottom: 6px;
	}
	.sub-amount {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 800;
	}
	.sub-amount.gold { color: var(--color-gold); }
	.sub-status {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--color-muted);
		margin-top: 2px;
	}
	.sub-wait {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--color-muted);
		font-weight: 600;
		font-size: 11px;
	}

	/* ── Lobby / reveal / finale ── */
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
		font-size: 3.5rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}
	.muted { color: var(--color-muted); }
	/* ── Analysis deck ── */
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

	/* ── Modal ── */
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
		background: var(--color-bg);
		padding: 18px 20px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2);
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
		padding: 6px 12px;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.modal-x:hover { border-color: var(--color-gold); color: var(--color-gold); }
	.modal-tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		padding: 4px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		border: 1px solid var(--color-line);
		margin-bottom: 12px;
	}
	.modal-tab {
		border: none;
		background: transparent;
		color: var(--color-muted);
		border-radius: 8px;
		padding: 8px;
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
