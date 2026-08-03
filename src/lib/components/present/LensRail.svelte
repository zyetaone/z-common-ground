<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { priorityMix, roomPriorities, tablePersona } from '$lib/game';
	import { session } from '$lib/state';
	import { futureUi } from './future.svelte';

	/**
	 * Left column of the Look page — one row per function: priority shape plus
	 * its concept still, with per-row generate/regenerate.
	 *
	 * Owns only its own in-flight map; the expand overlay lives on the parent
	 * so a single ExpandImage instance serves both columns.
	 */
	let {
		room,
		hasData,
		onExpand
	}: {
		room: RoomState;
		hasData: boolean;
		/** Ask the parent to open the lightbox for one function's concept. */
		onExpand: (tableId: number, url: string, name: string) => void;
	} = $props();

	const labels = $derived(roomPriorities(room));

	const rows = $derived(
		room.tables.map((t) => {
			const p = tablePersona(t.id, room);
			const lead = priorityMix(t.matrix ?? [], labels).filter((m) => m.pct > 0)[0];
			return {
				id: t.id,
				name: p.name,
				color: p.color,
				lead: lead?.name ?? '—',
				leadPct: lead?.pct ?? 0,
				imageUrl: t.imageUrl as string | undefined,
				hasStake: (t.matrix ?? []).some((n) => n > 0)
			};
		})
	);

	let busyById = $state<Record<number, boolean>>({});

	/** Generate or regenerate a single function's lens concept image. */
	async function generate(tableId: number, name: string) {
		if (busyById[tableId] || session.busy) return;
		busyById = { ...busyById, [tableId]: true };
		futureUi.clearErr();
		// No futureUi.progress here — single renders use the per-row spinner,
		// not the full-pipeline ZyetaIGenerating overlay.
		try {
			const res = await session.generateTableRender(tableId);
			if (res.imageError === 'no_key') {
				futureUi.err = 'Images need FAL_API_KEY on the worker.';
			} else if (!res.url) {
				futureUi.err = res.imageError
					? `${name} failed — try again.`
					: `No image returned for ${name} — check FAL key and try again.`;
			}
		} catch (e) {
			console.error('[LensRail] generate failed:', e);
			futureUi.err = 'Generation failed — try again.';
		} finally {
			busyById = { ...busyById, [tableId]: false };
		}
	}
</script>

<section class="col lenses">
	<header class="col-h">
		<h2>Lenses</h2>
		<span class="sub">Priority shape + concept still</span>
	</header>
	<ul class="lens-list">
		{#each rows as row (row.id)}
			<li class="lens" style="--fn:{row.color}">
				<span class="dot"></span>
				<div class="lens-body">
					<span class="ln">{row.name}</span>
					<span class="ll">{row.leadPct > 0 ? `${row.lead} · ${row.leadPct}%` : 'No stake yet'}</span>
				</div>
				{#if row.imageUrl}
					<span class="thumbwrap">
						<button
							type="button"
							class="thumb"
							onclick={() => onExpand(row.id, row.imageUrl!, row.name)}
							aria-label="Open {row.name} concept"
						>
							<img src={row.imageUrl} alt="" />
						</button>
						<button
							type="button"
							class="lens-regen"
							disabled={session.busy || !!busyById[row.id]}
							onclick={() => generate(row.id, row.name)}
							title="Regenerate {row.name} concept"
							aria-label="Regenerate {row.name} concept"
						>
							{#if busyById[row.id]}<span class="spinner" aria-hidden="true">…</span>{:else}↻{/if}
						</button>
					</span>
				{:else if row.hasStake}
					<button
						type="button"
						class="thumb empty"
						disabled={!!busyById[row.id] || !hasData}
						onclick={() => generate(row.id, row.name)}
						aria-label="Generate {row.name} concept"
						title={hasData ? `Render ${row.name} lens concept` : 'Waiting for stake'}
					>
						{#if busyById[row.id]}
							<span class="spinner" aria-hidden="true">…</span>
						{:else}
							<span class="gen-mark">+</span>
						{/if}
					</button>
				{:else}
					<span class="thumb empty" aria-hidden="true"></span>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.col {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-panel) 60%, transparent);
		padding: 12px;
	}
	.col-h {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.col-h h2 {
		margin: 0;
		font-family: var(--font-display, 'Playfair Display', serif);
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.sub {
		font-size: 10px;
		color: var(--color-muted);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.lens-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.lens {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--fn) 28%, transparent);
		background: color-mix(in srgb, var(--fn) 7%, transparent);
		min-width: 0;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--fn);
		flex: none;
	}
	.lens-body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.ln {
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.ll {
		font-size: 10px;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.thumb {
		width: 54px;
		height: 34px;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--fn) 40%, transparent);
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
		padding: 0;
		cursor: pointer;
		flex: none;
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.thumbwrap {
		position: relative;
		flex: none;
		display: inline-flex;
	}
	.lens-regen {
		position: absolute;
		right: -6px;
		top: -6px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		color: var(--color-ink);
		font-size: 10px;
		line-height: 1;
		display: grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
	}
	.lens-regen:hover:not(:disabled) {
		border-color: var(--color-teal);
	}
	/* 44×44 hit slot over the 20px face (StageNav dot pattern) */
	.lens-regen::after {
		content: '';
		position: absolute;
		inset: -12px;
	}
	.lens-regen:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.thumb.empty {
		display: grid;
		place-items: center;
		border-style: dashed;
		color: var(--color-muted);
	}
	.thumb.empty:hover:not(:disabled) {
		border-color: var(--color-teal);
		color: var(--color-teal-ink);
	}
	.thumb.empty:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.gen-mark {
		font-size: 14px;
		line-height: 1;
	}
	.spinner {
		animation: spin 1s linear infinite;
		display: inline-block;
	}
</style>
