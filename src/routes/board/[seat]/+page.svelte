<script lang="ts">
	import { page } from '$app/state';
	import BoardSheet from '$lib/components/BoardSheet.svelte';
	import { tablePersona } from '$lib/game';
	import { session } from '$lib/state';

	const seat = $derived(Math.min(6, Math.max(0, Number(page.params.seat) || 0)));
	const roomCode = $derived((page.url.searchParams.get('room') || 'LIVE').toUpperCase());
	const tableId = $derived(Number(page.url.searchParams.get('table')) || seat + 1);
	const name = $derived(tablePersona(tableId, session.room).name);

	function print() {
		window.print();
	}
</script>

<svelte:head>
	<title>{name} · Common Ground Board</title>
	<style>
		@page { size: landscape; margin: 0; }
	</style>
</svelte:head>

<div class="no-print bar">
	<b>YOUR BETTING BOARD</b>
	<a href="/boards/all" class="btn">← All boards</a>
	<button onclick={print} class="btn print-btn">Print ▸</button>
</div>

<div class="stage">
	<BoardSheet {seat} {roomCode} {tableId} room={session.room} />
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		background: var(--color-felt-deep);
		color: var(--color-felt-ink);
		font-family: var(--font-display);
		flex-wrap: wrap;
	}
	.bar b {
		letter-spacing: 0.2em;
		font-size: 12px;
	}
	.btn {
		font-size: 12px;
		background: var(--color-felt);
		color: var(--color-felt-ink);
		border: 1px solid color-mix(in srgb, var(--color-felt-ink) 22%, transparent);
		padding: 8px 12px;
		border-radius: 8px;
		text-decoration: none;
	}
	.print-btn {
		background: var(--color-gold);
		color: var(--color-on-gold);
		border-color: var(--color-gold);
		font-weight: 700;
	}
	.stage {
		padding: 22px;
		background: var(--color-felt);
		min-height: 100vh;
	}
	@media print {
		.no-print {
			display: none;
		}
		.stage {
			padding: 0;
			background: #fff;
		}
	}
</style>
