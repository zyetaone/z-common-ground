<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { PRIORITIES, PRIORITY_COLORS } from '$lib/game';

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
		const seats = Math.max(1, tableCount);
		const intensity = matrix.map((w, i) => (reach[i] > 0 ? w / reach[i] : 0));
		const maxI = Math.max(0.0001, ...intensity) * 1.15;
		const maxW = Math.max(1, ...matrix);
		const rx = (frac: number) => x0 + frac * (x1 - x0);
		const ry = (v: number) => y0 - (v / maxI) * (y0 - y1);

		// Quadrant classification
		const medBreadth = seats > 0 ? 0.5 : 0;
		const medIntensity = maxI * 0.5;

		const classify = (breadth: number, int: number): string => {
			if (int > medIntensity && breadth > medBreadth) return 'Consensus Champion';
			if (int > medIntensity && breadth <= medBreadth) return 'Niche Conviction';
			if (int <= medIntensity && breadth > medBreadth) return 'Broad Support';
			return 'Quiet Depths';
		};

		const bubbles = matrix.map((w, i) => {
			const breadth = reach[i] / seats;
			const key =
				i === alignment
					? 'var(--color-teal)'
					: i === fault
						? 'var(--color-gold)'
						: i === blind
							? 'var(--color-red)'
							: 'var(--color-muted)';
			const quadrant = classify(breadth, intensity[i]);
			return {
				i,
				label: short(PRIORITIES[i]),
				cx: rx(breadth),
				cy: ry(intensity[i]),
				r: w > 0 ? 10 + Math.sqrt(w / maxW) * 26 : 0,
				key,
				w,
				breadth,
				intensity: intensity[i],
				quadrant
			};
		});

		// Group by quadrant for summary
		const quadrants = ['Niche Conviction', 'Consensus Champion', 'Broad Support', 'Quiet Depths'];
		const qSummary: Record<string, typeof bubbles> = {};
		for (const q of quadrants) qSummary[q] = [];
		for (const b of bubbles) {
			if (b.w > 0) qSummary[b.quadrant].push(b);
		}

		return { bubbles, mx: rx(0.5), my: ry(maxI * 0.5), hasData: matrix.some((w) => w > 0), qSummary };
	});
</script>

<div class="riq">
	<div class="head">
		<div class="kicker">The Shape of the Room</div>
		<div class="sub">Reach (how many functions back it) × Intensity ($ per backing function). Bubble area = share of total $.</div>
	</div>

	{#if !model.hasData}
		<div class="empty">No tokens placed yet.</div>
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

		<div class="summary">
			{#each ['Consensus Champion', 'Niche Conviction', 'Broad Support', 'Quiet Depths'] as qLabel}
				{@const items = model.qSummary[qLabel] ?? []}
				{@const qColors = qLabel === 'Consensus Champion' ? '#3B82F6' : qLabel === 'Niche Conviction' ? '#E2B04A' : qLabel === 'Broad Support' ? '#6EE7B7' : '#9CA3AF'}
				<div class="qrow" style="--qc:{qColors}">
					<span class="qtag">{qLabel}</span>
					{#if items.length > 0}
						<span class="qitems">
							{#each items as it, j (it.i)}
								<span class="qbub" style="color:{it.key}">{it.label}</span>
								{#if j < items.length - 1}<span class="qdot">·</span>{/if}
							{/each}
						</span>
					{:else}
						<span class="qnone">—</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.riq {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 14px 16px;
	}
	.head { margin-bottom: 10px; }
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-gold);
	}
	.sub {
		font-size: 11px;
		color: var(--color-muted);
		margin-top: 2px;
	}
	.empty {
		display: grid;
		place-items: center;
		height: 280px;
		color: var(--color-muted);
		font-size: 14px;
		border: 1px dashed var(--color-line);
		border-radius: 12px;
	}
	.summary {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 14px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(0, 0, 0, 0.18);
	}
	.qrow {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 11px;
	}
	.qtag {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		font-weight: 800;
		color: var(--qc);
		min-width: 110px;
	}
	.qitems {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}
	.qbub {
		font-weight: 700;
		font-size: 11px;
	}
	.qdot {
		color: var(--color-muted);
		font-weight: 700;
	}
	.qnone {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}
</style>
