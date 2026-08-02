import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

/** Player taps "Join" in lobby — mark presence. */
export const POST: RequestHandler = async (event) => {
	const { tableId } = (await event.request.json().catch(() => ({}))) as { tableId?: number };
	if (!tableId || tableId < 1 || tableId > 7) error(400, 'Invalid table ID');
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.tableJoin('', tableId));
		return { ok: true, room };
	});
};
