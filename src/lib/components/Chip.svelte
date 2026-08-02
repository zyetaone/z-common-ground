<script lang="ts">
	// Poker-chip token — single $10M denom.
	// Default is the brand red (--color-red); CHIP_DENOMS in game/config owns
	// the gameplay chip color — every gameplay call site passes `hex` explicitly.
	let {
		hex = '#c9403a',
		value,
		size = 30
	}: { hex?: string; value?: number | string; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
	<circle cx="20" cy="20" r="19" fill={hex} />
	<circle cx="20" cy="20" r="19" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1" />
	<circle
		cx="20"
		cy="20"
		r="18.5"
		fill="none"
		stroke="rgba(255,255,255,0.85)"
		stroke-width="2.5"
		stroke-dasharray="5 5.4"
	/>
	<circle cx="20" cy="20" r="13" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.5" />
	{#if value != null}
		<text
			x="20"
			y="21"
			text-anchor="middle"
			dominant-baseline="central"
			fill="#fff"
			font-family="var(--font-display)"
			font-weight="800"
			font-size={size * 0.47}>{value}</text
		>
	{/if}
</svg>
