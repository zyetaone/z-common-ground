import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/** Presenter correction: go back one step without wiping boards. */
export const POST: RequestHandler = async () => {
	const result = await withLiveRoom(() => store.retreat());
	return json({
		phase: result.phase,
		round: result.round,
		boardsOpened: result.boardsOpened,
		room: store.snapshot()
	});
};
