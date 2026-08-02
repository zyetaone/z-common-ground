<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';

	/**
	 * Centered wait / join / freeze chrome for the phone play page.
	 * Presentational only — parent owns phase logic.
	 */
	let {
		joined = false,
		sealed = false,
		icon = undefined,
		heading = '',
		sub = '',
		text = '',
		showDot = false,
		actionLabel = '',
		actionBusy = false,
		onaction,
		children
	}: {
		joined?: boolean;
		/** Stretch full width for MobileSealed etc. */
		sealed?: boolean;
		icon?: IconName;
		heading?: string;
		sub?: string;
		/** Single line (connecting / waiting) when no heading */
		text?: string;
		showDot?: boolean;
		actionLabel?: string;
		actionBusy?: boolean;
		onaction?: () => void | Promise<void>;
		children?: Snippet;
	} = $props();
</script>

<div class="wait-stage" class:sealed-stage={sealed}>
	{#if children}
		{@render children()}
	{:else}
		<div class="wait-msg" class:joined>
			{#if showDot}
				<span class="wait-dot"></span>
			{/if}
			{#if icon}
				<span class="wait-icon"><Icon name={icon} size={28} /></span>
			{/if}
			{#if heading}
				<p class="wait-heading">{heading}</p>
			{/if}
			{#if sub}
				<p class="wait-sub">{sub}</p>
			{/if}
			{#if text}
				<p class="wait-text">{text}</p>
			{/if}
		</div>
		{#if actionLabel && onaction}
			<button type="button" class="join-btn" disabled={actionBusy} onclick={() => onaction?.()}>
				{actionLabel}
			</button>
		{/if}
	{/if}
</div>

<style>
	.wait-stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px 16px 40px;
		gap: 16px;
		text-align: center;
	}
	.sealed-stage {
		align-items: stretch;
	}
	.sealed-stage :global(.sealed) {
		margin: 0;
		width: 100%;
	}
	.wait-msg {
		width: 100%;
		max-width: 360px;
		margin: 0;
		padding: 28px 20px;
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		text-align: center;
	}
	.wait-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--color-gold);
		animation: pulse 1.4s ease infinite;
		flex-shrink: 0;
	}
	.wait-icon {
		font-size: 28px;
		line-height: 1;
		flex-shrink: 0;
		display: flex;
	}
	.wait-heading {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.15rem;
		margin: 0;
	}
	.wait-sub {
		margin: 0;
		font-size: 14px;
		color: var(--color-muted);
		line-height: 1.45;
		max-width: 28ch;
	}
	.wait-text {
		font-size: 14px;
		color: var(--color-muted);
		margin: 0;
	}
	.join-btn {
		display: block;
		width: 100%;
		max-width: 360px;
		margin: 0;
		padding: 16px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--color-teal);
		color: var(--color-on-teal);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.1rem;
		cursor: pointer;
		touch-action: manipulation;
	}
	.join-btn:disabled {
		opacity: 0.4;
	}
	.wait-msg.joined {
		border-color: color-mix(in srgb, var(--color-teal) 45%, var(--color-line));
		background: color-mix(in srgb, var(--color-teal) 6%, var(--color-panel));
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}
</style>
