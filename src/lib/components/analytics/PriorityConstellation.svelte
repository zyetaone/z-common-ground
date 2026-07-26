<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { N_PRIORITIES } from '$lib/game/types';
	import { PERSONAS, PRIORITIES, roomPortrait, sum } from '$lib/game';

	let { room }: { room: RoomState } = $props();

	const short = (p: string) =>
		p.replace('Employee ', 'Emp. ').replace('Employer ', 'Emp. ').replace(' Readiness', '');

	const model = $derived.by(() => {
		const seatCoins = roomPortrait(room.tables);
		const totals = Array.from({ length: N_PRIORITIES }, (_, i) =>
			seatCoins.reduce((acc, row) => acc + (row[i] ?? 0), 0)
		);
		const maxTotal = Math.max(1, ...totals);
		const rows = PRIORITIES.map((label, i) => ({
			i,
			label: short(label),
			total: totals[i],
			segs: PERSONAS.map((persona, s) => ({
				s,
				color: persona.color,
				name: persona.name,
				w: (seatCoins[s][i] / maxTotal) * 100
			})).filter((seg) => seg.w > 0)
		}));
		const grand = sum(totals);
		return { rows, grand, hasData: grand > 0 };
	});
</script>

<div class="rounded-2xl border border-line bg-panel/30 p-5 space-y-4">
	<div>
		<div class="font-mono text-[11px] uppercase tracking-[0.26em] text-gold">Priority Constellation</div>
		<div class="text-xs text-muted">Every token in the room, stacked by the function that placed it.</div>
	</div>

	{#if !model.hasData}
		<div class="flex h-[240px] items-center justify-center text-sm text-muted">No tokens placed yet.</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each model.rows as row (row.i)}
				<div class="grid items-center gap-3" style="grid-template-columns: 110px 1fr 40px;">
					<div class="truncate text-xs font-semibold text-ink">{row.label}</div>
					<div class="flex h-5 overflow-hidden rounded-full bg-white/5 border border-line/40">
						{#each row.segs as seg (seg.s)}
							<div class="h-full transition-all duration-500" style="width:{seg.w}%;background:{seg.color}" title="{seg.name}: {Math.round(seg.w)}%"></div>
						{/each}
					</div>
					<div class="text-right font-mono text-xs font-bold text-gold">{Math.round(row.total)}</div>
				</div>
			{/each}
		</div>

		<div class="mt-4 flex flex-wrap gap-x-3.5 gap-y-1.5 pt-2 border-t border-line/40">
			{#each PERSONAS as persona (persona.seat)}
				<span class="flex items-center gap-1.5 text-[11px] text-muted font-medium">
					<i class="inline-block h-2.5 w-2.5 rounded-full" style="background:{persona.color}"></i>{persona.name}
				</span>
			{/each}
		</div>
	{/if}
</div>
