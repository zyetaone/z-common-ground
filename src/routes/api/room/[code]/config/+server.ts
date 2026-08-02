import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import { sanitizePriorityLabels } from '$lib/server/host-patch';
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
		const sanitizedPriorities = Array.isArray(body.priorities)
			? sanitizePriorityLabels(body.priorities)
			: undefined;
		const room = await withLiveRoom(() => {
			if (body.resetOverrides) return store.resetGameConfig('');
			if (sanitizedPriorities) return store.setPriorities('', sanitizedPriorities);
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
