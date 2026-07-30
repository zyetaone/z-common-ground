import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/** Host changes number of tables (1..7). */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { count?: number };
	if (body.count == null || body.count < 1 || body.count > 7) {
		return json({ ok: false, error: 'Invalid table count (1..7)' }, { status: 400 });
	}
	const room = await withLiveRoom(() => store.setTableCount('', body.count!));
	return json({ ok: true, room });
};
