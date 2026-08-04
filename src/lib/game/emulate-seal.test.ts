/**
 * Emulate has to survive the seal gates it feeds.
 *
 * It is the facilitator's fallback when a table cannot join, so it runs on the
 * path where a failure is most visible. It carried its own copy of the round
 * rules ("R3: leave 70% of standing"), which only cleared the >=30% removal
 * target when chip rounding happened to land there — at a $70M wallet it left
 * 50 of 70, a $20M cut against a $21M target, and R3 refused to seal.
 *
 * Wallets are host-editable, so this runs across three of them.
 */
import { describe, expect, it } from 'vitest';
import { emulateRoomBoards, isCaptureRound } from '$lib/game';
import { applyAdvance, applySubmitTable } from '$lib/game/rules';
import { makeRoom } from '$lib/game/rules/test-room';

describe('emulate vs the seal gates', () => {
	for (const wallet of [100, 70, 130]) {
		it(`every emulated board seals at a $${wallet}M wallet`, () => {
			const room = makeRoom({ tableBountyTokens: wallet, roomBountyTokens: wallet * 7 });
			applyAdvance(room);
			for (let r = 1; r <= 5; r++) {
				const label = room.round + 1;
				for (const b of emulateRoomBoards(room, 42)) {
					const res = applySubmitTable(room, b.tableId, b.board, {
						seal: isCaptureRound(label, room)
					});
					expect(res.ok, `R${label} table ${b.tableId}: ${res.ok ? '' : res.error}`).toBe(true);
				}
				applyAdvance(room);
			}
		});
	}
});
