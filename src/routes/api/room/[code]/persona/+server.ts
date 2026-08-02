import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { Persona } from '$lib/game/types';
import type { RequestHandler } from './$types';

/** Host edits a single persona (by seat 0..6). Persists to D1; phones/presenter poll it. */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		seat?: number;
		patch?: Partial<Persona>;
	};
	if (body.seat == null || body.seat < 0 || body.seat > 6) {
		return new Response(JSON.stringify({ ok: false, error: 'Invalid seat (0..6)' }), {
			status: 400,
			headers: { 'content-type': 'application/json' }
		});
	}
	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.setPersona('', body.seat!, body.patch ?? {}));
		return { ok: true, room };
	});
};
