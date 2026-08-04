<script lang="ts">
	import type { FunctionProfileTrait } from '$lib/game/scoring';

	/**
	 * RadarChart — SVG 6-axis spider / radar chart for function traits.
	 * Visualizes scores (0–100) across axes: Sure, Breadth, Aligned, Innovative, On-type, Future.
	 */
	let {
		traits = [],
		color = 'var(--color-teal)',
		size = 220,
		showLabels = true
	}: {
		traits: FunctionProfileTrait[];
		color?: string;
		size?: number;
		showLabels?: boolean;
	} = $props();

	const cx = 100;
	const cy = 100;
	const r = 68; // max radius inside 200x200 viewBox

	const n = $derived(traits.length || 6);

	// Angle for axis i (starting at top -90deg)
	function getAngle(i: number): number {
		return (i * 2 * Math.PI) / n - Math.PI / 2;
	}

	function getCoords(i: number, val: number): { x: number; y: number } {
		const angle = getAngle(i);
		const dist = (Math.min(100, Math.max(0, val)) / 100) * r;
		return {
			x: cx + dist * Math.cos(angle),
			y: cy + dist * Math.sin(angle)
		};
	}

	// Concentric grid polygon points (for 25%, 50%, 75%, 100%)
	function ringPolygonPoints(pct: number): string {
		return Array.from({ length: n })
			.map((_, i) => {
				const { x, y } = getCoords(i, pct);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	// Data polygon points
	const dataPoints = $derived(
		traits
			.map((t, i) => {
				const { x, y } = getCoords(i, t.score);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ')
	);
</script>

<div class="radar-wrap" style="--radar-size: {size}px; --radar-color: {color}">
	<svg viewBox="0 0 200 200" width={size} height={size} aria-label="Trait radar chart">
		<defs>
			<filter id="radar-glow" x="-20%" y="-20%" width="140%" height="140%">
				<feGaussianBlur stdDeviation="2.5" result="blur" />
				<feComposite in="SourceGraphic" in2="blur" operator="over" />
			</filter>
		</defs>

		<!-- Concentric grid rings -->
		{#each [25, 50, 75, 100] as pct (pct)}
			<polygon
				points={ringPolygonPoints(pct)}
				fill="none"
				stroke="color-mix(in srgb, var(--color-ink) 10%, transparent)"
				stroke-width="1"
				stroke-dasharray={pct === 100 ? 'none' : '2,2'}
			/>
		{/each}

		<!-- Radial axis lines -->
		{#each Array(n) as _, i (i)}
			{@const end = getCoords(i, 100)}
			<line
				x1={cx}
				y1={cy}
				x2={end.x}
				y2={end.y}
				stroke="color-mix(in srgb, var(--color-ink) 12%, transparent)"
				stroke-width="1"
			/>
		{/each}

		<!-- Data polygon area fill -->
		{#if traits.length > 0}
			<polygon
				points={dataPoints}
				fill="color-mix(in srgb, {color} 22%, transparent)"
				stroke={color}
				stroke-width="2.5"
				stroke-linejoin="round"
				filter="url(#radar-glow)"
			/>

			<!-- Vertex markers -->
			{#each traits as trait, i (i)}
				{@const pt = getCoords(i, trait.score)}
				<circle
					cx={pt.x}
					cy={pt.y}
					r="3.5"
					fill={color}
					stroke="var(--color-panel)"
					stroke-width="1.5"
				/>
			{/each}
		{/if}

		<!-- Axis labels -->
		{#if showLabels}
			{#each traits as trait, i (i)}
				{@const labelPt = getCoords(i, 120)}
				{@const isTop = i === 0}
				{@const isBottom = i === 3}
				<text
					x={labelPt.x}
					y={labelPt.y + (isTop ? -2 : isBottom ? 8 : 3)}
					text-anchor={Math.abs(labelPt.x - cx) < 5 ? 'middle' : labelPt.x > cx ? 'start' : 'end'}
					class="radar-label"
				>
					{trait.label}
					<tspan class="radar-score-sub">{trait.score}</tspan>
				</text>
			{/each}
		{/if}
	</svg>
</div>

<style>
	.radar-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: relative;
		flex-shrink: 0;
	}
	.radar-label {
		font-family: var(--font-mono);
		font-size: 8.5px;
		font-weight: 700;
		fill: var(--color-ink);
		letter-spacing: 0.02em;
	}
	.radar-score-sub {
		font-weight: 800;
		fill: var(--radar-color);
	}
</style>
