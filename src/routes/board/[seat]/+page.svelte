<script lang="ts">
	import { page } from '$app/state';
	import BoardSheet from '$lib/components/BoardSheet.svelte';
	import { SEATS } from '$lib/game';

	const seat = Math.min(6, Math.max(0, Number(page.params.seat) || 0));
	const name = SEATS[seat];
	const roomCode = (page.url.searchParams.get('room') || 'LIVE').toUpperCase();
	const tableId = Number(page.url.searchParams.get('table')) || 1;

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
	<BoardSheet {seat} {roomCode} {tableId} />
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 20px;
		background: #0A3D2B;
		color: #F3ECD8;
		font-family: Helvetica, Arial, sans-serif;
		flex-wrap: wrap;
	}
	.bar b {
		letter-spacing: 0.2em;
		font-size: 12px;
	}
	.btn {
		font-size: 12px;
		background: #0E543A;
		color: #F3ECD8;
		border: 1px solid #1A6B4A;
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
		background: #0E543A;
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
