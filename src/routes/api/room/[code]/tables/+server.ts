import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { count?: number };
	const room = await withLiveRoom(() => store.setTables('', body.count ?? 1));
	return json({ tables: room.tables.length, room });
};
