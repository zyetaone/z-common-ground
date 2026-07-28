<script lang="ts">
	import { page } from '$app/state';
	import BoardSheet from '$lib/components/BoardSheet.svelte';
	import { N_SEATS, SEATS } from '$lib/game';

	const roomCode = (page.url.searchParams.get('room') || 'LIVE').toUpperCase();

	function print() {
		window.print();
	}
</script>

<svelte:head>
	<title>All Boards · Common Ground</title>
	<style>
		@page { size: landscape; margin: 0; }
	</style>
</svelte:head>

<div class="no-print bar">
	<b>ALL SEVEN FUNCTION BOARDS · ONE TABLE = ONE FUNCTION</b>
	<button onclick={print} class="btn print-btn">Print all ▸</button>
	<a href="/" class="btn">← Home</a>
</div>

<div class="boards">
	{#each Array(N_SEATS) as _, s (s)}
		<section class="board-card">
			<div class="caption">Table {s + 1} · {SEATS[s]}</div>
			<BoardSheet seat={s} {roomCode} tableId={s + 1} />
		</section>
	{/each}
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
	.boards {
		display: grid;
		gap: 20px;
		padding: 22px;
		background: #0E543A;
	}
	.board-card {
		background: #0A3D2B;
		border: 1px solid #1A6B4A;
		border-radius: 8px;
		overflow: hidden;
	}
	.caption {
		padding: 10px 14px;
		font-size: 12px;
		color: #9aa2ad;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	@media print {
		.no-print {
			display: none;
		}
		.boards {
			padding: 0;
			gap: 0;
			background: #fff;
		}
		.board-card {
			break-inside: avoid;
			break-after: page;
			border: none;
		}
		.board-card:last-child {
			break-after: auto;
		}
		.caption {
			display: none;
		}
	}
</style>
