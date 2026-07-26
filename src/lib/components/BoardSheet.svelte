<script lang="ts">
	import { PRIORITIES, SEAT_COLORS, SEAT_LENS, SEAT_MISSIONS, SEATS } from '$lib/game';
	import QrCode from './QrCode.svelte';

	let {
		seat,
		roomCode = 'LIVE',
		tableId = 1,
		origin = ''
	}: { seat: number; roomCode?: string; tableId?: number; origin?: string } = $props();

	const seatName = $derived(SEATS[seat]);
	const seatColor = $derived(SEAT_COLORS[seat]);
	const lens = $derived(SEAT_LENS[seat]);
	const mission = $derived(SEAT_MISSIONS[seat]);
	/** QR lands on this function table (no selection). */
	const joinUrl = $derived(
		`${origin || (typeof window !== 'undefined' ? window.location.origin : '')}/play/${roomCode}/${tableId}`
	);
</script>

<svg viewBox="0 0 1600 1000" xmlns="http://www.w3.org/2000/svg" class="board-sheet">
	<rect width="1600" height="1000" fill="#0E6B41" />
	<rect x="0" y="0" width="460" height="1000" fill="#0A5735" opacity="0.6" />
	<rect x="46" y="104" width="10" height="250" rx="5" fill={seatColor} />
	<text x="80" y="150" font-size="13" letter-spacing="5" fill="#BFD8C7">YOUR SEAT</text>
	<text x="78" y="206" font-size="46" font-family="Georgia,serif" fill="#F3ECD8">{seatName}</text>
	<text x="80" y="238" font-size="16" fill="#BFD8C7">{lens}</text>

	<text x="80" y="280" font-size="12.5" letter-spacing="3" fill="#D9B44A">YOUR MISSION</text>
	<foreignObject x="80" y="296" width="320" height="60">
		<div style="font-size:16.5px;color:#F3ECD8;line-height:1.3;font-family:Helvetica,Arial,sans-serif">{mission}</div>
	</foreignObject>

	<g transform="translate(520, 0)">
		{#each PRIORITIES as p, i (p)}
			{@const x = i * 140}
			<rect x={x + 4} y="150" width="130" height="730" rx="10" fill="#0A5735" stroke="#D9B44A" stroke-width="1.5" />
			{#each p.split(' ') as word, k (k)}
				<text x={x + 69} y={180 + k * 18} font-size="14" fill="#F3ECD8" text-anchor="middle" font-weight="bold">
					{word}
				</text>
			{/each}
			<circle cx={x + 69} cy="834" r="27" fill="none" stroke="#BFD8C7" stroke-dasharray="2 6" opacity="0.5" />
		{/each}
	</g>

	<text x="1554" y="935" font-size="15" font-family="Georgia,serif" fill="#D9B44A" text-anchor="end">
		1 token = $10,000,000
	</text>

	<foreignObject x="80" y="520" width="160" height="200">
		<div style="background:#F7F3EA;border-radius:8px;padding:8px;text-align:center">
			{#if joinUrl.length > 8}
				<QrCode text={joinUrl} size={120} />
			{/if}
			<div style="font-size:10px;color:#1F3A5F;letter-spacing:1px;margin-top:4px">SCAN · TABLE {tableId} · {seatName}</div>
		</div>
	</foreignObject>
</svg>

<style>
	.board-sheet {
		width: 100%;
		height: auto;
		display: block;
	}
</style>
