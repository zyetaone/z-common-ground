<script lang="ts">
	import { onMount } from 'svelte';
	import {
		advanceLabel,
		canAdvance,
		canRetreat
	} from '$lib/client/present-labels';
	import {
		ROUND_COUNT,
		roomScenarios,
		roomThesis,
		tablePersona
	} from '$lib/game';
	import { present, SESSION, session } from '$lib/state';

	const st = $derived(session.room);
	const phase = $derived(session.phase);
	const round = $derived(st?.round ?? 0);
	const roundLabel = $derived(round + 1);
	const roundCount = $derived(st?.roundCount ?? ROUND_COUNT);
	const rs = $derived(roomScenarios(st));
	const scenario = $derived(rs[Math.min(round, rs.length - 1)] ?? rs[0]);
	const open = $derived(session.analysisOpen);
	const thesis = $derived(roomThesis(st));
	const joinedCount = $derived(st?.tables.filter((t) => t.joined).length ?? 0);
	const lockedCount = $derived(st?.tables.filter((t) => t.lockedThisRound).length ?? 0);
	const frozenCount = $derived(st?.tables.filter((t) => t.physicallyDone).length ?? 0);
	const totalTables = $derived(st?.tables.length ?? 7);
	const canAdvanceNow = $derived(canAdvance(phase));
	const canRetreatNow = $derived(canRetreat(phase));
	const advanceLabelNow = $derived(advanceLabel(phase, roundLabel));

	function onKey(e: KeyboardEvent) {
		const t = e.target;
		if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
		if ((e.key === 'a' || e.key === 'A') && canAdvanceNow && !session.busy) {
			e.preventDefault();
			advanceRound();
		}
	}

	async function retreatRound() {
		if (session.busy) return;
		if (!confirm('Step back one round? Boards reopen so tables can fix mistakes. Tokens stay.')) return;
		await session.retreat();
		await session.refresh();
	}

	async function advanceRound() {
		if (session.busy || !canAdvanceNow) return;
		await session.advance();
		await session.refresh();
	}

	onMount(() => {
		// Deep-link ?s=N → redirect to the dedicated analysis route.
		// Plain visit → keep the operational view (lobby + submissions + scenario).
		const sp = new URL(window.location.href).searchParams;
		const raw = Number(sp.get('s'));
		if (raw >= 1 && raw <= present.total) {
			window.location.assign('/presenter/analysis?s=' + raw);
		}
	});
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
	<title>Present · LIVE</title>
	<meta
		name="description"
		content="Each function had $100M. Where would they spend it? Where is Common Ground? What would that workplace look like?"
	/>
</svelte:head>

<main class="stage">
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
			<a class="look" href="/presenter/analysis">Analysis →</a>
			<a class="host" href="/host/{SESSION}" target="_blank">Host</a>
		</div>
	</header>

	{#if phase === 'lobby'}
		<div class="sc-bar">
			<div class="sc-left">
				<span class="sc-emoji">🏁</span>
				<span class="sc-q">Session ready — tables scan QR to join</span>
			</div>
			<div class="sc-act">
				<button type="button" class="sc-btn primary" disabled={session.busy || !canAdvanceNow} onclick={advanceRound}>
					{session.busy ? '…' : advanceLabelNow}
				</button>
			</div>
		</div>
	{:else if phase === 'round' && scenario && !open}
		<div class="sc-bar">
			<div class="sc-left">
				<span class="sc-emoji">{scenario.emoji}</span>
				<div class="sc-text">
					<span class="sc-q">{scenario.question}</span>
					{#if scenario.experience}
						<span class="sc-experience">{scenario.experience}</span>
					{/if}
				</div>
			</div>
			<div class="sc-act">
				{#if canRetreatNow}
					<button type="button" class="sc-btn ghost" disabled={session.busy} onclick={retreatRound}>← Back</button>
				{/if}
				<button type="button" class="sc-btn primary" disabled={session.busy || !canAdvanceNow} onclick={advanceRound}>
					{session.busy ? '…' : advanceLabelNow}
				</button>
			</div>
		</div>
	{:else if phase === 'reveal' || phase === 'finale'}
		<div class="sc-bar finale">
			<div class="sc-left">
				<span class="sc-emoji">{phase === 'reveal' ? '📊' : '🏆'}</span>
				<div class="sc-text">
					<span class="sc-q">{thesis.cgiLine}</span>
					<span class="sc-sub">Open the analysis — shape · moves · functions</span>
				</div>
			</div>
			<div class="sc-act">
				<a class="sc-btn primary" href="/presenter/analysis">Open analysis →</a>
			</div>
		</div>
	{/if}

	{#if !st}
		<div class="center muted">Connecting…</div>
	{:else if !open}
		<div class="lobby-wrap">
			{#if phase === 'lobby'}
				<div class="submissions">
					<div class="sub-head">
						<span class="sub-title">Table Directory</span>
						<span class="sub-count">{joinedCount}/{totalTables} joined</span>
					</div>
					<div class="sub-grid">
						{#each st.tables as t (t.id)}
							{@const fn = tablePersona(t.id, st)}
							<div class="sub-card" class:joined-card={t.joined}>
								<div class="sub-card-top">
									<span class="sub-dot" style="background:{fn.color}"></span>
									<span class="sub-name">{fn.name}</span>
								</div>
								{#if t.joined}
									<div class="sub-badge">✓ Joined</div>
								{:else}
									<div class="sub-badge idle">Table {t.id}</div>
								{/if}
								<div class="sub-lens">{fn.lens}</div>
							</div>
						{/each}
					</div>
				</div>
			{:else if phase === 'round'}
				<div class="submissions">
					<div class="sub-head">
						<span class="sub-title">Live Table Submissions</span>
						<span class="sub-count">{frozenCount}/{totalTables} Frozen  ·  {lockedCount}/{totalTables} Submitted</span>
					</div>
					<div class="sub-grid">
						{#each st.tables as t (t.id)}
							{@const fn = tablePersona(t.id, st)}
							<div class="sub-card" class:locked={t.lockedThisRound}>
								<div class="sub-card-top">
									<span class="sub-dot" style="background:{t.lockedThisRound ? 'var(--color-teal)' : fn.color}"></span>
									<span class="sub-name">{fn.name}</span>
								</div>
								{#if t.lockedThisRound}
									<div class="sub-badge">✓ Sealed</div>
									<div class="sub-status">Mix locked</div>
								{:else if t.physicallyDone}
									<div class="sub-badge">❄ Frozen</div>
									<div class="sub-status">Matching digital…</div>
								{:else}
									<div class="sub-badge idle">Physical board</div>
									<div class="sub-status">Open</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{:else if phase === 'reveal' || phase === 'finale'}
				<div class="post-reveal">
					<header class="pr-h">
						<p class="pr-title">Reveal is on.</p>
						<p class="pr-sub">The pattern-recognition analysis lives on its own page.</p>
					</header>
					<a class="pr-cta" href="/presenter/analysis">Open analysis →</a>
				</div>
			{/if}
		</div>
	{/if}
</main>

<style>
	.stage {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 6px 16px 10px;
		background: var(--color-bg);
		color: var(--color-ink);
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		flex-shrink: 0;
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
	.gold {
		color: var(--color-gold);
	}
	.conn {
		font-size: 10px;
		color: var(--color-muted);
	}
	.conn.on {
		color: var(--color-teal);
	}
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
	}
	.rung.evo {
		opacity: 0.5;
	}
	.tb-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.count-chip,
	.look,
	.host {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--color-ink);
		text-decoration: none;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--color-line);
	}
	.look,
	.host {
		color: var(--color-teal);
	}
	.look:hover,
	.host:hover {
		background: color-mix(in srgb, var(--color-teal) 10%, transparent);
	}
	.center {
		padding: 48px;
		text-align: center;
		color: var(--color-muted);
		font-size: 14px;
	}
	.muted {
		color: var(--color-muted);
	}
	.sc-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		flex-shrink: 0;
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
	.sc-emoji {
		font-size: 18px;
		flex-shrink: 0;
	}
	.sc-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.sc-q {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 2.8vw, 2.25rem);
		font-weight: 800;
		line-height: 1.2;
		letter-spacing: -0.03em;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.sc-experience {
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.4;
		font-weight: 500;
		display: none;
	}
	.sc-sub {
		font-size: 13px;
		color: var(--color-muted);
		line-height: 1.35;
		font-weight: 500;
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
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.sc-btn.primary {
		border: none;
		background: var(--color-teal);
		color: var(--color-on-teal);
	}
	.sc-btn.ghost {
		color: var(--color-muted);
	}
	.sc-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.lobby-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
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
		justify-content: center;
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
	.sub-card.joined-card {
		border-color: color-mix(in srgb, var(--color-teal) 55%, transparent);
		background: color-mix(in srgb, var(--color-teal) 14%, var(--color-panel));
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
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.sub-name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 15px;
	}
	.sub-badge {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.06em;
		padding: 2px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-teal) 18%, transparent);
		color: var(--color-teal);
		display: inline-block;
		margin-bottom: 6px;
	}
	.sub-badge.idle {
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
		color: var(--color-muted);
	}
	.sub-lens {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.3;
	}
	.sub-status {
		font-size: 10px;
		color: var(--color-muted);
		margin-top: 2px;
	}
	.post-reveal {
		margin: 32px auto;
		max-width: 520px;
		padding: 24px;
		text-align: center;
		border-radius: 16px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.pr-h {
		margin: 0 0 16px;
	}
	.pr-title {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 800;
		color: var(--color-ink);
		margin: 0 0 4px;
	}
	.pr-sub {
		font-size: 13px;
		color: var(--color-muted);
		margin: 0;
	}
	.pr-cta {
		display: inline-block;
		padding: 10px 20px;
		border-radius: 10px;
		background: var(--color-teal);
		color: var(--color-on-teal);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 14px;
		text-decoration: none;
	}
	.pr-cta:hover {
		filter: brightness(1.05);
	}
</style>