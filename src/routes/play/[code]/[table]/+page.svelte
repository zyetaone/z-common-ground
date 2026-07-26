<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		FunctionBoard,
		MobileFinale,
		MobileHeader,
		MobileRender,
		MobileSealed
	} from '$lib/components/phone';
	import {
		emptyMatrix,
		formatUsd,
		formatUsdFull,
		isCaptureRound,
		ROUND_COUNT,
		SCENARIOS,
		tablePersona,
		tableSeatIndex
	} from '$lib/game';
	import type { Matrix7x7, Vec7 } from '$lib/game/types';
	import { play, session } from '$lib/state';

	type Tab = 'board' | 'render';

	function zeros(): Vec7 {
		return Array(7).fill(0) as Vec7;
	}

	const tableId = $derived(Number(page.params.table));
	const persona = $derived(tablePersona(tableId));
	const seat = $derived(tableSeatIndex(tableId));
	const table = $derived(session.tables.find((t) => t.id === tableId));
	/** Fingerprint — reseed when session.poll updates room (no second timer). */
	const roomSyncKey = $derived(
		[
			session.updatedAt,
			session.phase,
			session.round,
			tableId,
			table?.lockedThisRound ? 1 : 0
		].join(':')
	);
	const phase = $derived(session.phase);
	const round = $derived(session.room?.round ?? 0);
	const roundLabel = $derived(Math.min(ROUND_COUNT, Math.max(1, round + 1)));
	const roundCount = $derived(session.room?.roundCount ?? ROUND_COUNT);
	const scenario = $derived(SCENARIOS[Math.min(round, SCENARIOS.length - 1)] ?? SCENARIOS[0]);
	const serverRow = $derived((table?.board?.[seat] ?? zeros()) as Vec7);
	const submitted = $derived(!!table?.lockedThisRound);
	/** Capture seal only on R2 · R3 · R5 */
	const canCapture = $derived(phase === 'round' && isCaptureRound(roundLabel));
	/** Unlocked live rounds can edit; R1/R4 save without seal */
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
	const counts = $derived(editable && seeded ? draft : serverRow);
	const totalTokens = $derived(counts.reduce((a, b) => a + b, 0));
	const standingCap = $derived(baseline.reduce((a, b) => a + b, 0));
	/** R3 bounty shrinks to holdings; else table wallet */
	const tableCap = $derived(
		removeOnly ? Math.max(standingCap, totalTokens) : (session.room?.tableBountyTokens ?? 100)
	);
	const roomBounty = $derived(session.room?.roomBountyTokens ?? 700);
	const overCap = $derived(totalTokens > tableCap);
	const remaining = $derived(Math.max(0, tableCap - totalTokens));

	function reseedFromServer() {
		const t = session.tables.find((x) => x.id === tableId);
		if (!t || t.lockedThisRound) {
			seeded = false;
			return;
		}
		const s = tableSeatIndex(tableId);
		const row = ((t.board[s] ?? zeros()) as Vec7).slice() as Vec7;
		draft = row;
		baseline = row.slice() as Vec7; // R3 protect baseline = standing at open
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

	/**
	 * Server → draft sync. Driven only by session.poll (layout boot).
	 * No second timer — reacts when roomSyncKey changes.
	 */
	$effect(() => {
		const key = roomSyncKey;
		const room = session.room;
		const t = session.tables.find((x) => x.id === tableId);
		if (!room || !t) return;

		const locked = !!t.lockedThisRound;
		const ph = room.phase;
		const prev = lastSyncKey;
		const prevPhase = prev ? prev.split(':')[1] : null;

		if (
			prevPhase &&
			prevPhase !== ph &&
			(ph === 'reveal' || ph === 'finale')
		) {
			tab = 'board';
		}

		if (key !== lastSyncKey) {
			lastSyncKey = key;
			if (!locked && (ph === 'lobby' || ph === 'round')) {
				reseedFromServer();
			} else if (locked) {
				seeded = false;
			}
		} else if (!seeded && !locked && (ph === 'lobby' || ph === 'round')) {
			reseedFromServer();
		}
	});

	/** d = a chip value (±10 · ±5 · ±2). Chips are atomic — reject if one won't fit. */
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
			// can't remove a chip that isn't there
			if (nextVal < 0) return;
		} else if (d > 0) {
			const others = next.reduce((a, b, i) => a + (i === priority ? 0 : b), 0);
			if (others + nextVal > tableCap) return; // whole chip over budget — reject
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

	/** Capture seal — only R2 · R3 · R5 */
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

	/** Save cumulative board without sealing (R1 / R4 / lobby) */
	async function onSave() {
		if (!editable || submitting || overCap) return;
		submitting = true;
		try {
			await session.submitTable(tableId, boardFromRow(draft), { seal: false });
			// keep draft in sync with server; do not lock
			seeded = true;
		} finally {
			submitting = false;
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
		<p class="center muted">Connecting…</p>
	{:else if !table || tableId < 1 || tableId > 7}
		<p class="center muted">Scan the QR for your function table (1–7).</p>
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
		<div class="center muted space-y-2">
			<p class="font-display text-lg font-bold text-gold">Lobby</p>
			<p class="text-sm">Waiting for presenter to start Round 1…</p>
		</div>
	{:else if phase === 'round'}
		<form class="board-form" onsubmit={onSubmit}>
			<p class="budget" class:over={overCap}>
				{#if editable}
					{#if removeOnly}
						R3 REMOVE · holding {formatUsdFull(totalTokens)}
					{:else if overCap}
						{formatUsd(totalTokens)} of {formatUsd(tableCap)} · over budget
					{:else}
						{formatUsd(totalTokens)} of {formatUsd(tableCap)} placed · {formatUsd(remaining)} left
					{/if}
				{:else}
					View only · sealed
				{/if}
			</p>

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
								: `Lock in — final for R${roundLabel} · ${formatUsdFull(totalTokens)}`}
					</button>
				{:else}
					<button
						type="button"
						class="submit save"
						disabled={submitting || overCap}
						onclick={onSave}
					>
						{submitting ? 'Saving…' : `Save & continue · ${formatUsdFull(totalTokens)}`}
					</button>
					{#if totalTokens <= 0}
						<p class="hint-cap">Place tokens on the board first.</p>
					{/if}
				{/if}
			{/if}
		</form>
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
	.center {
		text-align: center;
		padding: 40px 12px;
	}
	.muted {
		color: var(--color-muted);
	}
	.board-form {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 4px 12px 0;
	}
	.budget {
		margin: 0;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-gold);
		font-weight: 700;
	}
	.budget.over {
		color: var(--color-red);
	}
	.submit {
		border: none;
		border-radius: 14px;
		padding: 16px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		background: var(--color-teal);
		color: #04140f;
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
