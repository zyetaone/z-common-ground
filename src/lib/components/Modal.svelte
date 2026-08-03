<script lang="ts">
	import type { Snippet } from 'svelte';

	// Native <dialog>: focus-trap, Escape, inert background, top-layer stacking.
	let {
		open = $bindable(false),
		label,
		class: klass = '',
		onclose,
		header,
		children
	}: {
		open?: boolean;
		/** Accessible name for the dialog — required, no generic default. */
		label: string;
		class?: string;
		onclose?: () => void;
		/** Custom header; when supplied it must provide its own close affordance
		 *  (the default ✕ close button is skipped). */
		header?: Snippet;
		children?: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function onClose() {
		open = false;
		onclose?.();
	}
	function onClick(e: MouseEvent) {
		if (e.target === dialog) open = false;
	}
</script>

<dialog bind:this={dialog} onclose={onClose} onclick={onClick} aria-label={label}>
	{#if header}
		{@render header()}
	{:else}
		<button type="button" class="close" aria-label="Close" onclick={() => dialog?.close()}>✕</button>
	{/if}
	<div class="panel {klass}">
		{@render children?.()}
	</div>
</dialog>

<style>
	dialog {
		margin: auto;
		max-width: min(100vw - 32px, 1100px);
		max-height: min(100dvh - 32px, 960px);
		padding: 0;
		border: none;
		background: transparent;
		color: var(--color-ink);
		overflow: visible;
	}
	dialog[open] {
		animation: dialog-in var(--dur-base, 280ms) var(--ease-out-quart, cubic-bezier(0.22, 1, 0.36, 1))
			both;
	}
	dialog::backdrop {
		background: color-mix(in srgb, var(--color-ink) 55%, transparent);
		backdrop-filter: blur(6px);
		animation: backdrop-in var(--dur-base, 280ms) ease both;
	}
	/* Default close — 44×44 hit area, absolute top-right of the dialog.
	   Suppressed when the caller passes a `header` snippet with its own close. */
	.close {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 2;
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		color: var(--color-muted);
		font-size: 16px;
		line-height: 1;
		display: grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
	}
	.close:hover {
		color: var(--color-ink);
		border-color: var(--color-border-strong);
	}
	.panel {
		max-height: inherit;
		overflow: auto;
	}
	@keyframes dialog-in {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		dialog[open],
		dialog::backdrop {
			animation: none;
		}
	}
</style>
