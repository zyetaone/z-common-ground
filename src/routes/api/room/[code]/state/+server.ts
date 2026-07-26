import { json } from '@sveltejs/kit';
import { readLiveRoom } from '$lib/server/live';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const room = await readLiveRoom();
	return json(room, {
		headers: {
			'cache-control': 'no-store, no-cache, must-revalidate',
			pragma: 'no-cache'
		}
	});
};
