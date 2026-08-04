<script lang="ts">
	/**
	 * CgiGauge — Radial SVG Gauge Meter for Common Ground Index (0–100).
	 * Renders a 220-degree arc with smooth value animations, threshold color coding
	 * (Fractured = Red, Mixed = Gold, Aligned = Teal), and crisp central typography.
	 */
	let {
		score = 0,
		verdict = '—',
		size = 140
	}: {
		score: number;
		verdict?: string;
		size?: number;
	} = $props();

	const clampedScore = $derived(Math.min(100, Math.max(0, score)));
	
	// Arc parameters (220 deg total arc, centered at top)
	const strokeWidth = 10;
	const radius = 46;
	const cx = 60;
	const cy = 60;
	const circumference = 2 * Math.PI * radius;
	const arcLength = (220 / 360) * circumference;
	const dashOffset = $derived(arcLength - (clampedScore / 100) * arcLength);

	// Color logic based on CGI index thresholds
	const arcColor = $derived(
		clampedScore >= 66
			? 'var(--color-teal)'
			: clampedScore >= 40
				? 'var(--color-gold)'
				: clampedScore > 0
					? 'var(--color-red)'
					: 'var(--color-muted)'
	);
</script>

<div class="cgi-gauge" style="--gauge-size: {size}px; --gauge-color: {arcColor}">
	<svg viewBox="0 0 120 120" width={size} height={size} aria-label="Common Ground Index gauge: {clampedScore} of 100">
		<defs>
			<linearGradient id="cgi-grad-teal" x1="0%" y1="100%" x2="100%" y2="0%">
				<stop offset="0%" stop-color="#19685B" />
				<stop offset="100%" stop-color="#3FB6A2" />
			</linearGradient>
			<linearGradient id="cgi-grad-gold" x1="0%" y1="100%" x2="100%" y2="0%">
				<stop offset="0%" stop-color="#917220" />
				<stop offset="100%" stop-color="#E0A458" />
			</linearGradient>
			<linearGradient id="cgi-grad-red" x1="0%" y1="100%" x2="100%" y2="0%">
				<stop offset="0%" stop-color="#A32E29" />
				<stop offset="100%" stop-color="#E0665A" />
			</linearGradient>
			<filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
				<feGaussianBlur stdDeviation="3" result="blur" />
				<feComposite in="SourceGraphic" in2="blur" operator="over" />
			</filter>
		</defs>

		<!-- Background arc track (rotated -200 deg to center 220 deg arc) -->
		<circle
			{cx}
			{cy}
			r={radius}
			fill="none"
			stroke="color-mix(in srgb, var(--color-ink) 12%, transparent)"
			stroke-width={strokeWidth}
			stroke-dasharray="{arcLength} {circumference}"
			stroke-dashoffset="0"
			stroke-linecap="round"
			transform="rotate(160 {cx} {cy})"
		/>

		<!-- Animated progress arc -->
		<circle
			{cx}
			{cy}
			r={radius}
			fill="none"
			stroke={clampedScore >= 66 ? 'url(#cgi-grad-teal)' : clampedScore >= 40 ? 'url(#cgi-grad-gold)' : 'url(#cgi-grad-red)'}
			stroke-width={strokeWidth}
			stroke-dasharray="{arcLength} {circumference}"
			stroke-dashoffset={dashOffset}
			stroke-linecap="round"
			transform="rotate(160 {cx} {cy})"
			class="gauge-progress"
			filter="url(#gauge-glow)"
		/>

		<!-- Central score readout -->
		<text x={cx} y={cy - 4} text-anchor="middle" class="gauge-score-num">
			{clampedScore}
		</text>
		<text x={cx} y={cy + 12} text-anchor="middle" class="gauge-max-label">
			/100
		</text>
		<text x={cx} y={cy + 26} text-anchor="middle" class="gauge-verdict-label">
			{verdict}
		</text>
	</svg>
</div>

<style>
	.cgi-gauge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: relative;
		flex-shrink: 0;
	}
	.gauge-progress {
		transition: stroke-dashoffset 800ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.gauge-score-num {
		font-family: var(--font-display);
		font-size: 26px;
		font-weight: 800;
		fill: var(--color-ink);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.03em;
	}
	.gauge-max-label {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		fill: var(--color-muted);
		letter-spacing: 0.05em;
	}
	.gauge-verdict-label {
		font-family: var(--font-mono);
		font-size: 8px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		fill: var(--gauge-color);
	}
</style>
