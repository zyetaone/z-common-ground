import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { Scenario } from '$lib/game/types';
import type { RequestHandler } from './$types';

/** Host edits a single scenario (by round 0..4). */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { round?: number; patch?: Partial<Scenario> };
	if (body.round == null || body.round < 0 || body.round > 4) {
		return json({ ok: false, error: 'Invalid round (0..4)' }, { status: 400 });
	}
	const room = await withLiveRoom(() => store.setScenario('', body.round!, body.patch ?? {}));
	return json({ ok: true, room });
};
