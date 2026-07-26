<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import ExpandImage from '$lib/components/ExpandImage.svelte';
	import ZyetaI from '$lib/components/ZyetaI.svelte';
	import { session } from '$lib/state';
	import FutureBrief from './FutureBrief.svelte';
	import FutureRoomGen from './FutureRoomGen.svelte';
	import FutureTableGrid from './FutureTableGrid.svelte';
	import { futureUi } from './future.svelte';

	/** Future screen shell — brief · room gen · table grid. */
	let { room }: { room: RoomState } = $props();

	const hasData = $derived(room.aggregate.totalCoins > 0);
	const imageUrl = $derived(room.finaleImageUrl ?? '');
	const brief = $derived(room.enhancedBrief ?? '');
	const briefSource = $derived(room.briefSource);

	let editableBrief = $state('');
	let copiedBrief = $state(false);
	let expandOpen = $state(false);
	let expandSrc = $state('');
	let expandTitle = $state('Workplace');

	function openExpand(src: string, title: string) {
		if (!src) return;
		expandSrc = src;
		expandTitle = title;
		expandOpen = true;
	}

	function openBriefEditor() {
		editableBrief = brief || '';
		futureUi.openBrief();
	}

	function copyBrief() {
		const text = editableBrief || brief;
		if (typeof navigator !== 'undefined' && navigator.clipboard && text) {
			navigator.clipboard.writeText(text);
			copiedBrief = true;
			setTimeout(() => (copiedBrief = false), 2000);
		}
	}

	async function generateRoom() {
		if (session.busy || !hasData) return;
		futureUi.clearErr();
		futureUi.progress = 'ZyetaI writing brief…';
		try {
			futureUi.progress = 'Rendering room…';
			const res = await session.generateFinale();
			if (!res.url)
				futureUi.err =
					res.imageError === 'no_key'
						? 'Image needs a FAL_API_KEY on the worker.'
						: 'Image generation failed — try again.';
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'Generation failed';
		} finally {
			futureUi.progress = '';
		}
	}

	async function generateBriefOnly() {
		if (session.busy || !hasData) return;
		futureUi.clearErr();
		futureUi.progress = 'ZyetaI writing brief…';
		try {
			const res = await session.generateBrief();
			if (!res.llama) futureUi.err = 'ZyetaI unavailable — numbers brief only.';
			openBriefEditor();
		} catch (e) {
			futureUi.err = e instanceof Error ? e.message : 'Brief failed';
		} finally {
			futureUi.progress = '';
		}
	}
</script>

<div class="fw">
	<FutureBrief room={room} onOpenBrief={openBriefEditor} onRegenBrief={generateBriefOnly} />
	<FutureRoomGen
		{imageUrl}
		{hasData}
		onGenerate={generateRoom}
		onExpand={openExpand}
	/>
	<div class="full">
		<FutureTableGrid room={room} onExpand={openExpand} />
	</div>
</div>

<ExpandImage bind:open={expandOpen} src={expandSrc} title={expandTitle} />

{#if futureUi.briefOpen && brief}
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-label="Design brief"
		tabindex="-1"
		onclick={() => futureUi.closeBrief()}
		onkeydown={(e) => e.key === 'Escape' && futureUi.closeBrief()}
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
		<div class="sheet" role="document" onclick={(e) => e.stopPropagation()}>
			<header>
				<div>
					<div class="kicker">
						{briefSource === 'llama' ? 'Brief · ZyetaI' : 'Brief · numbers'}
					</div>
					<h3>Future workplace</h3>
					<ZyetaI compact />
				</div>
				<button type="button" class="x" onclick={() => futureUi.closeBrief()}>Close</button>
			</header>
			<div class="space-y-3 mt-3 text-left">
				<p class="text-xs text-muted">Edit the brief, then save or copy.</p>
				<textarea
					class="w-full rounded-2xl border border-line bg-black/60 p-4 font-mono text-xs text-ink focus:border-gold focus:outline-none leading-relaxed"
					rows="14"
					bind:value={editableBrief}
				></textarea>
				<div class="flex flex-wrap gap-2 pt-2">
					<button
						type="button"
						class="rounded-xl bg-gold px-4 py-2.5 font-display text-xs font-bold text-[#241a05]"
						onclick={() => session.updateBrief(editableBrief)}
					>
						Save edits
					</button>
					<button
						type="button"
						class="rounded-xl bg-teal px-4 py-2.5 font-display text-xs font-bold text-[#04140f]"
						onclick={copyBrief}
					>
						{copiedBrief ? '✓ Copied' : 'Copy'}
					</button>
					<button
						type="button"
						class="rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-muted"
						disabled={session.busy || !hasData}
						onclick={generateBriefOnly}
					>
						Regen AI
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.fw {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 18px;
		height: 100%;
		min-height: 0;
		align-items: start;
		overflow: auto;
	}
	@media (max-width: 1000px) {
		.fw {
			grid-template-columns: 1fr;
		}
	}
	.full {
		grid-column: 1 / -1;
	}
	.modal {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(0, 0, 0, 0.65);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}
	.sheet {
		width: min(640px, 100%);
		max-height: min(80vh, 720px);
		overflow: auto;
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: var(--color-bg2);
		padding: 20px;
	}
	.sheet header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.sheet h3 {
		margin: 4px 0 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
	}
	.x {
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		border-radius: 8px;
		padding: 8px 12px;
		cursor: pointer;
		font-size: 12px;
	}
</style>
