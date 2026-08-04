import { json } from '@sveltejs/kit';
import { withLiveRoom, readLiveRoom } from '$lib/server/live';
import { SESSION, store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

/** Idempotent — always the single LIVE session. */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		tableCount?: number;
		reset?: boolean;
	};
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() =>
			body.reset ? store.reset(body.tableCount) : store.ensure(body.tableCount)
		);
		return { code: SESSION, tables: room.tables.length, room };
	});
};

export const GET: RequestHandler = async () => {
	const room = await readLiveRoom();
	return json({ code: SESSION, phase: room.phase, tables: room.tables.length });
};
