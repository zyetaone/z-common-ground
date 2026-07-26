import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { tableId?: number };
	const room = await withLiveRoom(() => store.unlockTable('', Number(body.tableId)));
	return json({ ok: true, room });
};
