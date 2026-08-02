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
</script>

<section class="top" aria-live="polite">
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
					R{roundLabel}/{roundCount}
				{/if}
			</span>
			<span class="badge-question">
				{#if phase === 'lobby'}
					Session ready — presenter will begin shortly.
				{:else if scenario}
					{scenario.question}
				{/if}
			</span>
		</div>
		{#if phase === 'round' && scenario}
			{@const moveLabel =
				scenario.move === 'remove'
					? 'Remove'
					: scenario.roundLabel === 5
						? 'Restructure'
						: 'Add'}
			<p class="instruction">{moveLabel}</p>
			{#if scenario.hint}
				<p class="budget-hint">{scenario.hint}</p>
			{/if}
			{#if scenario.modelRules}
				<p class="model-rules">{scenario.modelRules}</p>
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
			<span class="badge-question">We found common ground — your cumulative results</span>
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
		color: var(--color-teal);
	}
	.qcompact {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 14px;
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
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
		flex: 1;
	}
	.instruction {
		margin: 6px 0 0;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-teal);
		line-height: 1.35;
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
		color: var(--color-teal);
		margin-right: 6px;
	}
	.persona-hashtag {
		margin: 2px 0 0;
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--color-gold);
	}
	.budget-hint {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--color-gold);
		line-height: 1.4;
		font-weight: 600;
	}
	.model-rules {
		margin: 3px 0 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.04em;
		color: var(--color-muted);
		line-height: 1.35;
	}
</style>
