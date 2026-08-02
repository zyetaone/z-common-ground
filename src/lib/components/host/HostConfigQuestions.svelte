<script lang="ts">
	import { SCENARIOS, roomScenarios } from '$lib/game';
	import type { Scenario } from '$lib/game/types';
	import { session } from '$lib/state';

	/**
	 * Round questions (R1–R5) — the copy players see on phone + presenter.
	 * Owns its own unsaved-edit map; the shell remounts this component after a
	 * global "reset overrides" so drafts can't outlive the values they patch.
	 */
	const st = $derived(session.room);
	const rs = $derived(roomScenarios(st));

	let dirty = $state<Record<number, Partial<Scenario>>>({});
	let savingRound = $state<number | null>(null);
	let advanced = $state<Record<number, boolean>>({});

	function get(round: number, field: keyof Scenario): string {
		const d = dirty[round];
		if (d && field in d) return ((d as unknown as Record<string, unknown>)[field] as string) ?? '';
		const over = st?.scenarios?.[round];
		if (over && field in over)
			return ((over as unknown as Record<string, unknown>)[field] as string) ?? '';
		return ((SCENARIOS[round] as unknown as Record<string, unknown>)[field] as string) ?? '';
	}

	function set(round: number, field: keyof Scenario, value: string) {
		dirty = { ...dirty, [round]: { ...dirty[round], [field]: value } };
	}

	function isDirty(round: number): boolean {
		return !!dirty[round] && Object.keys(dirty[round]).length > 0;
	}

	async function save(round: number) {
		const patch = dirty[round];
		if (!patch) return;
		savingRound = round;
		try {
			await session.setScenario(round, patch as Record<string, unknown>);
			const next = { ...dirty };
			delete next[round];
			dirty = next;
		} finally {
			savingRound = null;
		}
	}
</script>

<p class="text-[11px] text-muted mb-4">
	What players see each round on phone + presenter. Current:
	{#if st?.phase === 'round'}
		<span class="text-gold-ink font-mono font-bold">R{(st.round ?? 0) + 1}</span>
		— {rs[st.round]?.question ?? '…'}
	{:else}
		<span class="text-muted">{st?.phase ?? '…'}</span>
	{/if}
</p>
<div class="space-y-4">
	{#each SCENARIOS as s, round (round)}
		{@const rowDirty = isDirty(round)}
		{@const rl = round + 1}
		{@const isCurrent = st?.phase === 'round' && st.round === round}
		<div
			class="rounded-xl border p-4 space-y-3"
			class:border-gold={rowDirty}
			class:border-teal={isCurrent && !rowDirty}
			class:border-line={!rowDirty && !isCurrent}
		>
			<div class="flex items-center gap-2.5 flex-wrap">
				<span class="font-mono font-bold text-sm text-gold-ink">R{rl}</span>
				<span class="text-lg" aria-hidden="true">{get(round, 'emoji') || s.emoji}</span>
				<span class="font-display font-bold text-sm min-w-0 truncate"
					>{get(round, 'title') || s.title}</span
				>
				{#if isCurrent}
					<span class="rounded-full bg-teal/20 px-2 py-0.5 text-[10px] font-bold text-teal-ink"
						>Live round</span
					>
				{/if}
				{#if rowDirty}
					<span class="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold-ink"
						>Unsaved</span
					>
				{/if}
			</div>

			<div class="grid gap-2.5">
				<label class="block">
					<span class="text-[10px] font-semibold text-muted uppercase">Question (hero copy)</span>
					<textarea
						rows="2"
						value={get(round, 'question')}
						oninput={(e: Event) => set(round, 'question', (e.target as HTMLTextAreaElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					></textarea>
				</label>
				<label class="block">
					<span class="text-[10px] font-semibold text-muted uppercase">Hint (phone guidance)</span>
					<textarea
						rows="2"
						value={get(round, 'hint')}
						oninput={(e: Event) => set(round, 'hint', (e.target as HTMLTextAreaElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					></textarea>
				</label>
				<div class="grid sm:grid-cols-2 gap-2.5">
					<label class="block">
						<span class="text-[10px] font-semibold text-muted uppercase">Title</span>
						<input
							type="text"
							value={get(round, 'title')}
							oninput={(e: Event) => set(round, 'title', (e.target as HTMLInputElement).value)}
							class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
						/>
					</label>
					<label class="block">
						<span class="text-[10px] font-semibold text-muted uppercase">Emoji</span>
						<input
							type="text"
							value={get(round, 'emoji')}
							oninput={(e: Event) => set(round, 'emoji', (e.target as HTMLInputElement).value)}
							class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
						/>
					</label>
				</div>
				<label class="block">
					<span class="text-[10px] font-semibold text-muted uppercase"
						>Experience (facilitator read-aloud)</span
					>
					<textarea
						rows="2"
						value={get(round, 'experience')}
						oninput={(e: Event) => set(round, 'experience', (e.target as HTMLTextAreaElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					></textarea>
				</label>
			</div>

			<button
				type="button"
				onclick={() => (advanced = { ...advanced, [round]: !advanced[round] })}
				class="text-[10px] font-bold text-muted hover:text-gold-ink"
			>
				{advanced[round] ? '▾ Hide rules' : '▸ Mode · move · model rules'}
			</button>

			{#if advanced[round]}
				<div class="grid gap-2.5 pt-1 border-t border-line/40">
					<label class="block">
						<span class="text-[10px] font-semibold text-muted uppercase">Instruction</span>
						<input
							type="text"
							value={get(round, 'instruction')}
							oninput={(e: Event) => set(round, 'instruction', (e.target as HTMLInputElement).value)}
							class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
						/>
					</label>
					<label class="block">
						<span class="text-[10px] font-semibold text-muted uppercase">Model rules</span>
						<textarea
							rows="2"
							value={get(round, 'modelRules')}
							oninput={(e: Event) =>
								set(round, 'modelRules', (e.target as HTMLTextAreaElement).value)}
							class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
						></textarea>
					</label>
					<label class="block">
						<span class="text-[10px] font-semibold text-muted uppercase">Actions</span>
						<textarea
							rows="3"
							value={get(round, 'actions')}
							oninput={(e: Event) => set(round, 'actions', (e.target as HTMLTextAreaElement).value)}
							class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
						></textarea>
					</label>
					<div class="flex gap-3">
						<label class="flex-1">
							<span class="text-[10px] font-semibold text-muted uppercase">Mode</span>
							<select
								value={get(round, 'mode')}
								onchange={(e: Event) => set(round, 'mode', (e.target as HTMLSelectElement).value)}
								class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
							>
								<option value="wait">wait</option>
								<option value="capture">capture</option>
								<option value="hold">hold</option>
							</select>
						</label>
						<label class="flex-1">
							<span class="text-[10px] font-semibold text-muted uppercase">Move</span>
							<select
								value={get(round, 'move')}
								onchange={(e: Event) => set(round, 'move', (e.target as HTMLSelectElement).value)}
								class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
							>
								<option value="add">add</option>
								<option value="remove">remove</option>
							</select>
						</label>
					</div>
				</div>
			{/if}

			{#if rowDirty}
				<button
					type="button"
					onclick={() => save(round)}
					disabled={session.busy}
					class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
				>
					{savingRound === round ? 'Saving…' : `Save R${rl} question`}
				</button>
			{/if}
		</div>
	{/each}
</div>
