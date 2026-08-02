<script lang="ts">
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { session } from '$lib/state';
	import { futureUi } from './future.svelte';

	/** Room render preview — generation is part of Create ZyetaI brief. */
	let {
		imageUrl,
		hasData,
		onExpand
	}: {
		imageUrl: string;
		hasData: boolean;
		onExpand: () => void;
	} = $props();
</script>

<div class="panel">
	<div class="kicker-row">
		<div class="cg-kicker">Room workplace</div>
		<div class="frg-brand">
			<ZyetaI variant="badge" />
			<span class="created">Created by ZyetaI</span>
		</div>
	</div>
	<div class="frame">
		{#if imageUrl}
			<button
				type="button"
				class="img-btn"
				onclick={onExpand}
				aria-label="Expand Common Ground room image"
			>
				<img src={imageUrl} alt="Common Ground — combined room workplace" class="img" />
				<span class="expand-hint">Expand · room mix</span>
			</button>
		{:else}
			<div class="empty">
				<div class="icon"><Icon name="building" size={40} /></div>
				<p>{hasData ? 'Common Ground render runs with Create ZyetaI brief' : 'Waiting for priorities…'}</p>
			</div>
		{/if}
		{#if session.busy && futureUi.progress}
			<div class="overlay">
				<div class="spin"></div>
				<p>{futureUi.progress}</p>
			</div>
		{/if}
	</div>

	{#if imageUrl}
		<button type="button" class="dl" onclick={onExpand}>Expand Common Ground</button>
	{/if}
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
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}
	.frg-brand {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.created {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-gold);
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
		border: none;
		padding: 0;
		cursor: pointer;
		background: transparent;
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
		font-size: 11px;
		font-weight: 700;
		padding: 6px 10px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
	}
	.empty {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: var(--color-muted);
		font-size: 13px;
		padding: 16px;
		text-align: center;
	}
	.icon {
		opacity: 0.5;
	}
	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		background: rgba(10, 15, 26, 0.72);
		color: #fff;
		font-size: 12px;
		font-family: var(--font-mono);
	}
	.spin {
		width: 28px;
		height: 28px;
		border: 2px solid rgba(255, 255, 255, 0.25);
		border-top-color: var(--color-gold);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.dl {
		margin-top: 10px;
		width: 100%;
		border-radius: 12px;
		padding: 10px;
		border: 1px solid var(--color-line);
		background: transparent;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		color: var(--color-ink);
	}
</style>
