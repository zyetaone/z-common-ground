import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		tableId?: number;
		seat?: number;
		priority?: number;
	};
	const room = await withLiveRoom(() =>
		store.clearCell('', Number(body.tableId), Number(body.seat), Number(body.priority))
	);
	return json({ ok: true, room });
};
