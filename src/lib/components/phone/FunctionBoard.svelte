<script lang="ts">
	import { scale } from 'svelte/transition';
	import { CHIP_DENOMS, CHIP_VALUE, PRIORITIES, formatUsd, formatUsdFull } from '$lib/game';
	import type { RoundMove, Vec7 } from '$lib/game/types';
	import Chip from '$lib/components/Chip.svelte';

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
		onDelta: (priority: number, delta: number) => void | Promise<void>;
		onClear?: (priority: number) => void | Promise<void>;
	} = $props();

	const total = $derived(counts.reduce((a, b) => a + b, 0));
	const removeOnly = $derived(move === 'remove');
	const baseTotal = $derived((baseline ?? counts).reduce((a, b) => a + b, 0));
	const removed = $derived(Math.max(0, baseTotal - total));
	const remaining = $derived(Math.max(0, capTokens - total));
	const chipColor = $derived(CHIP_DENOMS[0].hex);

	// ── Chip pile animation ──
	/** Unique-keyed chip slots per priority for Svelte enter/exit transitions. */
	const chipSlots = $derived(
		PRIORITIES.map((_, p) => {
			const n = Math.min(Math.floor((counts[p] ?? 0) / CHIP_VALUE), 8);
			return Array.from({ length: n }, (_, i) => i);
		})
	);

	// ── Row flash on change ──
	let flashRow = $state<Record<number, boolean>>({});
	let prevCounts = $state<Vec7>([...ZEROS] as Vec7);
	let flashReady = false;

	$effect(() => {
		if (!flashReady) {
			// First render — sync baseline, no flash
			prevCounts = [...counts] as Vec7;
			flashReady = true;
			return;
		}
		const next: Record<number, boolean> = {};
		for (let p = 0; p < PRIORITIES.length; p++) {
			if (counts[p] !== (prevCounts[p] ?? 0)) {
				next[p] = true;
			}
		}
		if (Object.keys(next).length > 0) {
			flashRow = next;
			setTimeout(() => (flashRow = {}), 400);
		}
		prevCounts = [...counts] as Vec7;
	});

	function tap(p: number, d: number) {
		if (busy || !editable) return;
		if (removeOnly && d > 0) return;
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(10);
			} catch {
				/* ignore */
			}
		}
		onDelta(p, d);
	}
</script>

<div class="seat-board" class:uneditable={!editable} class:remove={removeOnly} style="--seat:{color}">
	<!-- Minimal spent / remaining -->
	<div class="spend-line">
		<span class="spent-label">Spent</span>
		<span class="spent-val">{formatUsdFull(total)}</span>
		<span class="of">of</span>
		<span class="cap-val">{formatUsdFull(capTokens)}</span>
		{#if remaining > 0 && !removeOnly}
			<span class="dot-sep">·</span>
			<span class="remaining">{formatUsd(remaining)} left</span>
		{/if}
	</div>

	{#if removeOnly}
		<p class="remove-hint">
			Remove <b>${CHIP_VALUE}M</b> chips. What stays is <b>protected</b>
			{#if removed > 0}
				· cut {formatUsd(removed)}
			{/if}
		</p>
	{/if}

	<div class="list">
		{#each PRIORITIES as name, p (name)}
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
			>
				<div class="info">
					<div class="name">{name}</div>
					<div class="val">
						{#if v > 0}
							<span class="usd">{formatUsdFull(v)}</span>
							<!-- Visual chip tokens — animated pile -->
							{#if chipCount > 0}
								<span class="chips">
									{#each chipSlots[p] as slot (slot)}
										<span
											class="chip-slot"
											in:scale={{ duration: 180, start: 0.35 }}
											out:scale={{ duration: 120, start: 0.35 }}
										>
											<Chip hex={chipColor} size={16} />
										</span>
									{/each}
									{#if chipCount > 8}
										<span class="chip-over" in:scale={{ duration: 150, start: 0.5 }}>+{chipCount - 8}</span>
									{/if}
								</span>
							{/if}
							{#if removeOnly && cut > 0}
								<span class="cut-tag">-{formatUsd(cut)}</span>
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
						<button
							type="button"
							class="btn minus"
							disabled={busy || v < CHIP_VALUE}
							aria-label="Remove ${CHIP_VALUE}M from {name}"
							onpointerup={(e) => {
								e.preventDefault();
								if (!busy && v >= CHIP_VALUE) tap(p, -CHIP_VALUE);
							}}
						>
							-
						</button>
						<button
							type="button"
							class="btn plus"
							disabled={busy || removeOnly || remaining < CHIP_VALUE}
							aria-label="Add ${CHIP_VALUE}M to {name}"
							onpointerup={(e) => {
								e.preventDefault();
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
								onpointerup={(e) => {
									e.preventDefault();
									if (!busy) onClear(p);
								}}
							>
								Clr
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
	/* ── Spent / remaining line ── */
	.spend-line {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 10px;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.22);
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
	/* ── Remove hint ── */
	.remove-hint {
		margin: 0 0 10px;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.35;
	}
	.remove-hint b {
		color: var(--color-teal);
	}
	/* ── Priority rows ── */
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
		background: rgba(0, 0, 0, 0.18);
		transition: border-color 0.15s, box-shadow 0.15s;
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
	/* ── Chip-flash animation ── */
	.row.flash {
		animation: chip-flash 0.4s ease-out;
	}
	@keyframes chip-flash {
		0% {
			border-color: var(--color-gold);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-gold) 25%, transparent);
			background: color-mix(in srgb, var(--color-gold) 8%, transparent);
		}
		100% {
			border-color: inherit;
			box-shadow: none;
			background: rgba(0, 0, 0, 0.18);
		}
	}
	.info {
		min-width: 0;
		flex: 1;
	}
	.name {
		font-weight: 700;
		font-size: 13px;
		font-family: var(--font-display);
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
	/* ── Chip pile ── */
	.chips {
		display: flex;
		align-items: center;
	}
	.chip-slot {
		margin-left: -5px;
		display: inline-flex;
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
	/* ── Buttons ── */
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
		font-size: 16px;
		cursor: pointer;
		padding: 0;
		touch-action: manipulation;
		transition: transform 0.1s ease;
	}
	.btn:disabled {
		opacity: 0.3;
	}
	.btn:not(:disabled):active {
		transform: scale(0.88);
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
		font-size: 10px;
		font-family: var(--font-mono);
	}
</style>
