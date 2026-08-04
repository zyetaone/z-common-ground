<script lang="ts">
	import type { Persona, Scenario } from '$lib/game/types';

	let {
		persona,
		connected,
		showQuestion,
		roundLabel,
		roundCount,
		phase,
		scenario,
		isFinale
	}: {
		persona: Persona;
		connected: boolean;
		showQuestion: boolean;
		roundLabel: number;
		roundCount: number;
		phase: string;
		scenario: Scenario | null;
		isFinale: boolean;
	} = $props();

	/** Round verb shown inside the badge — from the scenario's move/roundLabel. */
	const moveVerb = $derived(
		phase === 'round' && scenario
			? scenario.move === 'remove'
				? 'REMOVE'
				: scenario.roundLabel === 5
					? 'RESTRUCTURE'
					: 'ADD'
			: null
	);
</script>

<section class="top">
	<div class="topbar">
		<div class="fn" style="--c:{persona.color}">
			<span class="dot"></span>
			<span class="fn-name">{persona.name}</span>
		</div>
		<span class="live" class:on={connected} role="status" aria-label={connected ? 'Connected' : 'Reconnecting'}>{connected ? '●' : '○'}</span>
	</div>

	{#if showQuestion}
		<div class="qcompact">
			<span class="badge-tag">
				{#if phase === 'lobby'}
					Lobby
				{:else}
					R{roundLabel}/{roundCount}{#if moveVerb} · {moveVerb}{/if}
				{/if}
			</span>
			<span class="badge-question" aria-live="polite">
				{#if phase === 'lobby'}
					Session ready — presenter will begin shortly.
				{:else if scenario}
					{scenario.question}
				{/if}
			</span>
		</div>
		{#if phase === 'round' && scenario}
			<!-- hint only. modelRules says the same thing in every round — R1 was
			     "First stake … ~$30M of your $100M wallet. No seal yet." followed by
			     "Table wallet $100M. Place ~$30M. No seal yet." — so the phone
			     printed the round's rule twice, separated by a dot. modelRules is
			     still the host-editable rules field in session config. -->
			{#if scenario.hint}
				<p class="budget-hint">{scenario.hint}</p>
			{/if}
		{:else if persona.mission && phase === 'lobby'}
			<p class="mission"><span class="mission-k">Lens</span> {persona.mission}</p>
			{#if persona.hashtag}
				<p class="persona-hashtag" data-testid="mobile-persona-hashtag">{persona.hashtag}</p>
			{/if}
		{/if}
	{:else if isFinale}
		<div class="qcompact finale">
			<span class="badge-tag">Final</span>
			<span class="badge-question" aria-live="polite">We found common ground — your cumulative results</span>
		</div>
	{/if}
</section>

<style>
	.top {
		position: sticky;
		top: 0;
		z-index: 20;
		padding: 10px 12px 8px;
		background: linear-gradient(180deg, var(--color-bg) 85%, transparent);
		backdrop-filter: blur(8px);
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
	}
	.fn {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.fn .dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--c);
		flex-shrink: 0;
	}
	.fn-name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.live {
		font-size: 12px;
		color: var(--color-muted);
		flex-shrink: 0;
	}
	.live.on {
		color: var(--color-teal-ink);
	}
	.qcompact {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 12px;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in srgb, var(--color-gold) 40%, var(--color-line));
		background: color-mix(in srgb, var(--color-gold) 12%, var(--color-panel));
		font-size: 12px;
	}
	.qcompact.finale {
		border-color: color-mix(in srgb, var(--color-teal) 55%, var(--color-line));
		background: color-mix(in srgb, var(--color-teal) 12%, var(--color-panel));
	}
	.badge-tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-on-gold);
		background: var(--color-gold);
		border-radius: 999px;
		padding: 2px 8px;
		margin-top: 1px;
		flex-shrink: 0;
	}
	.qcompact.finale .badge-tag {
		background: var(--color-teal);
		color: var(--color-on-teal);
	}
	.badge-question {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 16px;
		line-height: 1.3;
		color: var(--color-ink);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		flex: 1;
	}
	.mission {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.4;
		font-weight: 500;
	}
	.mission-k {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-teal-ink);
		margin-right: 6px;
	}
	.persona-hashtag {
		margin: 2px 0 0;
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--color-gold-ink);
	}
	.budget-hint {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--color-gold-ink);
		line-height: 1.4;
		font-weight: 600;
	}
</style>
