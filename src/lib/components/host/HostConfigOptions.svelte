<script lang="ts">
	import { PRIORITIES, PRIORITY_COLORS, roomPriorities } from '$lib/game';
	import { session } from '$lib/state';

	/**
	 * Board option labels — the 7 priority names shown on phones, boards and the
	 * analysis deck. Order is fixed by the domain; this renames only.
	 */
	const live = $derived(roomPriorities(session.room));

	let draft = $state<string[] | null>(null);
	let saving = $state(false);

	const values = $derived(draft ?? live);
	const dirty = $derived(
		!!draft && draft.some((v, i) => (v?.trim() || PRIORITIES[i]) !== live[i])
	);

	function setLabel(i: number, value: string) {
		const next = [...(draft ?? live)];
		next[i] = value;
		draft = next;
	}

	async function save() {
		if (!draft) return;
		saving = true;
		try {
			await session.setPriorities(draft.map((v, i) => v.trim() || PRIORITIES[i]));
			draft = null;
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-4">
	<div
		class="rounded-xl border p-4 space-y-3"
		class:border-gold={dirty}
		class:border-line={!dirty}
	>
		<div>
			<h3 class="font-display font-bold text-sm">Board options (7 priorities)</h3>
			<p class="text-xs text-muted mt-1">
				Labels on phones, boards, and analysis (lead · fault · blind · mix). Order is fixed —
				rename only. Saved to LIVE.
			</p>
		</div>
		<div class="grid gap-2.5">
			{#each values as label, i (i)}
				<label class="flex items-center gap-2.5">
					<span
						class="h-3.5 w-3.5 rounded-full shrink-0 border border-line"
						style="background:{PRIORITY_COLORS[i]}"
						title="P{i + 1}"
					></span>
					<span class="font-mono text-[10px] text-muted w-6 shrink-0">P{i + 1}</span>
					<input
						type="text"
						value={label}
						oninput={(e: Event) => setLabel(i, (e.target as HTMLInputElement).value)}
						placeholder={PRIORITIES[i]}
						class="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
					/>
				</label>
			{/each}
		</div>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={save}
				disabled={session.busy || saving || !dirty}
				class="rounded-xl bg-teal px-5 py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
			>
				{saving ? 'Saving…' : 'Save option names'}
			</button>
			{#if dirty}
				<button
					type="button"
					onclick={() => (draft = null)}
					class="rounded-xl border border-line px-4 py-2 text-xs font-bold text-muted hover:border-gold"
				>
					Discard
				</button>
			{/if}
		</div>
	</div>
</div>
