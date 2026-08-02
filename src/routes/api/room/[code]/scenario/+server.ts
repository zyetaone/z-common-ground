import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { Scenario } from '$lib/game/types';
import type { RequestHandler } from './$types';

/** Host edits a single scenario (by round 0..4). Persists to D1; phones/presenter poll it. */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		round?: number;
		patch?: Partial<Scenario>;
	};
	if (body.round == null || body.round < 0 || body.round > 4) {
		return new Response(JSON.stringify({ ok: false, error: 'Invalid round (0..4)' }), {
			status: 400,
			headers: { 'content-type': 'application/json' }
		});
	}
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.setScenario('', body.round!, body.patch ?? {}));
		return { ok: true, room };
	});
};
