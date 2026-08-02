import { withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

/** Archive live AI photos, then clear them from the live room (archive stays downloadable). */
export const POST: RequestHandler = async (event) =>
	idempotentJson(event, async () => {
		const room = await withLiveRoom(() => store.archiveGeneratedImages(''));
		return { ok: true, room };
	});
