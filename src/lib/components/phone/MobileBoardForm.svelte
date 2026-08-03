<script lang="ts">
	import FunctionBoard from './FunctionBoard.svelte';
	import { CHIP_VALUE, formatUsd, formatUsdFull } from '$lib/game';
	import type { RoundMove, Vec7 } from '$lib/game/types';

	/**
	 * Presentational board + submit chrome.
	 * Parent owns draft state, reseed, and session mutations.
	 */
	let {
		counts,
		color,
		editable = true,
		busy = false,
		move = 'add',
		capTokens,
		baseline = null,
		roundLabel,
		removeOnly = false,
		r2Ready = true,
		r3Ready = true,
		r2Target = 0,
		removeTarget = 0,
		overCap = false,
		totalTokens = 0,
		removedTokens = 0,
		tableCap,
		baseWallet,
		submitError = '',
		canCapture = true,
		labels,
		onDelta,
		onClear,
		onSubmit,
		onSave
	}: {
		counts: Vec7;
		color: string;
		editable?: boolean;
		busy?: boolean;
		move?: RoundMove;
		capTokens: number;
		baseline?: Vec7 | null;
		roundLabel: number;
		removeOnly?: boolean;
		r2Ready?: boolean;
		r3Ready?: boolean;
		/** R2 seal target in tokens — the full per-table wallet. */
		r2Target?: number;
		/** R3 seal target in tokens — 30% of the standing total. */
		removeTarget?: number;
		overCap?: boolean;
		totalTokens?: number;
		removedTokens?: number;
		tableCap: number;
		baseWallet: number;
		submitError?: string;
		canCapture?: boolean;
		labels?: string[];
		onDelta: (priority: number, delta: number) => void | Promise<void>;
		onClear?: (priority: number) => void | Promise<void>;
		onSubmit: (e: Event) => void | Promise<void>;
		onSave: () => void | Promise<void>;
	} = $props();
</script>

<form class="board-form" onsubmit={onSubmit}>
	<FunctionBoard
		{counts}
		{color}
		{editable}
		{busy}
		{move}
		{capTokens}
		{baseline}
		{labels}
		{onDelta}
		{onClear}
	/>

	{#if editable}
		{#if canCapture}
			{#if roundLabel === 2}
				<p class="hint-cap req" class:met={r2Ready}>
					{r2Ready
						? `Full ${formatUsdFull(r2Target)} wallet ready`
						: `Needs the full ${formatUsdFull(r2Target)} wallet`}
				</p>
			{:else if roundLabel === 3 && removeOnly}
				<p class="hint-cap req" class:met={r3Ready}>
					{r3Ready
						? `${formatUsdFull(removeTarget)} removed — target met`
						: `Needs ${formatUsdFull(Math.max(0, removeTarget - removedTokens))} more removed`}
				</p>
			{/if}
			<button
				type="submit"
				class="submit"
				disabled={busy || overCap || !r2Ready || !r3Ready || (!removeOnly && totalTokens <= 0)}
			>
				{busy
					? 'Locking in…'
					: removeOnly
						? `Lock in R${roundLabel} · ${formatUsdFull(totalTokens)}`
						: roundLabel === 5
							? `Final seal · ${formatUsdFull(totalTokens)} / ${formatUsdFull(tableCap)}`
							: `Lock in R${roundLabel} · ${formatUsdFull(totalTokens)}`}
			</button>
			{#if submitError}
				<p class="cg-error">{submitError}</p>
			{/if}
		{:else}
			<button
				type="button"
				class="submit save"
				disabled={busy || totalTokens <= 0 || overCap}
				onclick={() => onSave()}
			>
				{busy ? 'Saving…' : `Save & continue · ${formatUsdFull(totalTokens)}`}
			</button>
			{#if totalTokens <= 0}
				<p class="hint-cap">Place {formatUsd(CHIP_VALUE)} tokens on the board first.</p>
			{/if}
		{/if}
	{/if}
</form>

<style>
	.board-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 12px 0;
	}
	.submit {
		border: none;
		border-radius: var(--radius-sm);
		padding: 16px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		background: var(--color-teal);
		color: var(--color-on-teal);
		cursor: pointer;
		position: sticky;
		bottom: calc(8px + env(safe-area-inset-bottom));
		z-index: 10;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
		touch-action: manipulation;
	}
	.submit:disabled {
		opacity: 0.4;
		box-shadow: none;
	}
	.submit.save {
		background: color-mix(in srgb, var(--color-bg) 92%, transparent);
		backdrop-filter: blur(6px);
		border: 1px solid var(--color-gold);
		color: var(--color-gold-ink);
		box-shadow: none;
	}
	.hint-cap {
		margin: 0;
		text-align: center;
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.35;
	}
	.hint-cap.req {
		color: var(--color-danger);
		font-weight: 600;
	}
	.hint-cap.req.met {
		color: var(--color-muted);
		font-weight: 500;
	}
</style>
