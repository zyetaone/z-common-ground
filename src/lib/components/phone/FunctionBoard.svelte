<script lang="ts">
	import { CHIP_DENOMS, PRIORITIES, formatUsd, formatUsdFull, tableWalletLabel } from '$lib/game';
	import type { RoundMove, Vec7 } from '$lib/game/types';
	import Chip from '$lib/components/Chip.svelte';

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

	// Active chip denomination — tap the tray to pick which chip you're placing.
	let activeIdx = $state(0);
	const activeValue = $derived(CHIP_DENOMS[activeIdx].value);
	const canAddActive = $derived(total + activeValue <= capTokens);

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
	<div class="meta">
		<span class="pill">
			{#if removeOnly}
				R3 REMOVE · holding {formatUsd(total)}
			{:else}
				{tableWalletLabel(capTokens)}
			{/if}
		</span>
		<span class="total">{formatUsdFull(total)}</span>
	</div>

	{#if editable}
		<div class="tray" role="group" aria-label="Pick a chip to place">
			{#each CHIP_DENOMS as c, i (c.color)}
				<button
					type="button"
					class="chip-btn"
					class:active={activeIdx === i}
					aria-pressed={activeIdx === i}
					aria-label="${c.value} million chip"
					onclick={() => (activeIdx = i)}
				>
					<Chip hex={c.hex} value={c.value} size={32} />
					<span>${c.value}M</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if removeOnly}
		<p class="remove-hint">
			Take off the <b>{activeValue === 10 ? 'red' : activeValue === 5 ? 'blue' : 'green'}</b> chips you're removing. What stays is
			<b>protected</b>
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
			<div
				class="row"
				class:filled={v > 0}
				class:cut={cut > 0}
				class:protected={removeOnly && v > 0 && cut === 0}
			>
				<div class="info">
					<div class="name">{name}</div>
					<div class="val">
						{#if v > 0}
							<span class="usd">{formatUsd(v)}</span>
							{#if removeOnly && cut > 0}
								<span class="cut-tag">−{formatUsd(cut)}</span>
							{:else if removeOnly}
								<span class="prot-tag">protected</span>
							{/if}
						{:else if removeOnly && base > 0}
							<span class="empty">Removed all</span>
						{:else}
							<span class="empty">Empty</span>
						{/if}
					</div>
				</div>
				{#if editable}
					<div class="acts">
						<button
							type="button"
							class="btn minus"
							disabled={busy || v < activeValue}
							aria-label="Remove ${activeValue}M chip from {name}"
							onpointerup={(e) => {
								e.preventDefault();
								if (!busy && v >= activeValue) tap(p, -activeValue);
							}}
						>
							−
						</button>
						<button
							type="button"
							class="btn plus"
							disabled={busy || removeOnly || !canAddActive}
							aria-label="Add ${activeValue}M chip to {name}"
							onpointerup={(e) => {
								e.preventDefault();
								if (!busy && !removeOnly && canAddActive) tap(p, activeValue);
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
		background: rgba(13, 21, 38, 0.5);
		padding: 12px;
	}
	.seat-board.remove {
		border-color: color-mix(in srgb, var(--color-red) 40%, transparent);
	}
	.seat-board.uneditable {
		opacity: 0.92;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 10px;
	}
	.pill {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}
	.total {
		font-family: var(--font-display);
		font-weight: 800;
		color: var(--color-gold);
		font-size: 0.95rem;
	}
	.tray {
		display: flex;
		gap: 8px;
		margin-bottom: 10px;
	}
	.chip-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 44px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.2);
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 12px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.chip-btn.active {
		border-color: var(--color-gold);
		background: color-mix(in srgb, var(--color-gold) 12%, rgba(0, 0, 0, 0.2));
		color: var(--color-ink);
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
		padding: 8px 10px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.18);
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
		margin-top: 2px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.usd {
		color: var(--color-gold);
		font-weight: 700;
		font-family: var(--font-mono);
		font-size: 13px;
	}
	.empty {
		opacity: 0.65;
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
		font-size: 16px;
		cursor: pointer;
		padding: 0;
		touch-action: manipulation;
	}
	.btn:disabled {
		opacity: 0.3;
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
