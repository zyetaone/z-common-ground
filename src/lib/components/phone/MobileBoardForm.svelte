<script lang="ts">
	import FunctionBoard from './FunctionBoard.svelte';
	import { CHIP_VALUE, formatUsd, formatUsdFull } from '$lib/game';
	import type { RoundMove, SealTarget, Vec7 } from '$lib/game/types';

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
		sealKind = undefined,
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
		labels,
		onDelta,
		onClear,
		onSubmit
	}: {
		counts: Vec7;
		color: string;
		editable?: boolean;
		busy?: boolean;
		move?: RoundMove;
		capTokens: number;
		baseline?: Vec7 | null;
		roundLabel: number;
		/** Which budget rule this round enforces — drives the hint and the seal copy. */
		sealKind?: SealTarget['kind'];
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
		labels?: string[];
		onDelta: (priority: number, delta: number) => void | Promise<void>;
		onClear?: (priority: number) => void | Promise<void>;
		onSubmit: (e: Event) => void | Promise<void>;
	} = $props();
</script>

<form class="board-form" onsubmit={onSubmit}>
	<header class="lede">
		<h2 class="lede-q">What does your board reflect?</h2>
		<p class="lede-sub">Mirror the chips your table just placed.</p>
	</header>

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
		<div class="foot">
			{#if sealKind === 'full'}
				<p class="hint-cap req" class:met={r2Ready}>
					{r2Ready
						? `Full ${formatUsdFull(r2Target)} wallet ready`
						: `Needs the full ${formatUsdFull(r2Target)} wallet`}
				</p>
			{:else if sealKind === 'remove'}
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
						: sealKind === 'cap'
							? `Final seal · ${formatUsdFull(totalTokens)} / ${formatUsdFull(tableCap)}`
							: `Lock in R${roundLabel} · ${formatUsdFull(totalTokens)}`}
			</button>
			{#if submitError}
				<p class="cg-error">{submitError}</p>
			{/if}
		</div>
	{/if}
</form>

<style>
	/* The step's own question. The freeze screen owns the physical round; this
	   screen owns transcribing it, and until now it opened straight onto a grid
	   with no statement of what the player was being asked to do. */
	.lede {
		padding: 0 2px 2px;
	}
	.lede-q {
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 700;
		line-height: 1.2;
		color: var(--color-ink);
	}
	.lede-sub {
		margin-top: 2px;
		font-size: 12px;
		color: var(--color-muted);
	}
	.board-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 12px 0;
	}
	.foot {
		position: sticky;
		bottom: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
		background: linear-gradient(to bottom, transparent, var(--color-bg) 24px);
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
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
		touch-action: manipulation;
	}
	.submit:disabled {
		opacity: 0.4;
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
