import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		analysisForced?: boolean;
		roomBountyTokens?: number;
	};
	const room = await withLiveRoom(() => store.setConfig('', body));
	return json({
		ok: true,
		analysisForced: room.analysisForced,
		analysisOpen: room.analysisOpen,
		roomBountyTokens: room.roomBountyTokens,
		tableBountyTokens: room.tableBountyTokens,
		room
	});
};
