import { json } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { Persona } from '$lib/game/types';
import type { RequestHandler } from './$types';

/** Host edits a single persona (by seat 0..6). */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { seat?: number; patch?: Partial<Persona> };
	if (body.seat == null || body.seat < 0 || body.seat > 6) {
		return json({ ok: false, error: 'Invalid seat (0..6)' }, { status: 400 });
	}
	const room = await withLiveRoom(() => store.setPersona('', body.seat!, body.patch ?? {}));
	return json({ ok: true, room });
};
