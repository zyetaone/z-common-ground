<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { formatUsd, roomInsights } from '$lib/game';

	/** Extra-modal verdict — SSOT via roomInsights (same lead/fault/blind as Insights). */
	let { room }: { room: RoomState } = $props();

	const i = $derived(roomInsights(room));
	const lines = $derived([
		{
			key: 'align',
			color: 'var(--color-teal)',
			tag: 'Lead',
			big: i.lead,
			desc: i.hasData ? `Room index ${i.index}/100 · ${i.verdict}` : ''
		},
		{
			key: 'fault',
			color: 'var(--color-gold)',
			tag: 'Fault line',
			big: i.fault,
			desc: i.hasData ? "The room's strongest pull outside its lead." : ''
		},
		{
			key: 'blind',
			color: 'var(--color-red)',
			tag: 'Blind spot',
			big: i.blind,
			desc: i.hasData ? `${formatUsd(i.blindTokens)} room-wide` : ''
		}
	]);
</script>

<div class="rounded-2xl border border-line bg-panel/30 p-5">
	<div class="mb-1 font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Room verdict</div>
	<div class="mb-3 text-xs text-muted">Same SSOT as Insights · Extra deep dive only</div>

	{#if !i.hasData}
		<div class="flex h-[160px] items-center justify-center text-sm text-muted">No stake yet</div>
	{:else}
		<div class="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-xs font-semibold text-gold">
			{i.verdict} · {i.index}/100 · {formatUsd(i.stake)}
		</div>
		<div class="space-y-4">
			{#each lines as line (line.key)}
				<div class="border-l-4 pl-3.5" style="border-color: {line.color}">
					<div class="font-mono text-[10px] uppercase tracking-widest text-muted">{line.tag}</div>
					<div class="my-0.5 font-display text-xl font-bold" style="color: {line.color}">{line.big}</div>
					<div class="text-xs text-muted leading-relaxed">{line.desc}</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
