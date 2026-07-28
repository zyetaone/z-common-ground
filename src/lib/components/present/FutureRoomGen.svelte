<script lang="ts">
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { session } from '$lib/state';
	import { futureUi } from './future.svelte';

	/** Right column — room render gen + expand. */
	let {
		imageUrl,
		hasData,
		onGenerate,
		onExpand
	}: {
		imageUrl: string;
		hasData: boolean;
		onGenerate: () => void;
		onExpand: (src: string, title: string) => void;
	} = $props();
</script>

<div class="panel">
	<div class="kicker-row">
		<div class="kicker">Room board</div>
		<ZyetaI compact />
	</div>
	<div class="frame">
		{#if imageUrl}
			<button
				type="button"
				class="img-btn"
				onclick={() => onExpand(imageUrl, 'Room workplace')}
				aria-label="Expand room image"
			>
				<img src={imageUrl} alt="Future workplace for this room" class="img" />
				<span class="expand-hint">Expand</span>
			</button>
		{:else}
			<div class="empty">
				<div class="icon"><Icon name="building" size={40} /></div>
				<p>{hasData ? 'Generate room render' : 'Waiting for stake'}</p>
			</div>
		{/if}
		{#if session.busy && futureUi.progress}
			<div class="overlay">
				<div class="spin"></div>
				<p>{futureUi.progress}</p>
			</div>
		{/if}
	</div>

	{#if futureUi.err}
		<p class="err">{futureUi.err}</p>
	{/if}

	<div class="actions">
		<button type="button" class="gen" disabled={session.busy || !hasData} onclick={onGenerate}>
			{session.busy && futureUi.progress ? '…' : imageUrl ? 'Regen room' : 'Generate room'}
		</button>
		{#if imageUrl}
			<button type="button" class="dl" onclick={() => onExpand(imageUrl, 'Room workplace')}>
				Expand
			</button>
		{/if}
	</div>
</div>

<style>
	.panel {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 16px 18px;
	}
	.kicker-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.frame {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid var(--color-line);
		background: #0a0f1a;
	}
	.img-btn {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: transparent;
		cursor: zoom-in;
		position: relative;
	}
	.img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.expand-hint {
		position: absolute;
		right: 10px;
		bottom: 10px;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(10, 15, 26, 0.8);
		border: 1px solid color-mix(in srgb, var(--color-gold) 40%, transparent);
		color: var(--color-gold);
	}
	.empty {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 20px;
		text-align: center;
		color: var(--color-muted);
		font-size: 13px;
	}
	.icon {
		font-size: 1.75rem;
	}
	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(7, 11, 20, 0.72);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font-size: 13px;
	}
	.spin {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 3px solid var(--color-line);
		border-top-color: var(--color-teal);
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.actions {
		display: flex;
		gap: 10px;
		margin-top: 12px;
		align-items: center;
	}
	.gen {
		border: none;
		border-radius: 12px;
		padding: 12px 16px;
		font-family: var(--font-display);
		font-weight: 800;
		background: var(--color-teal);
		color: var(--color-on-teal);
		cursor: pointer;
	}
	.gen:disabled {
		opacity: 0.4;
	}
	.dl {
		color: var(--color-gold);
		font-size: 13px;
		text-decoration: underline;
		background: none;
		border: none;
		cursor: pointer;
		font-weight: 700;
	}
	.err {
		color: var(--color-red);
		font-size: 12px;
		margin: 8px 0 0;
	}
</style>
