<script lang="ts">
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import {
		FunctionBoard,
		MobileFinale,
		MobileHeader,
		MobileRender,
		MobileSealed
	} from '$lib/components/phone';
	import {
		CHIP_VALUE,
		emptyMatrix,
		formatUsdFull,
		isCaptureRound,
		ROUND_COUNT,
		SCENARIOS,
		roomScenarios,
		tablePersona,
		tableSeatIndex,
		zeros
	} from '$lib/game';
	import type { Matrix7x7, Vec7 } from '$lib/game/types';
	import { play, session } from '$lib/state';

	type Tab = 'board' | 'render';

	const tableId = $derived(Number(page.params.table));
	const persona = $derived(tablePersona(tableId, session.room));
	const seat = $derived(tableSeatIndex(tableId));
	const table = $derived(session.tables.find((t) => t.id === tableId));
	const roomSyncKey = $derived(
		[
			session.updatedAt,
			session.phase,
			session.round,
			tableId,
			table?.lockedThisRound ? 1 : 0,
		table?.physicallyDone ? 1 : 0
		].join(':')
	);
	const phase = $derived(session.phase);
	const round = $derived(session.room?.round ?? 0);
	const roundLabel = $derived(Math.min(ROUND_COUNT, Math.max(1, round + 1)));
	const roundCount = $derived(session.room?.roundCount ?? ROUND_COUNT);
	const rs = $derived(roomScenarios(session.room));
	const scenario = $derived(rs[Math.min(round, rs.length - 1)] ?? rs[0]);
	const serverRow = $derived((table?.board?.[seat] ?? zeros()) as Vec7);
	const submitted = $derived(!!table?.lockedThisRound);
	const canCapture = $derived(phase === 'round' && isCaptureRound(roundLabel));
	const canEditPhase = $derived(phase === 'round' && !submitted);
	const editable = $derived(canEditPhase && !!table);
	const showQuestion = $derived(phase === 'lobby' || phase === 'round');
	const move = $derived(scenario?.move ?? 'add');
	const removeOnly = $derived(move === 'remove');

	let draft = $state<Vec7>(zeros());
	let baseline = $state<Vec7>(zeros());
	let seeded = $state(false);
	let submitting = $state(false);
	let lastSyncKey = $state('');
	let tab = $state<Tab>('board');

	const isFinale = $derived(phase === 'reveal' || phase === 'finale');
	const physicallyDone = $derived(!!table?.physicallyDone);
	const counts = $derived(editable && seeded ? draft : serverRow);
	const totalTokens = $derived(counts.reduce((a, b) => a + b, 0));
	const standingCap = $derived(baseline.reduce((a, b) => a + b, 0));
	const tableCap = $derived(
		removeOnly ? Math.max(standingCap, totalTokens) : (session.room?.tableBountyTokens ?? 100)
	);
	const overCap = $derived(totalTokens > tableCap);

	/** Whether input is disabled (phase is not 'round' or table is locked) */
	const inputDisabled = $derived(phase !== 'round' || submitted);

	function reseedFromServer() {
		const t = session.tables.find((x) => x.id === tableId);
		if (!t || t.lockedThisRound) {
			seeded = false;
			return;
		}
		const s = tableSeatIndex(tableId);
		const row = ((t.board[s] ?? zeros()) as Vec7).slice() as Vec7;
		draft = row;
		baseline = row.slice() as Vec7;
		seeded = true;
	}

	function boardFromRow(row: Vec7): Matrix7x7 {
		const m = emptyMatrix() as Matrix7x7;
		m[seat] = row.slice() as Vec7;
		return m;
	}

	onMount(() => {
		const id = Number(page.params.table);
		if (id >= 1 && id <= 7) play.pickTable(id);
	});

	$effect(() => {
		// Track only roomSyncKey — all other reads (lastSyncKey, seeded) are
		// untracked so writes to them inside this effect don't re-trigger it.
		const key = roomSyncKey;
		const room = session.room;
		const t = session.tables.find((x) => x.id === tableId);
		if (!room || !t) return;

		const locked = !!t.lockedThisRound;
		const ph = room.phase;

		// --- untracked reads: these are written below, so don't track them ---
		const prev = untrack(() => lastSyncKey);
		const isSeeded = untrack(() => seeded);
		const prevPhase = prev ? prev.split(':')[1] : null;

		if (
			prevPhase &&
			prevPhase !== ph &&
			(ph === 'reveal' || ph === 'finale')
		) {
			tab = 'board';
		}

		if (key !== prev) {
			lastSyncKey = key;
			if (!locked && (ph === 'lobby' || ph === 'round')) {
				reseedFromServer();
			} else if (locked) {
				seeded = false;
			}
		} else if (!isSeeded && !locked && (ph === 'lobby' || ph === 'round')) {
			reseedFromServer();
		}
	});

	/** Single $10M chip delta. */
	function delta(priority: number, d: number) {
		if (!editable || submitting || !d) return;
		if (removeOnly && d > 0) return;
		if (!seeded) {
			const row = serverRow.slice() as Vec7;
			draft = row;
			baseline = row.slice() as Vec7;
			seeded = true;
		}
		const next = draft.slice() as Vec7;
		const cur = next[priority] ?? 0;
		let nextVal = cur + d;
		if (removeOnly) {
			if (nextVal < 0) return;
		} else if (d > 0) {
			const others = next.reduce((a, b, i) => a + (i === priority ? 0 : b), 0);
			if (others + nextVal > tableCap) return;
		}
		if (nextVal === cur || nextVal < 0) return;
		next[priority] = nextVal;
		draft = next;
	}

	function clear(priority: number) {
		if (!editable || submitting || removeOnly) return;
		if (!seeded) {
			draft = serverRow.slice() as Vec7;
			baseline = serverRow.slice() as Vec7;
			seeded = true;
		}
		const next = draft.slice() as Vec7;
		next[priority] = 0;
		draft = next;
	}

	async function onSubmit(e: Event) {
		e.preventDefault();
		if (!editable || submitting || totalTokens <= 0 || overCap || !canCapture) return;
		submitting = true;
		try {
			await session.submitTable(tableId, boardFromRow(draft), { seal: true });
			seeded = false;
		} finally {
			submitting = false;
		}
	}

	async function onSave() {
		if (!editable || submitting || overCap) return;
		submitting = true;
		try {
			await session.submitTable(tableId, boardFromRow(draft), { seal: false });
			seeded = true;
		} finally {
			submitting = false;
		}
	}

	async function onFreeze() {
		if (session.busy) return;
		try {
			await session.tablePhysicallyDone(tableId);
		} catch {
			// Revert on failure — poll will resync
		}
	}
</script>

<svelte:head>
	<title>R{roundLabel} · {persona.name} · LIVE</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main class="shell">
	<MobileHeader
		{persona}
		connected={session.connected}
		{showQuestion}
		{roundLabel}
		{roundCount}
		{phase}
		{scenario}
		{isFinale}
	/>

	{#if !session.room}
		<div class="wait-msg">
			<p class="wait-dot"></p>
			<p class="wait-text">Connecting to session…</p>
		</div>
	{:else if !table || tableId < 1 || tableId > 7}
		<div class="wait-msg">
			<p class="wait-icon">📱</p>
			<p class="wait-text">Scan the QR for your function table (1–7).</p>
		</div>
	{:else if tab === 'render'}
		<MobileRender room={session.room} {tableId} {counts} />
		{#if isFinale}
			<div class="finale-nav">
				<button type="button" class="qbtn" onclick={() => (tab = 'board')}>← Summary</button>
			</div>
		{/if}
	{:else if isFinale}
		<MobileFinale
			{persona}
			{totalTokens}
			{counts}
			onRender={() => (tab = 'render')}
		/>
	{:else if submitted}
		<MobileSealed
			{roundLabel}
			{totalTokens}
			{counts}
			color={persona.color}
		/>
	{:else if phase === 'lobby'}
		{#if !table?.joined}
			<div class="wait-msg">
				<span class="wait-dot"></span>
				<div>
					<p class="wait-heading">Lobby</p>
					<p class="wait-sub">Tap to join — let the presenter know your table is ready.</p>
				</div>
			</div>
			<button
				type="button"
				class="join-btn"
				disabled={session.busy}
				onclick={async () => {
					await session.joinTable(tableId);
				}}
			>
				Enter Lobby
			</button>
		{:else}
			<div class="wait-msg joined">
				<span class="wait-icon">✅</span>
				<div>
					<p class="wait-heading">Joined</p>
					<p class="wait-sub">Waiting for presenter to start Round 1…</p>
				</div>
			</div>
		{/if}
	{:else if phase === 'round' && !canCapture}
		{#if !physicallyDone}
			<div class="wait-msg">
				<span class="wait-icon">🎯</span>
				<div>
					<p class="wait-heading">R{roundLabel} · Add tokens to physical board</p>
					<p class="wait-sub">
						{#if roundLabel === 1}
							Allocate ~$30M tokens across priorities.
						{:else}
							Add ~$20M more. Cumulative position carries forward.
						{/if}
					</p>
				</div>
			</div>
			<button type="button" class="join-btn" disabled={session.busy} onclick={onFreeze}>
				{session.busy ? 'Freezing…' : 'Freeze'}
			</button>
		{:else}
			<div class="wait-msg joined">
				<span class="wait-icon">✅</span>
				<div>
					<p class="wait-heading">Board frozen</p>
					<p class="wait-sub">Waiting for presenter to start next round…</p>
				</div>
			</div>
		{/if}
		{:else if phase === 'round' && !physicallyDone}
			<div class="wait-msg">
				<span class="wait-icon">🎯</span>
				<div>
					<p class="wait-heading">R{roundLabel} · Add tokens to physical board</p>
					<p class="wait-sub">Place tokens on the physical board first, then freeze.</p>
				</div>
			</div>
			<button type="button" class="join-btn" disabled={session.busy} onclick={onFreeze}>
				{session.busy ? 'Freezing…' : 'Freeze'}
			</button>
		{:else if phase === 'round'}
		<form class="board-form" onsubmit={onSubmit}>
			<FunctionBoard
				{counts}
				color={persona.color}
				{editable}
				busy={submitting}
				{move}
				capTokens={tableCap}
				baseline={removeOnly ? baseline : null}
				onDelta={delta}
				onClear={clear}
			/>

			{#if editable}
				{#if canCapture}
					<button
						type="submit"
						class="submit"
						disabled={submitting || (removeOnly ? false : totalTokens <= 0) || overCap}
					>
						{submitting
							? 'Locking in…'
							: removeOnly
								? `Capture R3 · protected ${formatUsdFull(totalTokens)}`
								: totalTokens <= 0
									? 'Add $10M+ tokens to unlock'
									: `Lock in — final for R${roundLabel} · ${formatUsdFull(totalTokens)}`}
					</button>
				{:else}
					<button
						type="button"
						class="submit save"
						disabled={submitting || totalTokens <= 0 || overCap}
						onclick={onSave}
					>
						{submitting ? 'Saving…' : `Save & continue · ${formatUsdFull(totalTokens)}`}
					</button>
					{#if totalTokens <= 0}
						<p class="hint-cap">Place ${CHIP_VALUE}M tokens on the board first.</p>
					{/if}
				{/if}
			{/if}
		</form>
	{:else}
		<div class="wait-msg">
			<span class="wait-dot"></span>
			<p class="wait-text">Kindly wait for the next round.</p>
		</div>
	{/if}
</main>

<style>
	.shell {
		max-width: 560px;
		margin: 0 auto;
		padding-bottom: 32px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	/* ── Waiting state ── */
	.wait-msg {
		margin: 28px 12px;
		padding: 20px 16px;
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.wait-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--color-gold);
		animation: pulse 1.4s ease infinite;
		flex-shrink: 0;
	}
	.wait-icon {
		font-size: 24px;
		flex-shrink: 0;
	}
	.wait-heading {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.1rem;
		margin: 0;
	}
	.wait-sub {
		margin: 4px 0 0;
		font-size: 13px;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.wait-text {
		font-size: 13px;
		color: var(--color-muted);
		margin: 0;
	}
	.join-btn {
		display: block;
		width: calc(100% - 24px);
		margin: 8px 12px 0;
		padding: 16px;
		border: none;
		border-radius: 14px;
		background: var(--color-teal);
		color: var(--color-on-teal);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.1rem;
		cursor: pointer;
		touch-action: manipulation;
	}
	.join-btn:disabled {
		opacity: 0.4;
	}
	.wait-msg.joined {
		border-color: color-mix(in srgb, var(--color-teal) 45%, var(--color-line));
		background: color-mix(in srgb, var(--color-teal) 6%, var(--color-panel));
	}
	@keyframes pulse {
		50% { opacity: 0.35; }
	}
	.finale-nav {
		display: flex;
		gap: 8px;
		padding: 0 12px 16px;
	}
	.qbtn {
		flex: 1;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-gold);
		padding: 14px;
		min-height: 44px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		touch-action: manipulation;
	}
	.board-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 12px 0;
	}
	.submit {
		border: none;
		border-radius: 14px;
		padding: 16px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		background: var(--color-teal);
		color: var(--color-on-teal);
		cursor: pointer;
		position: sticky;
		bottom: calc(8px + env(safe-area-inset-bottom));
		z-index: 10;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
		touch-action: manipulation;
	}
	.submit:disabled {
		opacity: 0.4;
		box-shadow: none;
	}
	.submit.save {
		background: color-mix(in srgb, var(--color-bg) 92%, transparent);
		backdrop-filter: blur(6px);
		border: 1px solid var(--color-gold);
		color: var(--color-gold);
		box-shadow: none;
	}
	.hint-cap {
		margin: 0;
		text-align: center;
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.35;
	}
</style>
