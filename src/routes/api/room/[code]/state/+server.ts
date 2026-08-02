import { json } from '@sveltejs/kit';
import { readLiveRoom } from '$lib/server/live';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const room = await readLiveRoom();
	const etag = `W/"${room.updatedAt}"`;
	// Client polls with If-None-Match — skip the body when nothing changed.
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, {
			status: 304,
			headers: {
				etag,
				'cache-control': 'no-store, no-cache, must-revalidate'
			}
		});
	}
	return json(room, {
		headers: {
			etag,
			'cache-control': 'no-store, no-cache, must-revalidate',
			pragma: 'no-cache'
		}
	});
};
