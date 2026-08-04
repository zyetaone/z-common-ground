import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		tableId?: number;
		seat?: number;
		priority?: number;
	};
	const tableId = Number(body.tableId);
	const seat = Number(body.seat);
	const priority = Number(body.priority);
	if (!Number.isInteger(tableId) || tableId < 1 || tableId > 7)
		error(400, 'tableId must be an integer in [1,7]');
	if (!Number.isInteger(seat) || seat < 0 || seat > 6) error(400, 'seat must be an integer in [0,6]');
	if (!Number.isInteger(priority) || priority < 0 || priority > 6)
		error(400, 'priority must be an integer in [0,6]');
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.clearCell(tableId, seat, priority));
		return { ok: true, room };
	});
};
