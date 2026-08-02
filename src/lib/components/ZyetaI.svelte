<script lang="ts">
	/**
	 * ZyetaI brand mark — Zyeta’s workplace-strategy AI.
	 * Variants: text (default) · compact · badge · mark · hero
	 */
	let {
		compact = false,
		variant = compact ? 'compact' : 'text',
		tagline = false
	}: {
		compact?: boolean;
		/** text | compact | badge | mark | hero */
		variant?: 'text' | 'compact' | 'badge' | 'mark' | 'hero';
		/** Show “workplace strategy AI” under the name (hero / badge) */
		tagline?: boolean;
	} = $props();

	const v = $derived(variant);
</script>

{#if v === 'mark'}
	<span class="zi-mark" aria-label="ZyetaI" title="ZyetaI — workplace strategy AI">
		<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
			<rect width="32" height="32" rx="8" fill="var(--zi-bg, #FDF8ED)" />
			<!-- Z stroke -->
			<path
				d="M9 9.5 h14 l-14 13 h14"
				fill="none"
				stroke="var(--color-teal)"
				stroke-width="2.6"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<!-- gold accent bar -->
			<path
				d="M11 16 h10"
				fill="none"
				stroke="var(--color-gold)"
				stroke-width="2"
				stroke-linecap="round"
				opacity="0.9"
			/>
		</svg>
	</span>
{:else if v === 'badge'}
	<span class="zi-badge" aria-label="ZyetaI">
		<span class="zi-mark mini" aria-hidden="true">
			<svg viewBox="0 0 32 32" width="18" height="18">
				<rect width="32" height="32" rx="7" fill="color-mix(in srgb, var(--color-teal) 12%, transparent)" />
				<path
					d="M9 9.5 h14 l-14 13 h14"
					fill="none"
					stroke="var(--color-teal)"
					stroke-width="2.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M11 16 h10"
					fill="none"
					stroke="var(--color-gold)"
					stroke-width="2.2"
					stroke-linecap="round"
				/>
			</svg>
		</span>
		<span class="zi-badge-text">
			<span class="zi-name">ZyetaI</span>
			{#if tagline}
				<span class="zi-tag">workplace strategy AI</span>
			{:else}
				<span class="zi-tag">AI</span>
			{/if}
		</span>
	</span>
{:else if v === 'hero'}
	<div class="zi-hero" aria-label="ZyetaI">
		<span class="zi-mark" aria-hidden="true">
			<svg viewBox="0 0 32 32" width="36" height="36">
				<rect width="32" height="32" rx="9" fill="color-mix(in srgb, var(--color-teal) 14%, var(--color-panel))" />
				<path
					d="M9 9.5 h14 l-14 13 h14"
					fill="none"
					stroke="var(--color-teal)"
					stroke-width="2.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d="M11 16 h10"
					fill="none"
					stroke="var(--color-gold)"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</span>
		<div class="zi-hero-copy">
			<p class="zi-hero-name">ZyetaI</p>
			{#if tagline}
				<p class="zi-hero-tag">Workplace strategy AI · Common Ground</p>
			{:else}
				<p class="zi-hero-tag">Powered by Zyeta</p>
			{/if}
		</div>
	</div>
{:else if v === 'compact'}
	<p class="zi compact">
		<span class="zi-dot" aria-hidden="true"></span>
		<span class="zi-label">AI</span>
		<span class="zi-sep" aria-hidden="true">·</span>
		<span class="zi-brand">ZyetaI</span>
	</p>
{:else}
	<p class="zi">
		<span class="zi-label">AI powered by</span>
		<span class="zi-brand">ZyetaI</span>
	</p>
{/if}

<style>
	.zi {
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.zi.compact {
		letter-spacing: 0.1em;
		gap: 5px;
	}
	.zi-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--color-teal), var(--color-gold));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-teal) 20%, transparent);
		flex-shrink: 0;
	}
	.zi-label {
		font-weight: 500;
		opacity: 0.9;
	}
	.zi-sep {
		opacity: 0.45;
	}
	.zi-brand {
		color: var(--color-teal);
		font-weight: 800;
		letter-spacing: 0.08em;
		transition: color var(--dur-fast, 180ms) ease;
	}
	.zi:hover .zi-brand {
		color: color-mix(in srgb, var(--color-teal) 75%, var(--color-gold));
	}

	.zi-mark {
		display: inline-flex;
		line-height: 0;
		flex-shrink: 0;
	}
	.zi-mark.mini {
		display: inline-flex;
	}

	.zi-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 10px 5px 6px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--color-teal) 35%, var(--color-line));
		background: color-mix(in srgb, var(--color-teal) 8%, var(--color-panel));
		box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.04));
	}
	.zi-badge-text {
		display: flex;
		flex-direction: column;
		gap: 0;
		line-height: 1.15;
	}
	.zi-name {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--color-teal);
		text-transform: none;
	}
	.zi-tag {
		font-family: var(--font-mono);
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.zi-hero {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.zi-hero-copy {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.zi-hero-name {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--color-ink);
		line-height: 1.1;
	}
	.zi-hero-tag {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
</style>
