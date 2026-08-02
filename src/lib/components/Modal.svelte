<script lang="ts">
	import type { Snippet } from 'svelte';

	// Native <dialog>: focus-trap, Escape, inert background, top-layer stacking.
	let {
		open = $bindable(false),
		label = 'Dialog',
		class: klass = '',
		onclose,
		children
	}: {
		open?: boolean;
		label?: string;
		class?: string;
		onclose?: () => void;
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
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(10px);
		animation: backdrop-in var(--dur-base, 280ms) ease both;
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
