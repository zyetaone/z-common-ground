/**
 * A whole session driven through the seal gates, R1 → R5.
 *
 * The unit tests cover `sealTargetFor` and `sealTargetTokens` in isolation. This
 * plays a table through the real `applyAdvance` / `applySubmitTable` path so the
 * targets are exercised where they actually run — the deployed room sits in
 * `reveal`, so nothing in production touches these branches until a session is
 * played, and I would rather find a broken gate here than on a projector.
 */
import { describe, expect, it } from 'vitest';
import { R3_REMOVE_FRACTION, R5_CAP_FRACTION, SCENARIOS } from '$lib/game';
import type { RoomState, Vec7 } from '$lib/game/types';
import { applyAdvance, applySubmitTable } from './index';
import { makeRoom } from './test-room';

const WALLET = 100;
const TABLE = 1;
/** Table 1 sits at seat 0 (tableSeatIndex is id - 1). */
const SEAT = 0;

/** A board whose seat row holds `row` and every other row is empty. */
function boardWith(row: number[]): number[][] {
	const b = Array.from({ length: 7 }, () => Array(7).fill(0) as number[]);
	b[SEAT] = row.slice();
	return b;
}

const rowOf = (room: RoomState) => room.tables.find((t) => t.id === TABLE)!.board[SEAT] as Vec7;
const totalOf = (room: RoomState) => rowOf(room).reduce((a, b) => a + b, 0);

/** Start a room already on round `label` (1-based), boards open. */
function roomOnRound(label: number): RoomState {
	const room = makeRoom({ tableBountyTokens: WALLET });
	applyAdvance(room); // lobby → R1
	for (let r = 1; r < label; r++) applyAdvance(room);
	return room;
}

describe('seal gates across a session', () => {
	it('R1 refuses to seal at all — it is a freeze-only round', () => {
		const room = roomOnRound(1);
		const res = applySubmitTable(room, TABLE, boardWith([30, 0, 0, 0, 0, 0, 0]), { seal: true });
		expect(res.ok).toBe(false);
		expect(!res.ok && res.error).toMatch(/capture rounds/i);
	});

	it('R2 seals only on the full wallet, and the error names the shortfall', () => {
		const room = roomOnRound(2);
		const short = applySubmitTable(room, TABLE, boardWith([40, 30, 0, 0, 0, 0, 0]), { seal: true });
		expect(short.ok).toBe(false);
		expect(!short.ok && short.error).toContain('$100M');

		const full = applySubmitTable(room, TABLE, boardWith([40, 30, 20, 10, 0, 0, 0]), { seal: true });
		expect(full).toEqual({ ok: true, sealed: true });
		expect(totalOf(room)).toBe(WALLET);
	});

	it('R2 refuses a board over the wallet before it ever reaches the target check', () => {
		const room = roomOnRound(2);
		const over = applySubmitTable(room, TABLE, boardWith([40, 40, 30, 0, 0, 0, 0]), { seal: true });
		expect(over.ok).toBe(false);
		expect(!over.ok && over.error).toMatch(/over table budget/i);
	});

	it('R3 seals only once the removal target is met', () => {
		const room = roomOnRound(2);
		applySubmitTable(room, TABLE, boardWith([40, 30, 20, 10, 0, 0, 0]), { seal: true });
		applyAdvance(room); // R2 → R3, boards reopen, standing = 100

		const need = Math.ceil(WALLET * R3_REMOVE_FRACTION);
		// Cut only 10 of the 30 required.
		const tooLittle = applySubmitTable(room, TABLE, boardWith([30, 30, 20, 10, 0, 0, 0]), {
			seal: true
		});
		expect(tooLittle.ok).toBe(false);
		expect(!tooLittle.ok && tooLittle.error).toContain(`$${need}M`);

		const enough = applySubmitTable(room, TABLE, boardWith([10, 30, 20, 10, 0, 0, 0]), {
			seal: true
		});
		expect(enough).toEqual({ ok: true, sealed: true });
		expect(totalOf(room)).toBe(WALLET - 30);
	});

	it('R3 clamps an attempt to grow a row back above where the round opened', () => {
		const room = roomOnRound(2);
		applySubmitTable(room, TABLE, boardWith([40, 30, 20, 10, 0, 0, 0]), { seal: true });
		applyAdvance(room);
		// Row 0 opened at 40; submitting 60 there must clamp to 40, not add.
		const res = applySubmitTable(room, TABLE, boardWith([60, 0, 20, 10, 0, 0, 0]), { seal: true });
		expect(res.ok).toBe(true);
		expect(rowOf(room)[0]).toBe(40);
	});

	it('R4 is freeze-only like R1 — no seal, whatever the board says', () => {
		const room = roomOnRound(4);
		const res = applySubmitTable(room, TABLE, boardWith([20, 0, 0, 0, 0, 0, 0]), { seal: true });
		expect(res.ok).toBe(false);
		expect(!res.ok && res.error).toMatch(/capture rounds/i);
	});

	it('R5 caps the final board at 90% of the wallet', () => {
		const room = roomOnRound(5);
		const cap = Math.floor(WALLET * R5_CAP_FRACTION);

		const over = applySubmitTable(room, TABLE, boardWith([40, 30, 20, 10, 0, 0, 0]), { seal: true });
		expect(over.ok).toBe(false);
		expect(!over.ok && over.error).toContain(`${cap}`);

		const atCap = applySubmitTable(room, TABLE, boardWith([40, 30, 20, 0, 0, 0, 0]), { seal: true });
		expect(atCap).toEqual({ ok: true, sealed: true });
		expect(totalOf(room)).toBe(cap);
	});

	it('scales every gate to a host-shrunk wallet, not the $100M default', () => {
		const room = makeRoom({ tableBountyTokens: 70, roomBountyTokens: 490 });
		applyAdvance(room);
		applyAdvance(room); // → R2

		const short = applySubmitTable(room, TABLE, boardWith([60, 0, 0, 0, 0, 0, 0]), { seal: true });
		expect(short.ok).toBe(false);
		expect(!short.ok && short.error).toContain('$70M');

		expect(applySubmitTable(room, TABLE, boardWith([40, 30, 0, 0, 0, 0, 0]), { seal: true }).ok).toBe(
			true
		);
	});

	it('follows the remove rule to whatever round the host puts it on', () => {
		// The regression this whole change exists for: `move` is host-editable, so
		// the removal used to be enforced on a moved round while its target — gated
		// on `roundLabel === 3` — was silently skipped, and the round sealed with
		// nothing given up.
		const room = makeRoom({ tableBountyTokens: WALLET });
		applyAdvance(room);
		applyAdvance(room); // → R2
		applySubmitTable(room, TABLE, boardWith([40, 30, 20, 10, 0, 0, 0]), { seal: true });
		applyAdvance(room); // → R3
		applySubmitTable(room, TABLE, boardWith([10, 30, 20, 10, 0, 0, 0]), { seal: true });
		applyAdvance(room); // → R4, standing 70

		// Host turns R4 into a capture + remove round. Overrides merge onto the
		// config scenario in roomScenarios, so a partial entry is what the host
		// patch path actually stores.
		room.scenarios = SCENARIOS.map((s) => ({ ...s }));
		room.scenarios[3] = { ...room.scenarios[3], mode: 'capture', move: 'remove' };

		const standing = totalOf(room);
		const need = Math.ceil(standing * R3_REMOVE_FRACTION);
		const nothingCut = applySubmitTable(room, TABLE, boardWith([10, 30, 20, 10, 0, 0, 0]), {
			seal: true
		});
		expect(nothingCut.ok).toBe(false);
		expect(!nothingCut.ok && nothingCut.error).toContain(`$${need}M`);
	});
});
