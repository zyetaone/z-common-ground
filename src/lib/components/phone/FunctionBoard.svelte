<script lang="ts">
	import { scale } from 'svelte/transition';
	import {
		CHIP_DENOMS,
		CHIP_VALUE,
		PRIORITIES,
		R3_REMOVE_TARGET,
		formatUsd,
		formatUsdFull
	} from '$lib/game';
	import type { RoundMove, Vec7 } from '$lib/game/types';
	import Chip from '$lib/components/Chip.svelte';
	import { countUp } from '$lib/actions/count-up';

	const ZEROS: Vec7 = [0, 0, 0, 0, 0, 0, 0];

	let {
		counts,
		color = '#37b6a2',
		editable = true,
		busy = false,
		/** add | remove — R3 is remove-only */
		move = 'add',
		/** Table wallet cap in $M value (default $100M). R3 = current standing. */
		capTokens = 100,
		baseline = null,
		/** Host-overridable board option labels (defaults to PRIORITIES). */
		labels = PRIORITIES as unknown as string[],
		onDelta,
		onClear
	}: {
		counts: Vec7;
		color?: string;
		editable?: boolean;
		busy?: boolean;
		move?: RoundMove;
		capTokens?: number;
		baseline?: Vec7 | null;
		labels?: string[];
		onDelta: (priority: number, delta: number) => void | Promise<void>;
		onClear?: (priority: number) => void | Promise<void>;
	} = $props();

	const total = $derived(counts.reduce((a, b) => a + b, 0));
	const removeOnly = $derived(move === 'remove');
	const baseTotal = $derived((baseline ?? counts).reduce((a, b) => a + b, 0));
	const removed = $derived(Math.max(0, baseTotal - total));
	const remaining = $derived(Math.max(0, capTokens - total));
	const chipColor = $derived(CHIP_DENOMS[0].hex);
	const chipSize = 24;
	const rowLabels = $derived(
		PRIORITIES.map((def, i) => labels[i]?.trim() || def)
	);

	/** Unique-keyed chip slots per priority for Svelte enter/exit transitions. */
	const chipSlots = $derived(
		rowLabels.map((_, p) => {
			const n = Math.min(Math.floor((counts[p] ?? 0) / CHIP_VALUE), 8);
			return Array.from({ length: n }, (_, i) => i);
		})
	);

	// Row flash on change — prevCounts is plain so it doesn't re-trigger the effect.
	let flashRow = $state<Record<number, boolean>>({});
	let _prevCounts: Vec7 = [...ZEROS] as Vec7;
	let _flashReady = false;

	$effect(() => {
		const cur = counts;
		if (!_flashReady) {
			_flashReady = true;
			_prevCounts = [...cur] as Vec7;
			return;
		}
		const next: Record<number, boolean> = {};
		for (let p = 0; p < rowLabels.length; p++) {
			if (cur[p] !== (_prevCounts[p] ?? 0)) {
				next[p] = true;
			}
		}
		if (Object.keys(next).length > 0) {
			flashRow = next;
			setTimeout(() => (flashRow = {}), 400);
		}
		_prevCounts = [...cur] as Vec7;
	});

	function tap(p: number, d: number) {
		if (busy || !editable) return;
		if (removeOnly && d > 0) return;
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(d > 0 ? 8 : [5, 30, 5]);
			} catch {
				/* ignore */
			}
		}
		onDelta(p, d);
	}
</script>

<div class="seat-board" class:uneditable={!editable} class:remove={removeOnly} style="--seat:{color}">
	{#if total > 0}
		<div class="spend-line" aria-live="polite">
			<span class="spent-label">Spent</span>
			<span class="spent-val t-tabular" use:countUp={total}>{formatUsdFull(total)}</span>
			<span class="of">of</span>
			<span class="cap-val t-tabular">{formatUsdFull(capTokens)}</span>
			{#if remaining > 0 && !removeOnly}
				<span class="dot-sep">·</span>
				<span class="remaining t-tabular">{formatUsd(remaining)} left</span>
			{/if}
		</div>
	{/if}

	{#if removeOnly}
		<p class="remove-hint">
			Remove <b>{formatUsd(R3_REMOVE_TARGET)}</b> total. What stays is <b>protected</b>
			{#if removed > 0}
				· cut {formatUsd(removed)} so far
			{/if}
		</p>
	{/if}

	<div class="list">
		{#each rowLabels as name, p (p)}
			{@const v = counts[p] ?? 0}
			{@const base = baseline ? (baseline[p] ?? v) : v}
			{@const cut = removeOnly ? Math.max(0, base - v) : 0}
			{@const chipCount = Math.floor(v / CHIP_VALUE)}
			<div
				class="row"
				class:filled={v > 0}
				class:cut={cut > 0}
				class:protected={removeOnly && v > 0 && cut === 0}
				class:flash={flashRow[p]}
				role="group"
				aria-label="{name} priority, {v === 0 ? 'no chips placed' : formatUsdFull(v) + ' placed'}"
			>
				<div class="info">
					<div class="name">{name}</div>
					<div class="val">
						{#if v > 0}
							<span class="usd t-tabular">{formatUsdFull(v)}</span>
							{#if chipCount > 0}
								<span
									class="chips"
									role="status"
									aria-label="{chipCount} chips placed, {formatUsd(CHIP_VALUE)} each"
								>
									{#each chipSlots[p] as slot (slot)}
										<span
											class="chip-slot"
											in:scale={{ duration: 220, start: 0.35, delay: Math.min(slot, 5) * 24 }}
											out:scale={{ duration: 120, start: 0.5 }}
										>
											<Chip hex={chipColor} size={chipSize} />
										</span>
									{/each}
									{#if chipCount > 8}
										<span class="chip-over" in:scale={{ duration: 150, start: 0.5 }}
											>+{chipCount - 8}</span
										>
									{/if}
								</span>
							{/if}
							{#if removeOnly && cut > 0}
								<span class="cut-tag">−{formatUsd(cut)}</span>
							{:else if removeOnly}
								<span class="prot-tag">protected</span>
							{/if}
						{:else if removeOnly && base > 0}
							<span class="empty">Removed all</span>
						{:else}
							<span class="empty">—</span>
						{/if}
					</div>
				</div>
				{#if editable}
					<div class="acts">
						{#if v > 0}
							<button
								type="button"
								class="btn minus"
								disabled={busy || v < CHIP_VALUE}
								aria-label="Remove {formatUsd(CHIP_VALUE)} from {name}"
								onclick={() => {
									if (!busy && v >= CHIP_VALUE) tap(p, -CHIP_VALUE);
								}}
							>
								−
							</button>
						{/if}
						<button
							type="button"
							class="btn plus"
							disabled={busy || removeOnly || remaining < CHIP_VALUE}
							aria-label="Add {formatUsd(CHIP_VALUE)} to {name}"
							onclick={() => {
								if (!busy && !removeOnly && remaining >= CHIP_VALUE) tap(p, CHIP_VALUE);
							}}
						>
							+
						</button>
						{#if onClear && v > 0 && !removeOnly}
							<button
								type="button"
								class="btn clear"
								disabled={busy}
								aria-label="Clear all {formatUsd(CHIP_VALUE)} chips from {name}"
								title="Clear"
								onclick={() => {
									if (!busy) onClear(p);
								}}
							>
								✕
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.seat-board {
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 12px;
	}
	.seat-board.remove {
		border-color: color-mix(in srgb, var(--color-red) 40%, transparent);
	}
	.seat-board.uneditable {
		opacity: 0.92;
	}
	.spend-line {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 10px;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-line);
		font-size: 12px;
	}
	.spent-label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.spent-val {
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--color-gold);
		font-size: 0.95rem;
	}
	.of {
		color: var(--color-muted);
		font-size: 10px;
	}
	.cap-val {
		font-family: var(--font-mono);
		color: var(--color-muted);
		font-size: 11px;
	}
	.dot-sep {
		color: var(--color-line);
	}
	.remaining {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-teal);
		font-weight: 700;
	}
	.remove-hint {
		margin: 0 0 10px;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.35;
	}
	.remove-hint b {
		color: var(--color-teal);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-bg-elevated);
		transition:
			border-color var(--dur-fast) var(--ease-out-quart),
			box-shadow var(--dur-fast) var(--ease-out-quart),
			background-color var(--dur-fast) var(--ease-out-quart);
	}
	.row.filled {
		border-color: color-mix(in srgb, var(--seat) 40%, transparent);
	}
	.row.protected {
		border-color: color-mix(in srgb, var(--color-teal) 45%, transparent);
	}
	.row.cut {
		border-color: color-mix(in srgb, var(--color-red) 35%, transparent);
	}
	/* Flash via class + transition (rest state is seat-aware for filled rows) */
	.row.flash {
		border-color: var(--color-gold) !important;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 25%, transparent);
		background: color-mix(in srgb, var(--color-gold) 8%, var(--color-panel)) !important;
	}
	.info {
		min-width: 0;
		flex: 1;
	}
	.name {
		font-weight: 700;
		font-size: 13px;
		font-family: var(--font-display);
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.val {
		font-size: 11px;
		color: var(--color-muted);
		margin-top: 4px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.usd {
		color: var(--color-gold);
		font-weight: 700;
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.chips {
		display: flex;
		align-items: center;
		min-height: 28px;
	}
	.chip-slot {
		margin-left: -6px;
		display: inline-flex;
		filter: drop-shadow(0 2px 3px color-mix(in srgb, var(--color-ink) 18%, transparent));
	}
	.chip-slot:first-child {
		margin-left: 0;
	}

	.chip-over {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--color-muted);
		margin-left: 2px;
	}
	.empty {
		opacity: 0.4;
		font-family: var(--font-mono);
		font-size: 10px;
	}
	.cut-tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		color: var(--color-red);
	}
	.prot-tag {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-teal);
	}
	.acts {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.btn {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		font-weight: 800;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		touch-action: manipulation;
		transition: transform var(--dur-fast) var(--ease-out-quart);
	}
	.btn:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.btn:not(:disabled):active {
		transform: scale(0.92);
	}
	.btn.minus:not(:disabled) {
		border-color: color-mix(in srgb, var(--color-red) 40%, transparent);
		color: var(--color-red);
	}
	.btn.plus:not(:disabled) {
		border-color: color-mix(in srgb, var(--color-teal) 40%, transparent);
		color: var(--color-teal);
	}
	.btn.clear {
		width: auto;
		min-width: 44px;
		padding: 0 10px;
		font-size: 14px;
		line-height: 1;
	}
	@media (prefers-reduced-motion: reduce) {
		.btn:not(:disabled):active {
			transform: none;
		}
		.row.flash {
			transition: none;
		}
	}
</style>
