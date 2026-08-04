import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import { sanitizeScenarioPatch } from '$lib/server/host-patch';
import { ROUND_COUNT } from '$lib/game/config';
import type { RequestHandler } from './$types';

/** Host edits a single scenario (by round 0..ROUND_COUNT-1). Persists to D1. */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		round?: number;
		patch?: Record<string, unknown>;
	};
	if (
		body.round == null ||
		!Number.isInteger(body.round) ||
		body.round < 0 ||
		body.round >= ROUND_COUNT
	) {
		throw error(400, `Invalid round (0..${ROUND_COUNT - 1})`);
	}
	return idempotentJson(event, async () => {
		const patch = sanitizeScenarioPatch(body.patch ?? {});
		const room = await withLiveRoom(() => store.setScenario(body.round!, patch));
		return { ok: true, room };
	});
};
