import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as { count?: number };
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.setTables('', body.count ?? 1));
		return { tables: room.tables.length, room };
	});
};
