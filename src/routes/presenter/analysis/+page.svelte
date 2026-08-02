<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import {
		FunctionPriorities,
		PrioritiesSummary,
		PriorityBreakdown,
		RoomGlance,
		RoundInsights,
		StageNav
	} from '$lib/components/present';
import { DECK_SCREENS, ROUND_COUNT } from '$lib/game';
import { present, SESSION, session } from '$lib/state';

const labels = DECK_SCREENS.map((s) => s.short);
const meta = $derived(DECK_SCREENS[Math.min(present.screen, DECK_SCREENS.length) - 1]);
const st = $derived(session.room);
const phase = $derived(session.phase);
const roundCount = $derived(st?.roundCount ?? ROUND_COUNT);
const roundLabel = $derived((st?.round ?? 0) + 1);
const hasData = $derived((st?.aggregate.totalCoins ?? 0) > 0);
const isRevealable = $derived(
	phase === 'reveal' || phase === 'finale' || (st?.analysisForced ?? false)
);

	/** Optional deep-link ?s=1..5 */
	onMount(() => {
		const raw = Number(page.url.searchParams.get('s'));
		if (raw >= 1 && raw <= present.total) {
			present.setScreen(raw);
		}
		// The analysis page is the analysis deck — auto-enter analysis if possible.
		if (isRevealable) {
			present.enterAnalysis();
		}
	});

	function goScreen(n: number) {
		present.setScreen(n);
		const url = new URL(page.url);
		url.searchParams.set('s', String(n));
		replaceState(url, {});
	}
</script>

<svelte:head>
	<title>Analysis · LIVE</title>
	<meta
		name="description"
		content="Pattern recognition across 5 pattern screens: where the room is, how it moved, and what each function did."
	/>
</svelte:head>

<main class="stage stage-dark">
	<header class="topbar">
		<div class="tb-left">
			<a class="back" href="/present/{SESSION}">← Back to live</a>
			<span class="tag">Analysis · {st?.code ?? SESSION}</span>
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
			<a class="look" href="/present/{SESSION}/look">Look →</a>
			<a class="design" href="/present/{SESSION}/design">Design →</a>
		</div>
	</header>

	{#if !st}
		<p class="center muted">Connecting…</p>
	{:else if !hasData}
		<div class="empty-card">
			<p class="empty-title">No stake yet</p>
			<p class="empty-sub">
				The analysis appears once tables have placed stake. <a href="/present/{SESSION}">Go to live →</a>
			</p>
		</div>
	{:else if !isRevealable}
		<div class="empty-card">
			<p class="empty-title">Analysis not yet available</p>
			<p class="empty-sub">
				Advance through R1–R5 to unlock the reveal. <a href="/present/{SESSION}">Back to live →</a>
			</p>
		</div>
	{:else}
		<div class="canvas">
			{#key present.screen}
				<div class="pane">
					{#if present.screen === 1}
						<RoomGlance room={st} />
					{:else if present.screen === 2}
						<PriorityBreakdown room={st} />
					{:else if present.screen === 3}
						<RoundInsights room={st} />
					{:else if present.screen === 4}
						<PrioritiesSummary room={st} />
					{:else}
						<FunctionPriorities room={st} />
					{/if}
				</div>
			{/key}
		</div>

		<StageNav
			page={present.screen}
			total={present.total}
			{labels}
			title={meta.title}
			endHref={`/present/${SESSION}/look`}
			endLabel="Concepts →"
			onprev={() => {
				present.prev();
				goScreen(present.screen);
			}}
			onnext={() => {
				present.next();
				goScreen(present.screen);
			}}
			ongo={goScreen}
		/>
	{/if}
</main>

<style>
	.stage {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 10px;
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
	.back {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--color-ink);
		text-decoration: none;
		padding: 2px 8px;
		border-radius: 6px;
		border: 1px solid var(--color-line);
	}
	.back:hover {
		background: color-mix(in srgb, var(--color-ink) 4%, transparent);
	}
	.tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
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
		border-style: dashed;
	}
	.rung.past {
		opacity: 0.55;
	}
	.tb-right {
		display: flex;
		gap: 8px;
	}
	.look,
	.design {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-decoration: none;
		color: var(--color-ink);
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--color-line);
	}
	.look:hover,
	.design:hover {
		background: color-mix(in srgb, var(--color-ink) 4%, transparent);
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
	.empty-card {
		margin: auto;
		padding: 48px 24px;
		text-align: center;
		max-width: 480px;
		border-radius: 16px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.empty-title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 800;
		color: var(--color-ink);
		margin: 0 0 8px;
	}
	.empty-sub {
		font-size: 13px;
		color: var(--color-muted);
		margin: 0;
	}
	.empty-sub a {
		color: var(--color-teal);
		font-weight: 700;
		text-decoration: none;
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
		animation: pane-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}
	@keyframes pane-in {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: none; }
	}
	@media (prefers-reduced-motion: reduce) {
		.pane { animation: none; }
	}
</style>