import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

/** Host changes number of tables (1..7). */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as { count?: number };
	const count = body.count;
	if (count == null || count < 1 || count > 7) error(400, 'Invalid table count (1..7)');
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.setTableCount(count));
		return { ok: true, room };
	});
};
