<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITIES } from '$lib/game';

	let { room }: { room: RoomState } = $props();

	const W = 640;
	const H = 460;
	const pad = 54;
	const x0 = pad;
	const x1 = W - 24;
	const y0 = H - pad;
	const y1 = 24;

	const short = (p: string) =>
		p.replace('Employee ', 'Emp. ').replace('Employer ', 'Emp. ').replace(' Readiness', '');

	const model = $derived.by(() => {
		const { matrix, reach, alignment, fault, blind, tableCount } = room.aggregate;
		// Breadth = fraction of backing tables/functions, so denominate by
		// tableCount (0..1), not the 7×-inflated synthetic player count.
		const seats = Math.max(1, tableCount);
		const intensity = matrix.map((w, i) => (reach[i] > 0 ? w / reach[i] : 0));
		const maxI = Math.max(0.0001, ...intensity) * 1.15;
		// Size bubbles by SHARE of the biggest — magnitude-independent, so the
		// cumulative board (values climb toward $700M) can't blow them up.
		const maxW = Math.max(1, ...matrix);
		const rx = (frac: number) => x0 + frac * (x1 - x0);
		const ry = (v: number) => y0 - (v / maxI) * (y0 - y1);

		const bubbles = matrix.map((w, i) => {
			const breadth = reach[i] / seats; // 0..1
			const key =
				i === alignment
					? 'var(--color-teal)'
					: i === fault
						? 'var(--color-gold)'
						: i === blind
							? 'var(--color-red)'
							: 'var(--color-muted)';
			return {
				i,
				label: short(PRIORITIES[i]),
				cx: rx(breadth),
				cy: ry(intensity[i]),
				r: w > 0 ? 10 + Math.sqrt(w / maxW) * 26 : 0, // ~10..36px, area ∝ share
				key,
				w
			};
		});
		return { bubbles, mx: rx(0.5), my: ry(maxI * 0.5), hasData: matrix.some((w) => w > 0) };
	});
</script>

<div class="rounded-2xl border border-line bg-panel/30 p-5">
	<div class="mb-1 font-mono text-[11px] uppercase tracking-[0.26em] text-gold">The Shape of the Room</div>
	<div class="mb-3 text-xs text-muted">
		Reach (how many functions back it) × Intensity ($ per backing function). Bubble = share of total $.
	</div>

	{#if !model.hasData}
		<div class="flex h-[280px] items-center justify-center text-sm text-muted">No tokens placed yet.</div>
	{:else}
		<svg viewBox="0 0 {W} {H}" class="block w-full">
			<line x1={model.mx} y1={y1} x2={model.mx} y2={y0} stroke="var(--color-line)" stroke-dasharray="4,4" opacity="0.6" />
			<line x1={x0} y1={model.my} x2={x1} y2={model.my} stroke="var(--color-line)" stroke-dasharray="4,4" opacity="0.6" />

			<line x1={x0} y1={y0} x2={x1} y2={y0} stroke="var(--color-muted)" stroke-width="1.5" />
			<line x1={x0} y1={y0} x2={x0} y2={y1} stroke="var(--color-muted)" stroke-width="1.5" />

			<text x={W / 2} y={H - 12} fill="var(--color-muted)" text-anchor="middle" class="font-mono text-[11px] uppercase tracking-widest">
				Breadth of Reach →
			</text>
			<text x={16} y={H / 2} fill="var(--color-muted)" text-anchor="middle" transform="rotate(-90 16 {H / 2})" class="font-mono text-[11px] uppercase tracking-widest">
				Stake Intensity →
			</text>

			<text x={x0 + 12} y={y1 + 18} fill="var(--color-gold)" opacity="0.7" class="font-mono text-[10px] uppercase font-bold">Niche Conviction</text>
			<text x={x1 - 12} y={y1 + 18} fill="var(--color-teal)" opacity="0.7" text-anchor="end" class="font-mono text-[10px] uppercase font-bold">Consensus Champions</text>
			<text x={x0 + 12} y={y0 - 12} fill="var(--color-muted)" opacity="0.5" class="font-mono text-[10px] uppercase">Quiet Depths</text>
			<text x={x1 - 12} y={y0 - 12} fill="var(--color-muted)" opacity="0.5" text-anchor="end" class="font-mono text-[10px] uppercase">Broad Support</text>

			{#each model.bubbles as b (b.i)}
				<circle cx={b.cx} cy={b.cy} r={b.r} fill={b.key} fill-opacity="0.3" stroke={b.key} stroke-width="2" class="transition-all duration-500" />
				<text x={b.cx} y={b.cy + 3} fill="var(--color-ink)" text-anchor="middle" font-size="11" font-weight="700" pointer-events="none">
					{b.label}
				</text>
			{/each}
		</svg>
	{/if}
</div>
