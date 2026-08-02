<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import { LOOK_REGEN_OPTIONS } from '$lib/game';
	import type { ZyetaIRunMode } from '$lib/game';
	import { session } from '$lib/state';

	/** "What should ZyetaI redo?" picker. Pure presentation over LOOK_REGEN_OPTIONS. */
	let {
		open,
		hasData,
		onPick,
		onClose
	}: {
		open: boolean;
		hasData: boolean;
		onPick: (mode: ZyetaIRunMode) => void;
		onClose: () => void;
	} = $props();
</script>

<Modal {open} label="Regenerate" onclose={onClose}>
	<div class="regen">
		<div class="regen-head">
			<ZyetaI variant="badge" />
			<div>
				<p class="cg-kicker" style="margin:0">Regenerate</p>
				<h3>What should ZyetaI redo?</h3>
			</div>
		</div>
		<ul class="ropts">
			{#each LOOK_REGEN_OPTIONS as o (o.mode)}
				<li>
					<button
						type="button"
						class="ropt"
						disabled={session.busy || !hasData}
						onclick={() => onPick(o.mode)}
					>
						<span class="rl">{o.label}</span>
						<span class="rh">{o.hint}</span>
					</button>
				</li>
			{/each}
		</ul>
		<button type="button" class="rcancel" onclick={onClose}>Cancel</button>
	</div>
</Modal>

<style>
	.regen {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: min(420px, 82vw);
	}
	.regen-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.regen h3 {
		margin: 0;
		font-family: var(--font-display, 'Playfair Display', serif);
		font-size: 1.05rem;
		font-weight: 700;
	}
	.ropts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ropt {
		width: 100%;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 9px 11px;
		border-radius: 10px;
		border: 1px solid var(--color-line);
		background: transparent;
		cursor: pointer;
	}
	.ropt:hover:not(:disabled) {
		border-color: var(--color-teal);
	}
	.ropt:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.rl {
		font-size: 12px;
		font-weight: 700;
	}
	.rh {
		font-size: 10px;
		color: var(--color-muted);
	}
	.rcancel {
		align-self: flex-end;
		border: none;
		background: transparent;
		color: var(--color-muted);
		font-size: 11px;
		cursor: pointer;
		padding: 4px 2px;
	}
</style>
