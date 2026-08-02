<script lang="ts">
	import { roomPriorities, tablePersona, type RoomState } from '$lib/game';
	import QrCode from './QrCode.svelte';

	let {
		seat,
		roomCode = 'LIVE',
		tableId = 1,
		origin = '',
		/** When set, host persona + priority overrides paint the sheet. */
		room = null
	}: {
		seat: number;
		roomCode?: string;
		tableId?: number;
		origin?: string;
		room?: RoomState | null;
	} = $props();

	const persona = $derived(tablePersona(tableId || seat + 1, room));
	const seatName = $derived(persona.name);
	const seatColor = $derived(persona.color);
	const lens = $derived(persona.lens);
	const mission = $derived(persona.mission);
	const hashtag = $derived(persona.hashtag ?? '');
	const priorityLabels = $derived(roomPriorities(room));
	/** Split a priority label for the column header; a lone '/' merges into the previous word. */
	function wordsOf(label: string): string[] {
		const out: string[] = [];
		for (const w of label.split(' ')) {
			if (w === '/' && out.length) out[out.length - 1] += ' /';
			else out.push(w);
		}
		return out;
	}
	/** QR lands on this function table (no selection). */
	const joinUrl = $derived(
		`${origin || (typeof window !== 'undefined' ? window.location.origin : '')}/play/${roomCode}/${tableId}`
	);
</script>

<svg viewBox="0 0 1600 1000" xmlns="http://www.w3.org/2000/svg" class="board-sheet">
	<rect width="1600" height="1000" style="fill:var(--color-felt)" />
	<rect x="0" y="0" width="460" height="1000" style="fill:var(--color-felt-deep)" opacity="0.6" />
	<rect x="46" y="104" width="10" height="250" rx="5" fill={seatColor} />
	<text x="80" y="150" font-size="13" letter-spacing="5" style="fill:var(--color-felt-muted)">YOUR SEAT</text>
	<text x="78" y="206" font-size="46" font-family="Georgia,serif" style="fill:var(--color-felt-ink)" textLength="420" lengthAdjust="spacingAndGlyphs">{seatName}</text>
	<text x="80" y="238" font-size="16" style="fill:var(--color-felt-muted)" textLength="420" lengthAdjust="spacingAndGlyphs">{lens}</text>

	<text x="80" y="280" font-size="12.5" letter-spacing="3" style="fill:var(--color-gold)">YOUR MISSION</text>
	<foreignObject x="80" y="296" width="320" height="84">
		<div style="font-size:16.5px;color:var(--color-felt-ink);line-height:1.3;font-family:Helvetica,Arial,sans-serif">{mission}</div>
	</foreignObject>

	{#if hashtag}
		<text x="80" y="394" font-size="14" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" style="fill:var(--color-gold)" letter-spacing="2">{hashtag}</text>
	{/if}

	<g transform="translate(520, 0)">
		{#each priorityLabels as p, i (i)}
			{@const x = i * 140}
			<rect x={x + 4} y="150" width="130" height="730" rx="10" style="fill:var(--color-felt-deep);stroke:var(--color-gold)" stroke-width="1.5" />
			{#each wordsOf(p) as word, k (k)}
				<text x={x + 69} y={180 + k * 18} font-size="14" style="fill:var(--color-felt-ink)" text-anchor="middle" font-weight="bold">
					{word}
				</text>
			{/each}
			<circle cx={x + 69} cy="834" r="27" fill="none" style="stroke:var(--color-felt-muted)" stroke-dasharray="2 6" opacity="0.5" />
		{/each}
	</g>

	<text x="1554" y="935" font-size="15" font-family="Georgia,serif" style="fill:var(--color-gold)" text-anchor="end">
		1 token = $10,000,000
	</text>

	<foreignObject x="80" y="520" width="160" height="200">
		<div style="background:var(--color-bg);border-radius:8px;padding:8px;text-align:center">
			{#if joinUrl.length > 8}
				<QrCode text={joinUrl} size={120} />
			{/if}
			<div style="font-size:10px;color:var(--color-felt-deep);letter-spacing:1px;margin-top:4px">SCAN · TABLE {tableId} · {seatName}</div>
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
