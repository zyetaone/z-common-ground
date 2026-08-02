<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import {
		MobileBoardForm,
		MobileFinale,
		MobileHeader,
		MobileRender,
		MobileSealed,
		MobileWaitStage
	} from '$lib/components/phone';
	import {
		R2_FULL_BUDGET,
		R4_ADD_BACK,
		emptyMatrix,
		formatUsd,
		isCaptureRound,
		ROUND_COUNT,
		r3RemoveTarget,
		r5CapForWallet,
		roomPriorities,
		roomScenarios,
		tablePersona,
		tableSeatIndex,
		zeros
	} from '$lib/game';
	import type { Matrix7x7, Vec7 } from '$lib/game/types';
	import { session } from '$lib/state';

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
	const priorityLabels = $derived(roomPriorities(session.room));
	const serverRow = $derived((table?.board?.[seat] ?? zeros()) as Vec7);
	const submitted = $derived(!!table?.lockedThisRound);
	const canCapture = $derived(phase === 'round' && isCaptureRound(roundLabel, session.room));
	const canEditPhase = $derived(phase === 'round' && !submitted);
	const editable = $derived(canEditPhase && !!table);
	const showQuestion = $derived(phase === 'lobby' || phase === 'round');
	const move = $derived(scenario?.move ?? 'add');
	const removeOnly = $derived(move === 'remove');

	let draft = $state<Vec7>(zeros());
	let baseline = $state<Vec7>(zeros());
	let seeded = $state(false);
	let submitting = $state(false);
	let submitError = $state('');
	let lastSyncKey = $state('');
	let tab = $state<Tab>('board');

	const isFinale = $derived(phase === 'reveal' || phase === 'finale');
	const physicallyDone = $derived(!!table?.physicallyDone);
	const counts = $derived(editable && seeded ? draft : serverRow);
	const totalTokens = $derived(counts.reduce((a, b) => a + b, 0));
	const standingCap = $derived(baseline.reduce((a, b) => a + b, 0));
	const baseWallet = $derived(session.room?.tableBountyTokens ?? R2_FULL_BUDGET);
	const tableCap = $derived(
		removeOnly
			? Math.max(standingCap, totalTokens)
			: roundLabel === 5
				? r5CapForWallet(baseWallet)
				: baseWallet
	);
	const overCap = $derived(totalTokens > tableCap);
	const removedTokens = $derived(Math.max(0, standingCap - totalTokens));
	const r2Target = $derived(baseWallet);
	const r3Target = $derived(r3RemoveTarget(standingCap));
	const r2Ready = $derived(!canCapture || roundLabel !== 2 || totalTokens === r2Target);
	const r3Ready = $derived(
		!canCapture || roundLabel !== 3 || !removeOnly || removedTokens >= r3Target
	);

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

	$effect(() => {
		const key = roomSyncKey;
		const room = session.room;
		const t = session.tables.find((x) => x.id === tableId);
		if (!room || !t) return;

		const locked = !!t.lockedThisRound;
		const ph = room.phase;
		const prev = untrack(() => lastSyncKey);
		const isSeeded = untrack(() => seeded);
		const prevPhase = prev ? prev.split(':')[1] : null;

		if (prevPhase && prevPhase !== ph && (ph === 'reveal' || ph === 'finale')) {
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
		if (!editable || submitting || overCap || !canCapture) return;
		if (roundLabel === 2 && totalTokens !== r2Target) {
			submitError = `R2 needs the full ${formatUsd(r2Target)} budget.`;
			return;
		}
		if (roundLabel === 3 && removeOnly && removedTokens < r3Target) {
			submitError = `R3 needs ${formatUsd(r3Target)} removed (you’ve cut ${formatUsd(removedTokens)}).`;
			return;
		}
		if (!removeOnly && totalTokens <= 0) return;
		submitting = true;
		submitError = '';
		try {
			await session.submitTable(tableId, boardFromRow(draft), { seal: true });
			seeded = false;
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Submit failed';
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
			/* poll will resync */
		}
	}

	// Physical board first — freeze when the round total is on the table
	const freezeHeading = $derived(
		roundLabel === 1
			? `Physical board · first stake`
			: roundLabel === 2
				? `Physical board · full ${formatUsd(r2Target)}`
				: roundLabel === 3
					? `Physical board · remove ${formatUsd(r3RemoveTarget(baseWallet))}`
					: roundLabel === 4
						? `Physical board · +${formatUsd(R4_ADD_BACK)}`
						: roundLabel === 5
							? `Physical board · restructure ${formatUsd(r5CapForWallet(baseWallet))}`
							: `Physical board · R${roundLabel}`
	);
	const freezeSub = $derived(
		'What does your physical board reflect? Freeze when that round is complete — then match digital.'
	);
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
		<MobileWaitStage showDot text="Connecting to session…" />
	{:else if !table || tableId < 1 || tableId > 7}
		<MobileWaitStage icon="📱" heading="Wrong table link" sub="Scan the QR for your function table (1–7)." />
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
			labels={priorityLabels}
			onRender={() => (tab = 'render')}
		/>
	{:else if submitted}
		<MobileWaitStage sealed>
			<MobileSealed
				{roundLabel}
				{totalTokens}
				{counts}
				color={persona.color}
				labels={priorityLabels}
			/>
		</MobileWaitStage>
	{:else if phase === 'lobby'}
		{#if !table?.joined}
			<MobileWaitStage
				showDot
				heading="Lobby"
				sub="Tap to join — let the presenter know your table is ready."
				actionLabel="Enter Lobby"
				actionBusy={session.busy}
				onaction={async () => {
					await session.joinTable(tableId);
				}}
			/>
		{:else}
			<MobileWaitStage
				joined
				icon="✅"
				heading="Joined"
				sub="Waiting for presenter to start Round 1…"
			/>
		{/if}
	{:else if phase === 'round' && !physicallyDone}
		<MobileWaitStage
			icon="🎯"
			heading={freezeHeading}
			sub={freezeSub}
			actionLabel={session.busy ? 'Freezing…' : 'Freeze'}
			actionBusy={session.busy}
			onaction={onFreeze}
		/>
	{:else if phase === 'round'}
		<MobileBoardForm
			{counts}
			color={persona.color}
			{editable}
			busy={submitting}
			{move}
			capTokens={tableCap}
			baseline={removeOnly ? baseline : null}
			{roundLabel}
			{removeOnly}
			{r2Ready}
			{r3Ready}
			r2Target={r2Target}
			removeTarget={r3Target}
			{overCap}
			{totalTokens}
			{removedTokens}
			{tableCap}
			{baseWallet}
			{submitError}
			{canCapture}
			labels={priorityLabels}
			onDelta={delta}
			onClear={clear}
			{onSubmit}
			{onSave}
		/>
	{:else}
		<MobileWaitStage showDot text="Waiting for the next round…" />
	{/if}
</main>

<style>
	.shell {
		max-width: 560px;
		margin: 0 auto;
		min-height: 100dvh;
		padding-bottom: calc(24px + env(safe-area-inset-bottom));
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
		color: var(--color-gold-ink);
		padding: 14px;
		min-height: 44px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		touch-action: manipulation;
	}
</style>
