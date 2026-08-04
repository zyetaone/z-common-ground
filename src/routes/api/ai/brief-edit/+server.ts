import { error } from '@sveltejs/kit';
import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

/**
 * POST → save a host/facilitator edit to the brief.
 * Body: { brief: string, source?: 'numbers' | 'rapidi' | 'manual' }
 * Empty `brief` clears the room's brief back to default.
 * This persists across polls — replaces the previous client-only `updateBrief()`.
 */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as {
		brief?: string;
		source?: 'numbers' | 'rapidi' | 'manual';
	};
	if (typeof body.brief !== 'string') {
		throw error(400, 'brief must be a string');
	}
	const brief: string = body.brief;
	if (brief.length > 20000) {
		throw error(400, 'brief exceeds 20000 chars');
	}
	const source = body.source ?? 'manual';
	if (source !== 'manual' && source !== 'numbers' && source !== 'rapidi') {
		throw error(400, "source must be 'numbers' | 'rapidi' | 'manual'");
	}

	return idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.setEnhancedBrief(brief, source));
		// No `room` here either — the whole room is ~11KB and the idempotency cache
		// refuses anything over 2KB, so returning it meant a retried save re-ran
		// instead of replaying. The client falls through to poll() when it's absent.
		return {
			ok: true,
			brief: room.enhancedBrief,
			briefSource: room.briefSource
		};
	});
};
