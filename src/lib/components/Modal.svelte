<script lang="ts">
	import type { Snippet } from 'svelte';

	// One modal primitive built on native <dialog>: focus-trap, Escape, inert
	// background and top-layer stacking come free from showModal(). Replaces the
	// hand-rolled fixed-overlay modals.
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

	// Native close (Escape / backdrop / .close()) → sync state back.
	function onClose() {
		open = false;
		onclose?.();
	}
	// Click on the backdrop (the dialog element itself, outside .panel) closes.
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
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(10px);
	}
	.panel {
		max-height: inherit;
		overflow: auto;
	}
</style>
