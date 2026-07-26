import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/** Advance round and return full room so clients refresh immediately. */
export const POST: RequestHandler = async () => {
	const result = await withLiveRoom(() => store.advance());
	return json({
		phase: result.phase,
		round: result.round,
		boardsOpened: result.boardsOpened,
		room: store.snapshot()
	});
};
