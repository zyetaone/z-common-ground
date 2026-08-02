<script lang="ts">
	import {
		SCENARIOS,
		PERSONAS,
		PRIORITIES,
		PRIORITY_COLORS,
		roomPriorities,
		roomScenarios
	} from '$lib/game';
	import type { Persona, Scenario } from '$lib/game/types';
	import { host, session } from '$lib/state';

	type ConfigTab = 'questions' | 'options' | 'personas' | 'session';

	let tab = $state<ConfigTab>('questions');
	let dirtyPersonas = $state<Record<number, Partial<Persona>>>({});
	let dirtyScenarios = $state<Record<number, Partial<Scenario>>>({});
	let dirtyPriorities = $state<string[] | null>(null);
	let savingIdx = $state<{ type: string; idx: number } | null>(null);
	let savingPriorities = $state(false);
	let advancedRound = $state<Record<number, boolean>>({});

	const st = $derived(session.room);
	const livePriorities = $derived(roomPriorities(st));
	const rs = $derived(roomScenarios(st));

	function getPersonaField(seat: number, field: keyof Persona): string {
		const d = dirtyPersonas[seat];
		if (d && field in d) return ((d as unknown as Record<string, unknown>)[field] as string) ?? '';
		const over = st?.personas?.[seat];
		if (over && field in over)
			return ((over as unknown as Record<string, unknown>)[field] as string) ?? '';
		return ((PERSONAS[seat] as unknown as Record<string, unknown>)[field] as string) ?? '';
	}

	function setPersonaField(seat: number, field: keyof Persona, value: string) {
		dirtyPersonas = { ...dirtyPersonas, [seat]: { ...dirtyPersonas[seat], [field]: value } };
	}

	function getScenarioField(round: number, field: keyof Scenario): string {
		const d = dirtyScenarios[round];
		if (d && field in d) return ((d as unknown as Record<string, unknown>)[field] as string) ?? '';
		const over = st?.scenarios?.[round];
		if (over && field in over)
			return ((over as unknown as Record<string, unknown>)[field] as string) ?? '';
		return ((SCENARIOS[round] as unknown as Record<string, unknown>)[field] as string) ?? '';
	}

	function setScenarioField(round: number, field: keyof Scenario, value: string) {
		dirtyScenarios = { ...dirtyScenarios, [round]: { ...dirtyScenarios[round], [field]: value } };
	}

	async function savePersona(seat: number) {
		const patch = dirtyPersonas[seat];
		if (!patch) return;
		savingIdx = { type: 'persona', idx: seat };
		await session.setPersona(seat, patch as Record<string, unknown>);
		const next = { ...dirtyPersonas };
		delete next[seat];
		dirtyPersonas = next;
		savingIdx = null;
	}

	async function saveScenario(round: number) {
		const patch = dirtyScenarios[round];
		if (!patch) return;
		savingIdx = { type: 'scenario', idx: round };
		await session.setScenario(round, patch as Record<string, unknown>);
		const next = { ...dirtyScenarios };
		delete next[round];
		dirtyScenarios = next;
		savingIdx = null;
	}

	function isDirtyPersona(seat: number): boolean {
		return !!dirtyPersonas[seat] && Object.keys(dirtyPersonas[seat]).length > 0;
	}

	function isDirtyScenario(round: number): boolean {
		return !!dirtyScenarios[round] && Object.keys(dirtyScenarios[round]).length > 0;
	}

	function priorityDraft(): string[] {
		return dirtyPriorities ?? livePriorities;
	}

	function setPriorityLabel(i: number, value: string) {
		const next = [...priorityDraft()];
		next[i] = value;
		dirtyPriorities = next;
	}

	const prioritiesDirty = $derived(
		!!dirtyPriorities &&
			dirtyPriorities.some((v, i) => (v?.trim() || PRIORITIES[i]) !== livePriorities[i])
	);

	async function savePriorities() {
		if (!dirtyPriorities) return;
		savingPriorities = true;
		try {
			await session.setPriorities(dirtyPriorities.map((v, i) => v.trim() || PRIORITIES[i]));
			dirtyPriorities = null;
		} finally {
			savingPriorities = false;
		}
	}

	async function saveBudget() {
		await session.setConfig({ roomBountyTokens: host.roomBountyTokens });
	}

	async function toggleAnalysisForced() {
		const next = !st?.analysisForced;
		await session.setConfig({ analysisForced: next });
	}

	const tabs: { id: ConfigTab; label: string; hint: string }[] = [
		{ id: 'questions', label: 'Questions', hint: 'Round Q + hints' },
		{ id: 'options', label: 'Options', hint: '7 board labels' },
		{ id: 'personas', label: 'Personas', hint: 'Functions' },
		{ id: 'session', label: 'Session', hint: 'Budget · tables' }
	];
</script>

<section class="rounded-2xl border border-teal/35 bg-panel/40 overflow-hidden">
	<header class="p-5 border-b border-line/40">
		<h2 class="text-[11px] uppercase tracking-[0.26em] text-teal">Content & settings</h2>
		<p class="text-xs text-muted mt-0.5">
			Edit questions, board option names, personas, and session controls. Saves to LIVE (D1).
		</p>
	</header>

	<nav class="flex flex-wrap gap-0 border-b border-line/40 px-2 sm:px-3" aria-label="Config sections">
		{#each tabs as t (t.id)}
			<button
				type="button"
				onclick={() => (tab = t.id)}
				class="px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition text-left"
				class:border-teal={tab === t.id}
				class:text-teal={tab === t.id}
				class:border-transparent={tab !== t.id}
				class:text-muted={tab !== t.id}
			>
				<span class="block">{t.label}</span>
				<span class="block text-[9px] font-normal opacity-70 hidden sm:block">{t.hint}</span>
			</button>
		{/each}
	</nav>

	<div class="p-5 max-h-[min(70vh,720px)] overflow-y-auto">
		<!-- QUESTIONS = scenarios R1–R5 -->
		{#if tab === 'questions'}
			<p class="text-[11px] text-muted mb-4">
				What players see each round on phone + presenter. Current:
				{#if st?.phase === 'round'}
					<span class="text-gold font-mono font-bold">R{(st.round ?? 0) + 1}</span>
					— {rs[st.round]?.question ?? '…'}
				{:else}
					<span class="text-muted">{st?.phase ?? '…'}</span>
				{/if}
			</p>
			<div class="space-y-4">
				{#each SCENARIOS as s, round (round)}
					{@const dirty = isDirtyScenario(round)}
					{@const rl = round + 1}
					{@const isCurrent = st?.phase === 'round' && st.round === round}
					<div
						class="rounded-xl border p-4 space-y-3"
						class:border-gold={dirty}
						class:border-teal={isCurrent && !dirty}
						class:border-line={!dirty && !isCurrent}
					>
						<div class="flex items-center gap-2.5 flex-wrap">
							<span class="font-mono font-bold text-sm text-gold">R{rl}</span>
							<span class="text-lg" aria-hidden="true">{getScenarioField(round, 'emoji') || s.emoji}</span>
							<span class="font-display font-bold text-sm min-w-0 truncate"
								>{getScenarioField(round, 'title') || s.title}</span
							>
							{#if isCurrent}
								<span class="rounded-full bg-teal/20 px-2 py-0.5 text-[10px] font-bold text-teal"
									>Live round</span
								>
							{/if}
							{#if dirty}
								<span class="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold"
									>Unsaved</span
								>
							{/if}
						</div>

						<div class="grid gap-2.5">
							<label class="block">
								<span class="text-[10px] font-semibold text-muted uppercase">Question (hero copy)</span>
								<textarea
									rows="2"
									value={getScenarioField(round, 'question')}
									oninput={(e: Event) =>
										setScenarioField(round, 'question', (e.target as HTMLTextAreaElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								></textarea>
							</label>
							<label class="block">
								<span class="text-[10px] font-semibold text-muted uppercase">Hint (phone guidance)</span>
								<textarea
									rows="2"
									value={getScenarioField(round, 'hint')}
									oninput={(e: Event) =>
										setScenarioField(round, 'hint', (e.target as HTMLTextAreaElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								></textarea>
							</label>
							<div class="grid sm:grid-cols-2 gap-2.5">
								<label class="block">
									<span class="text-[10px] font-semibold text-muted uppercase">Title</span>
									<input
										type="text"
										value={getScenarioField(round, 'title')}
										oninput={(e: Event) =>
											setScenarioField(round, 'title', (e.target as HTMLInputElement).value)}
										class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
									/>
								</label>
								<label class="block">
									<span class="text-[10px] font-semibold text-muted uppercase">Emoji</span>
									<input
										type="text"
										value={getScenarioField(round, 'emoji')}
										oninput={(e: Event) =>
											setScenarioField(round, 'emoji', (e.target as HTMLInputElement).value)}
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
									value={getScenarioField(round, 'experience')}
									oninput={(e: Event) =>
										setScenarioField(round, 'experience', (e.target as HTMLTextAreaElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								></textarea>
							</label>
						</div>

						<button
							type="button"
							onclick={() => (advancedRound = { ...advancedRound, [round]: !advancedRound[round] })}
							class="text-[10px] font-bold text-muted hover:text-gold"
						>
							{advancedRound[round] ? '▾ Hide rules' : '▸ Mode · move · model rules'}
						</button>

						{#if advancedRound[round]}
							<div class="grid gap-2.5 pt-1 border-t border-line/40">
								<label class="block">
									<span class="text-[10px] font-semibold text-muted uppercase">Instruction</span>
									<input
										type="text"
										value={getScenarioField(round, 'instruction')}
										oninput={(e: Event) =>
											setScenarioField(round, 'instruction', (e.target as HTMLInputElement).value)}
										class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
									/>
								</label>
								<label class="block">
									<span class="text-[10px] font-semibold text-muted uppercase">Model rules</span>
									<textarea
										rows="2"
										value={getScenarioField(round, 'modelRules')}
										oninput={(e: Event) =>
											setScenarioField(round, 'modelRules', (e.target as HTMLTextAreaElement).value)}
										class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
									></textarea>
								</label>
								<label class="block">
									<span class="text-[10px] font-semibold text-muted uppercase">Actions</span>
									<textarea
										rows="3"
										value={getScenarioField(round, 'actions')}
										oninput={(e: Event) =>
											setScenarioField(round, 'actions', (e.target as HTMLTextAreaElement).value)}
										class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
									></textarea>
								</label>
								<div class="flex gap-3">
									<label class="flex-1">
										<span class="text-[10px] font-semibold text-muted uppercase">Mode</span>
										<select
											value={getScenarioField(round, 'mode')}
											onchange={(e: Event) =>
												setScenarioField(round, 'mode', (e.target as HTMLSelectElement).value)}
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
											value={getScenarioField(round, 'move')}
											onchange={(e: Event) =>
												setScenarioField(round, 'move', (e.target as HTMLSelectElement).value)}
											class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
										>
											<option value="add">add</option>
											<option value="remove">remove</option>
										</select>
									</label>
								</div>
							</div>
						{/if}

						{#if dirty}
							<button
								type="button"
								onclick={() => saveScenario(round)}
								disabled={session.busy}
								class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
							>
								{savingIdx?.type === 'scenario' && savingIdx?.idx === round
									? 'Saving…'
									: `Save R${rl} question`}
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<!-- OPTIONS = priority labels -->
		{:else if tab === 'options'}
			<div class="space-y-4">
				<div class="rounded-xl border p-4 space-y-3" class:border-gold={prioritiesDirty} class:border-line={!prioritiesDirty}>
					<div>
						<h3 class="font-display font-bold text-sm">Board options (7 priorities)</h3>
						<p class="text-xs text-muted mt-1">
							Labels on phones, boards, and analysis (lead · fault · blind · mix). Order is fixed —
							rename only. Saved to LIVE.
						</p>
					</div>
					<div class="grid gap-2.5">
						{#each priorityDraft() as label, i (i)}
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
									oninput={(e: Event) => setPriorityLabel(i, (e.target as HTMLInputElement).value)}
									placeholder={PRIORITIES[i]}
									class="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold"
								/>
							</label>
						{/each}
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							onclick={savePriorities}
							disabled={session.busy || savingPriorities || !prioritiesDirty}
							class="rounded-xl bg-teal px-5 py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
						>
							{savingPriorities ? 'Saving…' : 'Save option names'}
						</button>
						{#if prioritiesDirty}
							<button
								type="button"
								onclick={() => (dirtyPriorities = null)}
								class="rounded-xl border border-line px-4 py-2 text-xs font-bold text-muted hover:border-gold"
							>
								Discard
							</button>
						{/if}
					</div>
				</div>
			</div>

			<!-- PERSONAS -->
		{:else if tab === 'personas'}
			<p class="text-[11px] text-muted mb-3">Function tables — name, lens, mission, colour.</p>
			<div class="space-y-4">
				{#each PERSONAS as p, seat (seat)}
					{@const dirty = isDirtyPersona(seat)}
					<div class="rounded-xl border p-4 space-y-3" class:border-gold={dirty} class:border-line={!dirty}>
						<div class="flex items-center gap-2.5">
							<span
								class="h-4 w-4 rounded-full shrink-0"
								style="background:{getPersonaField(seat, 'color') || p.color}"
							></span>
							<span class="font-display font-bold text-sm"
								>{getPersonaField(seat, 'name') || p.name}</span
							>
							<span class="font-mono text-[10px] text-muted">T{seat + 1}</span>
							{#if dirty}
								<span class="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold"
									>Unsaved</span
								>
							{/if}
						</div>
						<div class="grid gap-2.5 sm:grid-cols-2">
							<label class="block sm:col-span-2">
								<span class="text-[10px] font-semibold text-muted uppercase">Name</span>
								<input
									type="text"
									value={getPersonaField(seat, 'name')}
									oninput={(e: Event) =>
										setPersonaField(seat, 'name', (e.target as HTMLInputElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								/>
							</label>
							<label class="block sm:col-span-2">
								<span class="text-[10px] font-semibold text-muted uppercase">Lens</span>
								<input
									type="text"
									value={getPersonaField(seat, 'lens')}
									oninput={(e: Event) =>
										setPersonaField(seat, 'lens', (e.target as HTMLInputElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								/>
							</label>
							<label class="block sm:col-span-2">
								<span class="text-[10px] font-semibold text-muted uppercase">Mission</span>
								<textarea
									rows="2"
									value={getPersonaField(seat, 'mission')}
									oninput={(e: Event) =>
										setPersonaField(seat, 'mission', (e.target as HTMLTextAreaElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								></textarea>
							</label>
							<label class="block">
								<span class="text-[10px] font-semibold text-muted uppercase">Strength</span>
								<input
									type="text"
									value={getPersonaField(seat, 'strength')}
									oninput={(e: Event) =>
										setPersonaField(seat, 'strength', (e.target as HTMLInputElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								/>
							</label>
							<label class="block">
								<span class="text-[10px] font-semibold text-muted uppercase">Risk</span>
								<input
									type="text"
									value={getPersonaField(seat, 'risk')}
									oninput={(e: Event) =>
										setPersonaField(seat, 'risk', (e.target as HTMLInputElement).value)}
									class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"
								/>
							</label>
							<label class="block sm:col-span-2">
								<span class="text-[10px] font-semibold text-muted uppercase">Color</span>
								<div class="flex items-center gap-2">
									<input
										type="color"
										value={getPersonaField(seat, 'color') || p.color}
										oninput={(e: Event) =>
											setPersonaField(seat, 'color', (e.target as HTMLInputElement).value)}
										class="h-9 w-12 rounded border border-line cursor-pointer"
									/>
									<input
										type="text"
										value={getPersonaField(seat, 'color')}
										oninput={(e: Event) =>
											setPersonaField(seat, 'color', (e.target as HTMLInputElement).value)}
										class="flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-mono outline-none focus:border-gold"
									/>
								</div>
							</label>
						</div>
						{#if dirty}
							<button
								type="button"
								onclick={() => savePersona(seat)}
								disabled={session.busy}
								class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
							>
								{savingIdx?.type === 'persona' && savingIdx?.idx === seat
									? 'Saving…'
									: 'Save persona'}
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<!-- SESSION -->
		{:else}
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
							<h3 class="font-display font-bold text-sm text-gold">Table wallet</h3>
							<p class="text-xs text-muted mt-1">
								Room pool ($M). Per-table cap = pool ÷ tables.
							</p>
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
						~{Math.floor(host.roomBountyTokens / Math.max(1, st?.tables.length ?? 7))} $M per table
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
						<span class="font-mono text-lg font-bold text-teal min-w-[2ch] text-right"
							>{host.tableCount}</span
						>
					</div>
					<button
						type="button"
						onclick={async () => {
							await session.setTableCount(host.tableCount);
							host.resync(session.room);
						}}
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
							Clear persona, scenario, and priority edits — back to config defaults. Does not wipe
							boards.
						</p>
					</div>
					<button
						type="button"
						onclick={async () => {
							if (!confirm('Reset all persona, scenario, and priority overrides to defaults?')) return;
							await session.resetGameConfig();
							dirtyPersonas = {};
							dirtyScenarios = {};
							dirtyPriorities = null;
						}}
						disabled={session.busy}
						class="rounded-xl border border-red/50 bg-red/10 px-4 py-2 font-display text-xs font-bold text-red hover:bg-red/20 disabled:opacity-40"
					>
						Reset all overrides
					</button>
				</div>
			</div>
		{/if}
	</div>
</section>
