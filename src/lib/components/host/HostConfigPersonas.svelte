<script lang="ts">
	import { PERSONAS } from '$lib/game';
	import type { Persona } from '$lib/game/types';
	import { session } from '$lib/state';

	/**
	 * Function tables — name, lens, mission, strength, risk, colour.
	 * Owns its own unsaved-edit map; the shell remounts this component after a
	 * global "reset overrides" so drafts can't outlive the values they patch.
	 */
	const st = $derived(session.room);

	let dirty = $state<Record<number, Partial<Persona>>>({});
	let savingSeat = $state<number | null>(null);

	function get(seat: number, field: keyof Persona): string {
		const d = dirty[seat];
		if (d && field in d) return ((d as unknown as Record<string, unknown>)[field] as string) ?? '';
		const over = st?.personas?.[seat];
		if (over && field in over)
			return ((over as unknown as Record<string, unknown>)[field] as string) ?? '';
		return ((PERSONAS[seat] as unknown as Record<string, unknown>)[field] as string) ?? '';
	}

	function set(seat: number, field: keyof Persona, value: string) {
		dirty = { ...dirty, [seat]: { ...dirty[seat], [field]: value } };
	}

	function isDirty(seat: number): boolean {
		return !!dirty[seat] && Object.keys(dirty[seat]).length > 0;
	}

	async function save(seat: number) {
		const patch = dirty[seat];
		if (!patch) return;
		savingSeat = seat;
		try {
			await session.setPersona(seat, patch as Record<string, unknown>);
			const next = { ...dirty };
			delete next[seat];
			dirty = next;
		} finally {
			savingSeat = null;
		}
	}
</script>

<p class="text-[11px] text-muted mb-3">Function tables — name, lens, mission, colour.</p>
<div class="space-y-4">
	{#each PERSONAS as p, seat (seat)}
		{@const rowDirty = isDirty(seat)}
		<div
			class="rounded-xl border p-4 space-y-3"
			class:border-gold={rowDirty}
			class:border-line={!rowDirty}
		>
			<div class="flex items-center gap-2.5">
				<span
					class="h-4 w-4 rounded-full shrink-0"
					style="background:{get(seat, 'color') || p.color}"
				></span>
				<span class="font-display font-bold text-sm">{get(seat, 'name') || p.name}</span>
				<span class="font-mono text-[10px] text-muted">T{seat + 1}</span>
				{#if rowDirty}
					<span class="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold-ink"
						>Unsaved</span
					>
				{/if}
			</div>
			<div class="grid gap-2.5 sm:grid-cols-2">
				<label class="block sm:col-span-2">
					<span class="text-[10px] font-semibold text-muted uppercase">Name</span>
					<input
						type="text"
						value={get(seat, 'name')}
						oninput={(e: Event) => set(seat, 'name', (e.target as HTMLInputElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					/>
				</label>
				<label class="block sm:col-span-2">
					<span class="text-[10px] font-semibold text-muted uppercase">Lens</span>
					<input
						type="text"
						value={get(seat, 'lens')}
						oninput={(e: Event) => set(seat, 'lens', (e.target as HTMLInputElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					/>
				</label>
				<label class="block sm:col-span-2">
					<span class="text-[10px] font-semibold text-muted uppercase">Mission</span>
					<textarea
						rows="2"
						value={get(seat, 'mission')}
						oninput={(e: Event) => set(seat, 'mission', (e.target as HTMLTextAreaElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					></textarea>
				</label>
				<label class="block">
					<span class="text-[10px] font-semibold text-muted uppercase">Strength</span>
					<input
						type="text"
						value={get(seat, 'strength')}
						oninput={(e: Event) => set(seat, 'strength', (e.target as HTMLInputElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					/>
				</label>
				<label class="block">
					<span class="text-[10px] font-semibold text-muted uppercase">Risk</span>
					<input
						type="text"
						value={get(seat, 'risk')}
						oninput={(e: Event) => set(seat, 'risk', (e.target as HTMLInputElement).value)}
						class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
					/>
				</label>
				<label class="block sm:col-span-2">
					<span class="text-[10px] font-semibold text-muted uppercase">Color</span>
					<div class="flex items-center gap-2">
						<input
							type="color"
							value={get(seat, 'color') || p.color}
							oninput={(e: Event) => set(seat, 'color', (e.target as HTMLInputElement).value)}
							class="h-9 w-12 rounded border border-line cursor-pointer"
						/>
						<input
							type="text"
							value={get(seat, 'color')}
							oninput={(e: Event) => set(seat, 'color', (e.target as HTMLInputElement).value)}
							class="flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-mono outline-none focus:border-gold"
						/>
					</div>
				</label>
			</div>
			{#if rowDirty}
				<button
					type="button"
					onclick={() => save(seat)}
					disabled={session.busy}
					class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
				>
					{savingSeat === seat ? 'Saving…' : 'Save persona'}
				</button>
			{/if}
		</div>
	{/each}
</div>
