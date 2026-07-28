<script lang="ts">
	import type { RoomState } from '$lib/game/types';
	import { boardTokenSum, formatUsd, tablePersona, tableSeatIndex, sum } from '$lib/game';
	import { session } from '$lib/state';

	/** Bottom grid — per-table AI gen + expand. */
	let {
		room,
		onExpand
	}: {
		room: RoomState;
		onExpand: (src: string, title: string) => void;
	} = $props();

	const tableRows = $derived(
		room.tables.map((t) => {
			const persona = tablePersona(t.id);
			const seat = tableSeatIndex(t.id);
			const bets = (t.board[seat] ?? []).map((n) => Number(n) || 0);
			const tokens = sum(bets) || boardTokenSum(t.board);
			return {
				id: t.id,
				name: persona.name,
				color: persona.color,
				tokens,
				imageUrl: t.imageUrl ?? ''
			};
		})
	);

	let tableBusyId = $state<number | null>(null);
	let tableErr = $state('');

	async function generateTable(tableId: number, tokens: number) {
		if (session.busy || tokens <= 0) return;
		tableErr = '';
		tableBusyId = tableId;
		try {
			const res = await session.generateTableRender(tableId);
			if (!res.url)
				tableErr =
					res.imageError === 'no_key'
						? `Table ${tableId}: needs a FAL_API_KEY on the worker.`
						: `Table ${tableId}: image generation failed — try again.`;
		} catch (e) {
			tableErr = e instanceof Error ? e.message : `Table ${tableId} render failed`;
		} finally {
			tableBusyId = null;
		}
	}

	async function generateAll() {
		if (session.busy) return;
		tableErr = '';
		const ready = tableRows.filter((t) => t.tokens > 0);
		for (const t of ready) {
			tableBusyId = t.id;
			try {
				const res = await session.generateTableRender(t.id);
				if (!res.url)
					tableErr =
						res.imageError === 'no_key'
							? `Table ${t.id}: needs a FAL_API_KEY on the worker.`
							: `Table ${t.id}: image generation failed — try again.`;
			} catch (e) {
				tableErr = e instanceof Error ? e.message : `Table ${t.id} failed`;
				break;
			}
		}
		tableBusyId = null;
	}
</script>

<section class="tables">
	<div class="tables-head">
		<div class="kicker">Table AI · tap image to expand</div>
		<button
			type="button"
			class="gen-all"
			disabled={session.busy || !tableRows.some((t) => t.tokens > 0)}
			onclick={generateAll}
		>
			{tableBusyId !== null ? `T${tableBusyId}…` : 'All tables'}
		</button>
	</div>
	{#if tableErr}
		<p class="err">{tableErr}</p>
	{/if}
	<div class="table-grid">
		{#each tableRows as t (t.id)}
			<div class="tcard" style="border-color: color-mix(in srgb, {t.color} 45%, transparent)">
				<div class="tmeta">
					<span class="dot" style="background:{t.color}"></span>
					<div>
						<div class="tname">T{t.id} · {t.name}</div>
						<div class="ttok">{formatUsd(t.tokens)}</div>
					</div>
				</div>
				{#if t.imageUrl}
					<button
						type="button"
						class="tframe clickable"
						onclick={() => onExpand(t.imageUrl, `T${t.id} · ${t.name}`)}
						aria-label="Expand {t.name} image"
					>
						<img src={t.imageUrl} alt="{t.name} workplace" />
						<span class="texpand">Expand</span>
					</button>
				{:else}
					<div class="tframe">
						<div class="tempty">{t.tokens > 0 ? '—' : '0'}</div>
					</div>
				{/if}
				{#if tableBusyId === t.id}
					<div class="tbusy">
						<div class="spin"></div>
					</div>
				{/if}
				<button
					type="button"
					class="tgen"
					disabled={session.busy || t.tokens <= 0}
					onclick={() => generateTable(t.id, t.tokens)}
				>
					{t.imageUrl ? 'Regen' : 'Gen'}
				</button>
			</div>
		{/each}
	</div>
</section>

<style>
	.tables {
		border-radius: 18px;
		border: 1px solid var(--color-line);
		background: rgba(10, 61, 43, 0.4);
		padding: 16px 18px;
	}
	.tables-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	.kicker {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.gen-all {
		border: none;
		border-radius: 12px;
		padding: 10px 14px;
		font-family: var(--font-display);
		font-weight: 800;
		background: var(--color-gold);
		color: var(--color-on-gold);
		cursor: pointer;
		font-size: 13px;
		white-space: nowrap;
	}
	.gen-all:disabled {
		opacity: 0.4;
	}
	.table-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 10px;
	}
	.tcard {
		position: relative;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: rgba(0, 0, 0, 0.2);
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.tmeta {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.tname {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 12px;
		line-height: 1.2;
	}
	.ttok {
		font-size: 10px;
		color: var(--color-muted);
		font-family: var(--font-mono);
	}
	.tframe {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--color-line);
		background: #0a0f1a;
		width: 100%;
		padding: 0;
		display: block;
	}
	.tframe.clickable {
		cursor: zoom-in;
	}
	.tframe img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.texpand {
		position: absolute;
		right: 6px;
		bottom: 6px;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 800;
		padding: 2px 6px;
		border-radius: 999px;
		background: rgba(10, 15, 26, 0.85);
		border: 1px solid color-mix(in srgb, var(--color-gold) 35%, transparent);
		color: var(--color-gold);
	}
	.tbusy {
		position: absolute;
		inset: 36px 10px 40px;
		display: grid;
		place-items: center;
		background: rgba(7, 11, 20, 0.55);
		border-radius: 8px;
		pointer-events: none;
	}
	.spin {
		width: 28px;
		height: 28px;
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
	.tempty {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		color: var(--color-muted);
	}
	.tgen {
		border: 1px solid var(--color-line);
		border-radius: 8px;
		background: transparent;
		color: var(--color-ink);
		padding: 8px;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}
	.tgen:disabled {
		opacity: 0.35;
	}
	.err {
		color: var(--color-red);
		font-size: 12px;
		margin: 0 0 8px;
	}
</style>
