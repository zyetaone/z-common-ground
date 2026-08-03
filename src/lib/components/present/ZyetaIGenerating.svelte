<script lang="ts">
	import ZyetaI from '$lib/components/ZyetaI.svelte';

	/** ZyetaI concept pipeline — 5 stages. Lives in the consumer that renders it.
	 *  Only id/label/desc are rendered; the old key/short fields went unused. */
	const ZYETAI_STEPS = [
		{ id: 1, label: 'Lenses', desc: 'Read each function’s priority shape.' },
		{ id: 2, label: 'Brief', desc: 'Write the analysis brief from the room mix.' },
		{ id: 3, label: 'Zones', desc: 'Map multi-zone spatial requirements.' },
		{ id: 4, label: 'Images', desc: 'Room concept, then each function still — in order.' },
		{ id: 5, label: 'Lookbook', desc: 'Compose brief + DBR after images exist.' }
	] as const;
	let {
		open = false,
		mode = 'pipeline',
		step = 0,
		completedThrough = 0,
		progress = '',
		oncancel
	}: {
		open?: boolean;
		mode?: 'pipeline' | 'room';
		step?: number;
		completedThrough?: number;
		progress?: string;
		/** Omit to keep the overlay strictly non-dismissible. */
		oncancel?: () => void;
	} = $props();

	/** Set once Stop is pressed so the button can't be hammered. */
	let stopping = $state(false);
	$effect(() => {
		if (!open) stopping = false; // reset between runs
	});

	const activeIdx = $derived(Math.max(0, Math.min(step - 1, ZYETAI_STEPS.length - 1)));
	const pct = $derived.by(() => {
		if (mode === 'room') return progress ? 55 : 0;
		if (step <= 0) return Math.min(12, completedThrough * 8);
		return Math.min(96, Math.round((step / ZYETAI_STEPS.length) * 100));
	});
	const statusLine = $derived(
		progress?.trim() ||
			(mode === 'room'
				? 'Rendering Common Ground…'
				: (ZYETAI_STEPS[activeIdx]?.desc ?? 'Working…'))
	);

	// Non-dismissible by design, but keyboard/AT users still need initial focus.
	let card = $state<HTMLDivElement>();
	$effect(() => {
		if (open) card?.focus();
	});
</script>

{#if open}
	<div class="overlay" role="alertdialog" aria-modal="true" aria-busy="true" aria-labelledby="zi-gen-title">
		<div class="card" bind:this={card} tabindex="-1">
			<header class="head">
				<ZyetaI variant="hero" tagline />
				<div class="spin" aria-hidden="true"></div>
			</header>

			{#if mode === 'pipeline'}
				<h2 id="zi-gen-title" class="title">Generating concepts</h2>
				<p class="status" aria-live="polite">{statusLine}</p>

				<div class="track" aria-hidden="true">
					<div class="fill" style="width:{pct}%"></div>
				</div>

				<ol class="steps">
					{#each ZYETAI_STEPS as s (s.id)}
						{@const done = completedThrough >= s.id && step !== s.id}
						{@const on = step === s.id}
						<li class="step" class:done class:on>
							<span class="n" aria-hidden="true">
								{#if done}
									✓
								{:else}
									{s.id}
								{/if}
							</span>
							<div class="meta">
								<span class="lab">{s.label}</span>
								{#if on}
									<span class="desc">{s.desc}</span>
								{/if}
							</div>
							{#if on}
								<span class="pulse" aria-hidden="true"></span>
							{/if}
						</li>
					{/each}
				</ol>
			{:else}
				<h2 id="zi-gen-title" class="title">Common Ground concept</h2>
				<p class="status" aria-live="polite">{statusLine}</p>
				<div class="track" aria-hidden="true">
					<div class="fill anim" style="width:{pct}%"></div>
				</div>
				<div class="room-hint">
					<span class="rh-k">Adding to palette</span>
					<p class="rh-p">
						A new room still — Created by ZyetaI. Lens images stay as-is; this only grows the Common
						Ground set for drawings.
					</p>
				</div>
			{/if}

			<p class="foot">Please wait — this can take a moment.</p>

			{#if oncancel}
				<!-- The run is minutes of paid calls. Without this the only escape is
				     a reload, which loses the operator's place mid-workshop. Work that
				     already finished is persisted server-side and is kept. -->
				<button
					type="button"
					class="stop"
					disabled={stopping}
					onclick={() => {
						stopping = true;
						oncancel?.();
					}}
				>
					{stopping ? 'Stopping after this step…' : 'Stop'}
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		padding: 20px;
		background: rgba(8, 12, 18, 0.72);
		backdrop-filter: blur(12px);
		animation: fade-in var(--dur-fast, 180ms) ease both;
	}
	.card {
		width: min(420px, 100%);
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in srgb, var(--color-teal) 40%, var(--color-line));
		background: var(--color-panel);
		padding: 22px 22px 18px;
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--color-teal) 12%, transparent),
			0 28px 80px rgba(0, 0, 0, 0.35);
		animation: card-in var(--dur-base, 280ms) var(--ease-out-quart, cubic-bezier(0.22, 1, 0.36, 1)) both;
	}
	/* Programmatic focus target only — suppress the ring. */
	.card:focus {
		outline: none;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}
	.spin {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2.5px solid color-mix(in srgb, var(--color-teal) 25%, transparent);
		border-top-color: var(--color-teal);
		animation: spin 0.75s linear infinite;
		flex-shrink: 0;
	}
	.title {
		margin: 0 0 6px;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--color-ink);
	}
	.status {
		margin: 0 0 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-teal-ink);
		line-height: 1.4;
		min-height: 1.4em;
	}
	.track {
		height: 4px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
		overflow: hidden;
		margin-bottom: 16px;
	}
	.fill {
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(90deg, var(--color-teal), var(--color-gold));
		transition: width var(--dur-slow, 480ms) var(--ease-out-quart, ease);
	}
	.fill.anim {
		animation: pulse-w 1.4s ease-in-out infinite;
	}
	.steps {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.step {
		display: grid;
		grid-template-columns: 28px 1fr auto;
		gap: 10px;
		align-items: center;
		padding: 10px 12px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: transparent;
		opacity: 0.42;
		transition:
			opacity var(--dur-fast, 180ms) ease,
			border-color var(--dur-fast, 180ms) ease,
			background var(--dur-fast, 180ms) ease;
	}
	.step.done {
		opacity: 0.78;
		border-color: color-mix(in srgb, var(--color-teal) 28%, var(--color-line));
	}
	.step.on {
		opacity: 1;
		border-color: var(--color-teal);
		background: color-mix(in srgb, var(--color-teal) 10%, transparent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-teal) 18%, transparent);
	}
	.n {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 800;
		background: color-mix(in srgb, var(--color-ink) 6%, transparent);
		color: var(--color-muted);
	}
	.step.done .n {
		background: color-mix(in srgb, var(--color-teal) 18%, transparent);
		color: var(--color-teal-ink);
	}
	.step.on .n {
		background: var(--color-teal);
		color: var(--color-on-teal);
	}
	.meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.lab {
		font-weight: 800;
		font-size: 13px;
		color: var(--color-ink);
	}
	.desc {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.3;
	}
	.pulse {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-gold);
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-gold) 50%, transparent);
		animation: ping 1.2s ease-out infinite;
	}
	.room-hint {
		padding: 12px 14px;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in srgb, var(--color-teal) 28%, var(--color-line));
		background: color-mix(in srgb, var(--color-teal) 6%, transparent);
		margin-bottom: 12px;
	}
	.rh-k {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-teal-ink);
	}
	.rh-p {
		margin: 6px 0 0;
		font-size: 12px;
		line-height: 1.4;
		color: var(--color-muted);
	}
	.foot {
		margin: 0;
		font-size: 11px;
		color: var(--color-muted);
		text-align: center;
	}
	.stop {
		display: block;
		margin: 12px auto 0;
		border-radius: 999px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-muted);
		font-size: 11px;
		font-weight: 700;
		padding: 7px 16px;
		cursor: pointer;
		transition:
			border-color var(--dur-fast, 180ms) ease,
			color var(--dur-fast, 180ms) ease;
	}
	.stop:hover:not(:disabled) {
		border-color: var(--color-red);
		color: var(--color-red);
	}
	.stop:disabled {
		opacity: 0.55;
		cursor: default;
	}

	@keyframes ping {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-gold) 45%, transparent);
		}
		70% {
			box-shadow: 0 0 0 8px transparent;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}
	@keyframes pulse-w {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes card-in {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin,
		.pulse,
		.fill.anim {
			animation: none;
		}
		.overlay,
		.card {
			animation: none;
		}
	}
</style>
