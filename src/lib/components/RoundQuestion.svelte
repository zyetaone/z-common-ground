<script lang="ts">
	import type { Scenario } from '$lib/game/types';
	import { ROUND_COUNT } from '$lib/game';

	/**
	 * Always pairs the current scenario question with its round number + flow mode.
	 */
	let {
		scenario,
		roundIndex = 0,
		roundCount = ROUND_COUNT,
		compact = false
	}: {
		scenario: Scenario | null | undefined;
		/** 0-based room.round */
		roundIndex?: number;
		roundCount?: number;
		compact?: boolean;
	} = $props();

	const label = $derived(Math.max(1, roundIndex + 1));
	const mode = $derived(scenario?.mode ?? 'wait');
	const move = $derived(scenario?.move ?? 'add');
	const modeLabel = $derived(
		mode === 'capture' ? 'CAPTURE total' : mode === 'hold' ? 'HOLD for R5' : 'WAIT · then R2'
	);
	const moveLabel = $derived(move === 'remove' ? 'REMOVE −' : 'ADD +');
</script>

{#if scenario}
	<div
		class="rq"
		class:compact
		class:capture={mode === 'capture'}
		class:hold={mode === 'hold'}
		class:wait={mode === 'wait'}
		class:remove={move === 'remove'}
	>
		<div class="badges">
			<div class="badge">Round {label}<span class="of"> / {roundCount}</span></div>
			<div class="move" class:rm={move === 'remove'}>{moveLabel}</div>
			<div class="mode">{modeLabel}</div>
		</div>
		<p class="cum">Cumulative board · tokens carry · this round {move === 'remove' ? 'take off' : 'add on'}</p>
		<p class="inst">{scenario.instruction}</p>
		<p class="title">{scenario.emoji} {scenario.title}</p>
		<p class="q">{scenario.question}</p>
		{#if !compact && scenario.hint}
			<p class="hint">{scenario.hint}</p>
		{/if}
	</div>
{/if}

<style>
	.rq {
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--color-gold) 35%, var(--color-line));
		background: color-mix(in srgb, var(--color-gold) 8%, var(--color-panel));
		padding: 12px 14px;
	}
	.rq.capture {
		border-color: color-mix(in srgb, var(--color-teal) 50%, var(--color-line));
		background: color-mix(in srgb, var(--color-teal) 10%, var(--color-panel));
	}
	.rq.hold {
		border-color: color-mix(in srgb, var(--color-gold) 40%, var(--color-line));
	}
	.rq.compact {
		padding: 10px 12px;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
	}
	.badge {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-on-gold);
		background: var(--color-gold);
		border-radius: 999px;
		padding: 4px 10px;
	}
	.mode,
	.move {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-radius: 999px;
		padding: 4px 10px;
		border: 1px solid var(--color-line);
		color: var(--color-muted);
	}
	.move {
		border-color: var(--color-teal);
		color: var(--color-teal);
		background: color-mix(in srgb, var(--color-teal) 12%, transparent);
	}
	.move.rm {
		border-color: var(--color-red);
		color: var(--color-red);
		background: color-mix(in srgb, var(--color-red) 12%, transparent);
	}
	.capture .mode {
		border-color: var(--color-teal);
		color: var(--color-teal);
	}
	.hold .mode {
		border-color: var(--color-gold);
		color: var(--color-gold);
	}
	.rq.remove {
		border-color: color-mix(in srgb, var(--color-red) 45%, var(--color-line));
	}
	.cum {
		margin: 0 0 6px;
		font-size: 11px;
		font-family: var(--font-mono);
		color: var(--color-muted);
		letter-spacing: 0.04em;
	}
	.of {
		opacity: 0.7;
		font-weight: 600;
	}
	.inst {
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-gold);
		line-height: 1.35;
	}
	.capture .inst {
		color: var(--color-teal);
	}
	.title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		line-height: 1.25;
	}
	.compact .title {
		font-size: 0.95rem;
	}
	.q {
		margin: 6px 0 0;
		font-size: 14px;
		line-height: 1.45;
		color: var(--color-ink);
	}
	.compact .q {
		font-size: 13px;
	}
	.hint {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
