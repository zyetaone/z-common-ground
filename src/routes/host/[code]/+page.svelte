<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ROUND_COUNT, SCENARIOS, PERSONAS, PRIORITIES,
		boardTokenSum, formatUsd, tablePersona,
		roomPersonas, roomScenarios
	} from '$lib/game';
	import { host, SESSION, session } from '$lib/state';
	import type { Persona, Scenario } from '$lib/game/types';

	onMount(() => {
		host.syncOnce(session.room);
	});

	const st = $derived(session.room);
	const rp = $derived(roomPersonas(st));
	const rs = $derived(roomScenarios(st));
	const scenario = $derived(rs[st?.round ?? 0]);

	// ── Game Config editor state ──
	let configOpen = $state(false);
	let configTab = $state<'personas' | 'scenarios' | 'settings'>('personas');

	// Track dirty edits per-persona / per-round
	let dirtyPersonas = $state<Record<number, Partial<Persona>>>({});
	let dirtyScenarios = $state<Record<number, Partial<Scenario>>>({});
	let savingIdx = $state<{ type: string; idx: number } | null>(null);

	function getPersonaField(seat: number, field: keyof Persona): string {
		const d = dirtyPersonas[seat];
		if (d && field in d) return (d as unknown as Record<string, unknown>)[field] as string ?? '';
		const over = st?.personas?.[seat];
		if (over && field in over) return (over as unknown as Record<string, unknown>)[field] as string ?? '';
		return (PERSONAS[seat] as unknown as Record<string, unknown>)[field] as string ?? '';
	}

	function setPersonaField(seat: number, field: keyof Persona, value: string) {
		dirtyPersonas = { ...dirtyPersonas, [seat]: { ...dirtyPersonas[seat], [field]: value } };
	}

	function getScenarioField(round: number, field: keyof Scenario): string {
		const d = dirtyScenarios[round];
		if (d && field in d) return (d as unknown as Record<string, unknown>)[field] as string ?? '';
		const over = st?.scenarios?.[round];
		if (over && field in over) return (over as unknown as Record<string, unknown>)[field] as string ?? '';
		return (SCENARIOS[round] as unknown as Record<string, unknown>)[field] as string ?? '';
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

	const imageCount = $derived(
		(st?.finaleImageUrl ? 1 : 0) +
		(st?.tables.filter((t) => t.imageUrl).length ?? 0)
	);

	async function saveBudget() {
		await session.setConfig({ roomBountyTokens: host.roomBountyTokens });
	}

	async function resetSession() {
		if (!confirm('Delete / reset the whole session? Boards clear.')) return;
		await session.ensure({ reset: true, tableCount: host.tableCount });
		host.resync(session.room);
	}

	function downloadImage(url: string, name: string) {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.target = '_blank';
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function downloadAll() {
		const urls: { url: string; name: string }[] = [];
		if (st?.finaleImageUrl) urls.push({ url: st.finaleImageUrl, name: 'finale-room.png' });
		for (const t of st?.tables ?? []) {
			if (t.imageUrl) {
				const fn = tablePersona(t.id, st);
				urls.push({ url: t.imageUrl, name: `table-${t.id}-${fn.name.toLowerCase().replace(/\s+/g, '-')}.png` });
			}
		}
		urls.forEach((u, i) => setTimeout(() => downloadImage(u.url, u.name), i * 500));
	}

	function exportSessionJSON() {
		if (!st) return;
		const blob = new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `common-ground-session-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(a.href);
	}
</script>

<svelte:head>
	<title>Host · LIVE</title>
</svelte:head>

<main class="mx-auto max-w-4xl px-6 py-10">
	<header class="mb-8">
		<p class="font-mono text-xs uppercase tracking-[0.3em] text-gold">Host controls</p>
		<h1 class="font-display mt-2 text-4xl font-bold">COMMON <span class="text-gold">GROUND</span></h1>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2">
				<span class="font-mono text-xl font-bold tracking-widest text-ink">SESSION: LIVE</span>
				<span class="font-mono text-xs uppercase tracking-widest font-semibold"
					class:text-teal={session.connected} class:text-muted={!session.connected}>
					{session.connected ? '● Connected' : '○ Offline'}
				</span>
			</div>
			<a href="/present/{SESSION}" target="_blank" class="rounded-xl border border-gold/50 px-4 py-2 font-display text-sm font-bold text-gold hover:bg-gold/10">
				Presenter →
			</a>
			<a href="/" target="_blank" class="rounded-xl border border-line px-4 py-2 text-sm hover:border-gold">
				Table Directory
			</a>
		</div>
	</header>

	<div class="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
		<!-- LEFT COLUMN -->
		<div class="space-y-6">
			<!-- Status -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5">
				<h2 class="mb-2 text-[11px] uppercase tracking-[0.26em] text-muted">Status</h2>
				{#if st?.phase === 'round' && scenario}
					<div class="text-sm">
						<span class="font-mono text-gold font-bold">R{st.round + 1}</span>
						<span class="text-muted"> · {scenario.question}</span>
					</div>
				{:else if st?.phase === 'lobby'}
					<p class="text-sm text-muted">Lobby — presenter starts R1 when ready.</p>
				{:else}
					<p class="text-sm text-muted">Phase: {st?.phase ?? '…'}</p>
				{/if}
				<div class="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line/40 pt-3">
					<div class="flex flex-wrap gap-1.5">
						{#each Array(ROUND_COUNT) as _, i (i)}
							{@const r = i + 1}
							{@const cur = st?.phase === 'round' && (st?.round ?? 0) + 1 === r}
							{@const past = st?.phase === 'round' ? (st?.round ?? 0) + 1 > r : st?.phase === 'reveal' || st?.phase === 'finale'}
							<span class="rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
								class:border-teal={cur} class:bg-teal={cur} class:text-bg={cur}
								class:border-gold={[2,3,5].includes(r) && !cur} class:text-gold={[2,3,5].includes(r) && !cur}
								class:border-line={!cur && ![2,3,5].includes(r)} class:text-muted={!cur && ![2,3,5].includes(r)}
								class:opacity-50={past && !cur}>R{r}{[2,3,5].includes(r) ? '◉' : ''}</span>
						{/each}
					</div>
					<div class="text-right">
						<div class="text-2xl font-bold text-teal">
							{st?.tables.filter((t) => t.lockedThisRound).length ?? 0}
							<span class="text-base text-muted">/{st?.tables.length ?? 0}</span>
						</div>
						<div class="text-[10px] uppercase tracking-widest text-muted">captured</div>
					</div>
				</div>
			</section>

			<!-- Table Controls -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5">
				<div class="flex items-center justify-between mb-2">
					<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Tables ({st?.tables.length ?? 0})</h2>
					<button type="button" onclick={() => { configOpen = !configOpen; configTab = 'settings'; }}
						class="rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold">Edit</button>
				</div>
				<div class="grid gap-2.5">
					{#each st?.tables ?? [] as t (t.id)}
						{@const fn = tablePersona(t.id, st)}
						<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg/50 p-3">
							<div class="flex items-center gap-3 min-w-0">
								<span class="h-3 w-3 shrink-0 rounded-full" style="background:{fn.color}"></span>
								<div class="min-w-0">
									<div class="font-display font-bold text-sm truncate">Table {t.id} · {fn.name}</div>
									<div class="text-xs text-muted">
										{formatUsd(boardTokenSum(t.board))} ·
										<b class={t.lockedThisRound ? 'text-teal' : 'text-gold'}>{t.lockedThisRound ? 'submitted' : 'open'}</b>
									</div>
								</div>
							</div>
							<div class="flex gap-2 shrink-0">
								<a href="/play/{SESSION}/{t.id}" target="_blank" class="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-gold">Open</a>
								{#if t.lockedThisRound}
									<button type="button" onclick={() => session.unlockTable(t.id)} disabled={session.busy}
										class="rounded-lg border border-teal px-3 py-1.5 text-xs text-teal hover:bg-teal/10 disabled:opacity-40">Unlock</button>
								{:else}
									<button type="button" onclick={() => session.lockTable(t.id)} disabled={session.busy}
										class="rounded-lg border border-gold px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40">Lock</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>

			<!-- Game Config Editor -->
			<section class="rounded-2xl border border-teal/30 bg-panel/40 overflow-hidden">
				<button type="button" onclick={() => (configOpen = !configOpen)}
					class="flex w-full items-center justify-between p-5 text-left hover:bg-bg/30">
					<div>
						<h2 class="text-[11px] uppercase tracking-[0.26em] text-teal">Game Config</h2>
						<p class="text-xs text-muted mt-0.5">Edit personas, round questions, table count. Changes persist live.</p>
					</div>
					<span class="text-teal text-lg">{configOpen ? '▾' : '▸'}</span>
				</button>

				{#if configOpen}
					<div class="border-t border-line/40">
						<!-- Tabs -->
						<nav class="flex border-b border-line/40 px-5">
							<button type="button" onclick={() => (configTab = 'personas')}
								class="px-4 py-2.5 text-xs font-semibold border-b-2 transition"
								class:border-teal={configTab === 'personas'} class:text-teal={configTab === 'personas'}
								class:border-transparent={configTab !== 'personas'} class:text-muted={configTab !== 'personas'}>
								Personas
							</button>
							<button type="button" onclick={() => (configTab = 'scenarios')}
								class="px-4 py-2.5 text-xs font-semibold border-b-2 transition"
								class:border-teal={configTab === 'scenarios'} class:text-teal={configTab === 'scenarios'}
								class:border-transparent={configTab !== 'scenarios'} class:text-muted={configTab !== 'scenarios'}>
								Scenarios
							</button>
							<button type="button" onclick={() => (configTab = 'settings')}
								class="px-4 py-2.5 text-xs font-semibold border-b-2 transition"
								class:border-teal={configTab === 'settings'} class:text-teal={configTab === 'settings'}
								class:border-transparent={configTab !== 'settings'} class:text-muted={configTab !== 'settings'}>
								Settings
							</button>
						</nav>

						<div class="p-5 max-h-[60vh] overflow-y-auto">
							<!-- PERSONAS TAB -->
							{#if configTab === 'personas'}
								<div class="space-y-4">
									{#each PERSONAS as p, seat (seat)}
										{@const dirty = isDirtyPersona(seat)}
										<div class="rounded-xl border p-4 space-y-3" class:border-gold={dirty} class:border-line={!dirty}>
											<div class="flex items-center gap-2.5">
												<span class="h-4 w-4 rounded-full shrink-0" style="background:{getPersonaField(seat, 'color') || p.color}"></span>
												<span class="font-display font-bold text-sm">{getPersonaField(seat, 'name') || p.name}</span>
												<span class="font-mono text-[10px] text-muted">Seat {seat}</span>
												{#if dirty}
													<span class="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">Unsaved</span>
												{/if}
											</div>

											<div class="grid gap-2.5">
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Name</span>
													<input type="text" value={getPersonaField(seat, 'name')}
														oninput={(e: Event) => setPersonaField(seat, 'name', (e.target as HTMLInputElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold" />
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Lens</span>
													<input type="text" value={getPersonaField(seat, 'lens')}
														oninput={(e: Event) => setPersonaField(seat, 'lens', (e.target as HTMLInputElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold" />
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Mission</span>
													<input type="text" value={getPersonaField(seat, 'mission')}
														oninput={(e: Event) => setPersonaField(seat, 'mission', (e.target as HTMLInputElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold" />
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Color (hex)</span>
													<div class="flex items-center gap-2">
														<input type="color" value={getPersonaField(seat, 'color') || p.color}
															oninput={(e: Event) => setPersonaField(seat, 'color', (e.target as HTMLInputElement).value)}
															class="h-8 w-10 rounded border border-line cursor-pointer" />
														<input type="text" value={getPersonaField(seat, 'color')}
															oninput={(e: Event) => setPersonaField(seat, 'color', (e.target as HTMLInputElement).value)}
															class="flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-mono outline-none focus:border-gold" />
													</div>
												</label>
											</div>

											{#if dirty}
												<button type="button" onclick={() => savePersona(seat)} disabled={session.busy}
													class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40">
													{savingIdx?.type === 'persona' && savingIdx?.idx === seat ? 'Saving…' : 'Save Persona'}
												</button>
											{/if}
										</div>
									{/each}
								</div>

							<!-- SCENARIOS TAB -->
							{:else if configTab === 'scenarios'}
								<div class="space-y-4">
									{#each SCENARIOS as s, round (round)}
										{@const dirty = isDirtyScenario(round)}
										{@const rl = round + 1}
										<div class="rounded-xl border p-4 space-y-3" class:border-gold={dirty} class:border-line={!dirty}>
											<div class="flex items-center gap-2.5">
												<span class="font-mono font-bold text-sm text-gold">R{rl}</span>
												<span class="font-display font-bold text-sm">{getScenarioField(round, 'title') || s.title}</span>
												{#if dirty}
													<span class="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-gold">Unsaved</span>
												{/if}
											</div>

											<div class="grid gap-2.5">
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Emoji</span>
													<input type="text" value={getScenarioField(round, 'emoji')}
														oninput={(e: Event) => setScenarioField(round, 'emoji', (e.target as HTMLInputElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold" />
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Title</span>
													<input type="text" value={getScenarioField(round, 'title')}
														oninput={(e: Event) => setScenarioField(round, 'title', (e.target as HTMLInputElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold" />
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Question</span>
													<input type="text" value={getScenarioField(round, 'question')}
														oninput={(e: Event) => setScenarioField(round, 'question', (e.target as HTMLInputElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold" />
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Hint</span>
													<textarea rows="2" value={getScenarioField(round, 'hint')}
														oninput={(e: Event) => setScenarioField(round, 'hint', (e.target as HTMLTextAreaElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"></textarea>
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Instruction</span>
													<input type="text" value={getScenarioField(round, 'instruction')}
														oninput={(e: Event) => setScenarioField(round, 'instruction', (e.target as HTMLInputElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold" />
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Model Rules</span>
													<textarea rows="2" value={getScenarioField(round, 'modelRules')}
														oninput={(e: Event) => setScenarioField(round, 'modelRules', (e.target as HTMLTextAreaElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"></textarea>
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Actions (numbered steps)</span>
													<textarea rows="4" value={getScenarioField(round, 'actions')}
														oninput={(e: Event) => setScenarioField(round, 'actions', (e.target as HTMLTextAreaElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"></textarea>
												</label>
												<label class="block">
													<span class="text-[10px] font-semibold text-muted uppercase">Experience (facilitator narrative)</span>
													<textarea rows="3" value={getScenarioField(round, 'experience')}
														oninput={(e: Event) => setScenarioField(round, 'experience', (e.target as HTMLTextAreaElement).value)}
														class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold"></textarea>
												</label>
												<div class="flex gap-3">
													<label class="flex-1">
														<span class="text-[10px] font-semibold text-muted uppercase">Mode</span>
														<select value={getScenarioField(round, 'mode')}
															onchange={(e: Event) => setScenarioField(round, 'mode', (e.target as HTMLSelectElement).value)}
															class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold">
															<option value="wait">wait</option>
															<option value="capture">capture</option>
															<option value="hold">hold</option>
														</select>
													</label>
													<label class="flex-1">
														<span class="text-[10px] font-semibold text-muted uppercase">Move</span>
														<select value={getScenarioField(round, 'move')}
															onchange={(e: Event) => setScenarioField(round, 'move', (e.target as HTMLSelectElement).value)}
															class="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm outline-none focus:border-gold">
															<option value="add">add</option>
															<option value="remove">remove</option>
														</select>
													</label>
												</div>
											</div>

											{#if dirty}
												<button type="button" onclick={() => saveScenario(round)} disabled={session.busy}
													class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40">
													{savingIdx?.type === 'scenario' && savingIdx?.idx === round ? 'Saving…' : 'Save Round {rl}'}
												</button>
											{/if}
										</div>
									{/each}
								</div>

							<!-- SETTINGS TAB -->
							{:else if configTab === 'settings'}
								<div class="space-y-5">
									<div class="rounded-xl border border-line p-4 space-y-3">
										<div>
											<h3 class="font-display font-bold text-sm">Table Count</h3>
											<p class="text-xs text-muted mt-1">Number of function tables (1–7). Changing this resizes the tables array.</p>
										</div>
										<div class="flex items-center gap-4">
											<input type="range" min="1" max="7" value={st?.tables.length ?? 7}
												oninput={(e: Event) => {
													const v = parseInt((e.target as HTMLInputElement).value);
													host.tableCount = v;
												}}
												class="flex-1 accent-teal" />
											<span class="font-mono text-lg font-bold text-teal min-w-[2ch] text-right">{host.tableCount}</span>
										</div>
										<button type="button" onclick={async () => {
											await session.setTableCount(host.tableCount);
											host.resync(session.room);
										}} disabled={session.busy || host.tableCount === (st?.tables.length ?? 7)}
											class="w-full rounded-xl bg-teal py-2 font-display text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40">
											Apply Table Count
										</button>
									</div>

									<div class="rounded-xl border border-line p-4 space-y-3">
										<div>
											<h3 class="font-display font-bold text-sm">Priorities</h3>
											<p class="text-xs text-muted mt-1">The 7 investment priorities (read-only — edit in config.ts).</p>
										</div>
										<div class="flex flex-wrap gap-1.5">
											{#each PRIORITIES as prio}
												<span class="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">{prio}</span>
											{/each}
										</div>
									</div>

									<div class="rounded-xl border border-line p-4 space-y-3">
										<div>
											<h3 class="font-display font-bold text-sm">Reset Overrides</h3>
											<p class="text-xs text-muted mt-1">Clear all persona & scenario overrides, reverting to defaults.</p>
										</div>
										<button type="button" onclick={async () => {
											if (!confirm('Reset all persona and scenario overrides to defaults?')) return;
											for (let i = 0; i < 7; i++) await session.setPersona(i, {});
											for (let i = 0; i < 5; i++) await session.setScenario(i, {});
										}} disabled={session.busy}
											class="rounded-xl border border-red/50 bg-red/10 px-4 py-2 font-display text-xs font-bold text-red hover:bg-red/20 disabled:opacity-40">
											Reset All Overrides
										</button>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</section>
		</div>

		<!-- RIGHT COLUMN -->
		<div class="space-y-6">
			<!-- Budget -->
			<section class="rounded-2xl border border-gold/30 bg-panel/40 p-5 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-[11px] uppercase tracking-[0.26em] text-gold">Room Budget</h2>
						<p class="text-xs text-muted">Total to split across {st?.tables.length ?? 7} tables. Save live — phones pick it up.</p>
					</div>
					<button type="button" onclick={saveBudget} disabled={session.busy}
						class="rounded-xl bg-gold px-5 py-2 font-display text-sm font-bold text-[var(--color-on-gold)] shadow hover:bg-gold/90 disabled:opacity-40">
						Save Budget
					</button>
				</div>
				<label class="block space-y-1.5">
					<span class="text-xs font-semibold text-muted">Room budget ($M)</span>
					<input type="number" min="1" max="9999" bind:value={host.roomBountyTokens}
						class="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-gold" />
				</label>
				<p class="text-xs text-muted">
					≈ {formatUsd(Math.floor(host.roomBountyTokens / Math.max(1, st?.tables.length ?? 7)))} per table
				</p>
			</section>

			<!-- Export -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5 space-y-3">
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Session Data</h2>
				<p class="text-xs text-muted">Download full session state as JSON for backup or analysis.</p>
				<button type="button" onclick={exportSessionJSON} disabled={!st}
					class="rounded-xl border border-line px-4 py-2 font-display text-xs font-bold hover:border-gold disabled:opacity-30">
					Export JSON ↓
				</button>
			</section>

			<!-- Generated Images -->
			<section class="rounded-2xl border border-line bg-panel/40 p-5 space-y-3">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Generated Images</h2>
						<p class="text-xs text-muted">
							{#if imageCount > 0}{imageCount} image{imageCount === 1 ? '' : 's'}{:else}None yet{/if}
						</p>
					</div>
					{#if imageCount > 0}
						<button type="button" onclick={downloadAll}
							class="rounded-xl bg-teal px-4 py-2 font-display text-xs font-bold text-[var(--color-on-teal)] shadow hover:bg-teal/90">Save All ↓</button>
					{/if}
				</div>

				{#if imageCount > 0}
					<div class="grid gap-2">
						{#if st?.finaleImageUrl}
							<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
								<img src={st.finaleImageUrl} alt="Room finale" class="h-14 w-24 shrink-0 rounded-lg border border-line object-cover" loading="lazy" />
								<div class="flex-1 min-w-0">
									<div class="font-display font-bold text-xs">Room Finale</div>
								</div>
								<button type="button" onclick={() => downloadImage(st.finaleImageUrl!, 'finale-room.png')}
									class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold">Save</button>
							</div>
						{/if}
						{#each st?.tables ?? [] as t (t.id)}
							{#if t.imageUrl}
								{@const fn = tablePersona(t.id, st)}
								<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
									<img src={t.imageUrl} alt="Table {t.id} render" class="h-14 w-24 shrink-0 rounded-lg border border-line object-cover" loading="lazy" />
									<div class="flex-1 min-w-0">
										<div class="font-display font-bold text-xs">T{t.id} · {fn.name}</div>
									</div>
									<button type="button"
										onclick={() => downloadImage(t.imageUrl!, `table-${t.id}-${fn.name.toLowerCase().replace(/\s+/g, '-')}.png`)}
										class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold">Save</button>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</section>

			<!-- Reset -->
			<section class="rounded-2xl border border-red/30 bg-panel/40 p-5 space-y-3">
				<h2 class="text-[11px] uppercase tracking-[0.26em] text-red">Reset Session</h2>
				<p class="text-xs text-muted">Wipe all table boards & reset to fresh lobby state.</p>
				<button type="button" onclick={resetSession} disabled={session.busy}
					class="rounded-xl border border-red/50 bg-red/10 px-4 py-2 font-display text-xs font-bold text-red hover:bg-red/20 disabled:opacity-40">Reset Whole Session</button>
			</section>
		</div>
	</div>
</main>
