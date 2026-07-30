import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/** Player taps "Freeze" — physical tokens are placed, ready to match digital. */
export const POST: RequestHandler = async ({ request }) => {
	const { tableId } = (await request.json().catch(() => ({}))) as { tableId?: number };
	if (!tableId || tableId < 1 || tableId > 7) {
		return json({ ok: false, error: 'Invalid table ID' }, { status: 400 });
	}
	const room = await withLiveRoom(() => store.tablePhysicallyDone('', tableId));
	return json({ ok: true, room });
};
