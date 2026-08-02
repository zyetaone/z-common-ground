import { json } from '@sveltejs/kit';
import { N_PRIORITIES } from '$lib/game';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		analysisForced?: boolean;
		roomBountyTokens?: number;
		/** Host renames the 7 board options (priority labels). */
		priorities?: string[];
		/** Wipe persona / scenario / priority overrides. */
		resetOverrides?: boolean;
	};

	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => {
			if (body.resetOverrides) return store.resetGameConfig('');
			if (Array.isArray(body.priorities) && body.priorities.length === N_PRIORITIES) {
				return store.setPriorities('', body.priorities);
			}
			return store.setConfig('', {
				analysisForced: body.analysisForced,
				roomBountyTokens: body.roomBountyTokens
			});
		});
		return {
			ok: true,
			analysisForced: room.analysisForced,
			analysisOpen: room.analysisOpen,
			roomBountyTokens: room.roomBountyTokens,
			tableBountyTokens: room.tableBountyTokens,
			priorities: room.priorities,
			room
		};
	});
};
