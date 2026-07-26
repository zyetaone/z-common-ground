import { error, json } from '@sveltejs/kit';
import { CHIP_DENOMS } from '$lib/game';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/** Valid chip-value deltas: ±10 (red) · ±5 (blue) · ±2 (green). */
const CHIP_DELTAS = CHIP_DENOMS.flatMap((c) => [c.value, -c.value]);

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		tableId?: number;
		seat?: number;
		priority?: number;
		delta?: number;
		value?: number;
	};
	const tableId = Number(body.tableId);
	const seat = Number(body.seat);
	const priority = Number(body.priority);

	const room = await withLiveRoom(() => {
		if (typeof body.value === 'number') {
			return store.boardSet('', tableId, seat, priority, body.value);
		}
		const delta = Number(body.delta);
		if (!CHIP_DELTAS.includes(delta)) error(400, 'delta must be a chip value (±10 · ±5 · ±2)');
		return store.boardDelta('', tableId, seat, priority, delta);
	});
	return json({ ok: true, room });
};
