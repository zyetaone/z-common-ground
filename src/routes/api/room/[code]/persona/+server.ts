import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import { sanitizePersonaPatch } from '$lib/server/host-patch';
import { N_SEATS } from '$lib/game/config';
import type { RequestHandler } from './$types';

/** Host edits a single persona (by seat 0..6). Persists to D1; phones/presenter poll it. */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		seat?: number;
		patch?: Record<string, unknown>;
	};
	if (
		body.seat == null ||
		!Number.isInteger(body.seat) ||
		body.seat < 0 ||
		body.seat >= N_SEATS
	) {
		throw error(400, `Invalid seat (0..${N_SEATS - 1})`);
	}
	return idempotentJson(event, async () => {
		const patch = sanitizePersonaPatch(body.patch ?? {});
		const room = await withLiveRoom(() => store.setPersona(body.seat!, patch));
		return { ok: true, room };
	});
};
