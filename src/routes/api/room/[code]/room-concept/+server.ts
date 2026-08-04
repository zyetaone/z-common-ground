import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

/**
 * POST { action: 'select' | 'remove', url } — manage Common Ground concept palette.
 */
export const POST: RequestHandler = async (event) => {
	return idempotentJson(event, async () => {
		const body = (await event.request.json().catch(() => ({}))) as {
			action?: string;
			url?: string;
		};
		const action = body.action;
		const url = typeof body.url === 'string' ? body.url.trim() : '';
		if (!url || (action !== 'select' && action !== 'remove')) {
			throw error(400, 'action select|remove and url required');
		}

		const room = await withLiveRoom(() => {
			if (action === 'select') store.selectRoomConcept(url);
			else store.removeRoomConcept(url);
			return store.snapshot();
		});

		return { ok: true, room };
	});
};
