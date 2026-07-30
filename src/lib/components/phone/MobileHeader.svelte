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
					R{roundLabel}
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
		{#if scenario?.hint && phase === 'round' && scenario?.mode === 'capture'}
			<p class="budget-hint">{scenario.hint}</p>
		{/if}
		{#if scenario && (scenario.modelRules || scenario.actions || scenario.experience)}
			<details class="round-details">
				<summary class="details-summary">Round details</summary>
				<div class="details-body">
					{#if scenario.modelRules}
						<div class="detail-block">
							<h4 class="detail-label">Rules</h4>
							<p class="detail-text">{scenario.modelRules}</p>
						</div>
					{/if}
					{#if scenario.actions}
						<div class="detail-block">
							<h4 class="detail-label">Steps</h4>
							<p class="detail-text actions">{scenario.actions}</p>
						</div>
					{/if}
					{#if scenario.experience}
						<div class="detail-block">
							<h4 class="detail-label">Why this matters</h4>
							<p class="detail-text">{scenario.experience}</p>
						</div>
					{/if}
				</div>
			</details>
		{/if}
	{:else if isFinale}
		<div class="qcompact finale">
			<span class="badge-tag">Final</span>
			<span class="badge-question">Cumulative results</span>
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
		font-weight: 600;
		font-size: 14px;
		line-height: 1.3;
		color: var(--color-ink);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		flex: 1;
	}
	.budget-hint {
		margin: 4px 0 0;
		font-size: 11px;
		color: var(--color-gold);
		line-height: 1.4;
		font-weight: 600;
	}
	.round-details {
		margin-top: 6px;
		border: 1px solid color-mix(in srgb, var(--color-line) 60%, transparent);
		border-radius: 12px;
		overflow: hidden;
	}
	.details-summary {
		padding: 6px 10px;
		font-size: 11px;
		font-weight: 700;
		color: var(--color-muted);
		cursor: pointer;
		user-select: none;
	}
	.details-body {
		padding: 0 10px 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.detail-label {
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-teal);
		margin: 0 0 2px;
	}
	.detail-text {
		font-size: 11px;
		line-height: 1.5;
		color: var(--color-ink);
		margin: 0;
		white-space: pre-line;
	}
	.detail-text.actions {
		padding-left: 4px;
	}
</style>
