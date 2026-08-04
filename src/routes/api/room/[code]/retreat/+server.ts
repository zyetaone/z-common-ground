import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	return idempotentJson(event, async () => {
		const result = await withLiveRoom(() => store.retreat());
		return {
			phase: result.phase,
			round: result.round,
			boardsOpened: result.boardsOpened,
			room: store.snapshot()
		};
	});
};
