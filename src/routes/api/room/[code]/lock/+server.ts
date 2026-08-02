import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

/**
 * POST { tableId, board?, seal? }
 * seal true (default) → only R2 · R3 · R5 capture lock
 * seal false → save cumulative board without sealing (R1 / R4)
 * Already sealed → { ok, sealed: true } (idempotent).
 */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		tableId?: number;
		board?: number[][];
		seal?: boolean;
	};
	const tableId = Number(body.tableId);
	if (!Number.isInteger(tableId) || tableId < 1 || tableId > 7)
		error(400, 'tableId must be an integer in [1,7]');
	return idempotentJson(event, async () => {
		const result = await withLiveRoom(() =>
			store.submitTable('', tableId, body.board, {
				seal: body.seal !== false
			})
		);
		if (!result.ok) error(400, result.error ?? 'Submit failed');
		return {
			ok: true,
			sealed: !!result.sealed,
			tableBountyTokens: result.room.tableBountyTokens,
			room: result.room
		};
	});
};
