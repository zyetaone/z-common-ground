<script lang="ts">
	import { host, session } from '$lib/state';
	import { formatUsd } from '$lib/game';

	/**
	 * Session controls — analysis force, room wallet, table count, and the
	 * global content-override reset.
	 */
	let { onResetOverrides }: { onResetOverrides: () => void } = $props();

	const st = $derived(session.room);

	async function saveBudget() {
		await session.setConfig({ roomBountyTokens: host.roomBountyTokens });
	}

	async function toggleAnalysisForced() {
		await session.setConfig({ analysisForced: !st?.analysisForced });
	}

	async function applyTableCount() {
		await session.setTableCount(host.tableCount);
		host.resync(session.room);
	}

	async function resetOverrides() {
		if (!confirm('Reset all persona, scenario, and priority overrides to defaults?')) return;
		await session.resetGameConfig();
		// Tell the shell to remount the editor tabs so their unsaved drafts,
		// which patch the values we just reset, cannot linger.
		onResetOverrides();
	}
</script>

<div class="space-y-5">
	<div class="rounded-xl border border-line p-4 space-y-3">
		<div>
			<h3 class="font-display font-bold text-sm">Analysis deck</h3>
			<p class="text-xs text-muted mt-1">
				Force-open the presenter analysis deck before reveal/finale.
			</p>
		</div>
		<button
			type="button"
			onclick={toggleAnalysisForced}
			disabled={session.busy}
			class="rounded-xl px-4 py-2 font-display text-xs font-bold border disabled:opacity-40"
			class:border-teal={st?.analysisForced}
			class:bg-teal={st?.analysisForced}
			class:text-bg={st?.analysisForced}
			class:border-line={!st?.analysisForced}
			class:text-muted={!st?.analysisForced}
		>
			{st?.analysisForced ? 'Analysis forced ON' : 'Analysis forced OFF'}
		</button>
	</div>

	<div class="rounded-xl border border-gold/30 p-4 space-y-3">
		<div class="flex items-center justify-between gap-2">
			<div>
				<h3 class="font-display font-bold text-sm text-gold-ink">Table wallet</h3>
				<p class="text-xs text-muted mt-1">Room pool ($M). Per-table cap = pool ÷ tables.</p>
			</div>
			<button
				type="button"
				onclick={saveBudget}
				disabled={session.busy}
				class="rounded-xl bg-teal px-4 py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
			>
				Save budget
			</button>
		</div>
		<label class="block space-y-1.5">
			<span class="text-xs font-semibold text-muted">Room pool ($M) · default 700</span>
			<input
				type="number"
				min="1"
				max="9999"
				bind:value={host.roomBountyTokens}
				class="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
			/>
		</label>
		<p class="text-xs text-muted">
			~{formatUsd(Math.floor(host.roomBountyTokens / Math.max(1, st?.tables.length ?? 7)))} per table
		</p>
	</div>

	<div class="rounded-xl border border-line p-4 space-y-3">
		<div>
			<h3 class="font-display font-bold text-sm">Table count</h3>
			<p class="text-xs text-muted mt-1">1–7 function tables (applies resize).</p>
		</div>
		<div class="flex items-center gap-4">
			<input
				type="range"
				min="1"
				max="7"
				value={host.tableCount}
				oninput={(e: Event) => {
					host.tableCount = parseInt((e.target as HTMLInputElement).value);
				}}
				class="flex-1 accent-teal"
			/>
			<span class="font-mono text-lg font-bold text-teal-ink min-w-[2ch] text-right"
				>{host.tableCount}</span
			>
		</div>
		<button
			type="button"
			onclick={applyTableCount}
			disabled={session.busy || host.tableCount === (st?.tables.length ?? 7)}
			class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
		>
			Apply table count
		</button>
	</div>

	<div class="rounded-xl border border-line p-4 space-y-3">
		<div>
			<h3 class="font-display font-bold text-sm">Reset content overrides</h3>
			<p class="text-xs text-muted mt-1">
				Clear persona, scenario, and priority edits — back to config defaults. Does not wipe boards.
			</p>
		</div>
		<button
			type="button"
			onclick={resetOverrides}
			disabled={session.busy}
			class="rounded-xl border border-red/50 bg-red/10 px-4 py-2 font-display text-xs font-bold text-red hover:bg-red/20 disabled:opacity-40"
		>
			Reset all overrides
		</button>
	</div>
</div>
