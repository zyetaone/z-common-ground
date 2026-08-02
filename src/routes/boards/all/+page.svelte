<script lang="ts">
	import { page } from '$app/state';
	import BoardSheet from '$lib/components/BoardSheet.svelte';
	import { roomPersonas } from '$lib/game';
	import { session } from '$lib/state';

	const roomCode = (page.url.searchParams.get('room') || 'LIVE').toUpperCase();
	const personas = $derived(roomPersonas(session.room));

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
	{#each personas as p, s (s)}
		<section class="board-card">
			<div class="caption">Table {s + 1} · {p.name}</div>
			<BoardSheet seat={s} {roomCode} tableId={s + 1} room={session.room} />
		</section>
	{/each}
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
	.boards {
		display: grid;
		gap: 20px;
		padding: 22px;
		background: var(--color-felt);
	}
	.board-card {
		background: var(--color-felt-deep);
		border: 1px solid color-mix(in srgb, var(--color-felt-ink) 22%, transparent);
		border-radius: 8px;
		overflow: hidden;
	}
	.caption {
		padding: 10px 14px;
		font-size: 12px;
		color: var(--color-felt-muted);
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
