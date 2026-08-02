import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as { tableId?: number };
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.unlockTable('', Number(body.tableId)));
		return { ok: true, room };
	});
};
