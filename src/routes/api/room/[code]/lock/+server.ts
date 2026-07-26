import { error, json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/**
 * POST { tableId, board?, seal? }
 * seal true (default) → only R2 · R3 · R5 capture lock
 * seal false → save cumulative board without sealing (R1 / R4)
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		tableId?: number;
		board?: number[][];
		seal?: boolean;
	};
	const result = await withLiveRoom(() =>
		store.submitTable('', Number(body.tableId), body.board, {
			seal: body.seal !== false
		})
	);
	if (!result.ok) error(400, result.error ?? 'Submit failed');
	return json({
		ok: true,
		sealed: !!result.sealed,
		tableBountyTokens: result.room.tableBountyTokens,
		room: result.room
	});
};
