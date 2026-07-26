import { json, error } from '@sveltejs/kit';
import { buildEnhancedBrief } from '$lib/game';
import { generateBriefWithLlama } from '$lib/server/ai/llama';
import { withLiveRoom, readLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/** POST → regenerate narrative brief only (Workers AI Llama 3). */
export const POST: RequestHandler = async ({ platform }) => {
	const room = await readLiveRoom();
	if (room.aggregate.totalCoins <= 0) {
		throw error(400, 'No stake yet — cannot generate a brief with 0 tokens.');
	}

	const ai = platform?.env?.AI;
	const llama = await generateBriefWithLlama(ai, room.aggregate);
	const brief = llama ?? buildEnhancedBrief(room.aggregate);
	await withLiveRoom(() => store.setEnhancedBrief('', brief, llama ? 'llama' : 'numbers'));

	return json({
		brief,
		briefSource: llama ? 'llama' : 'numbers',
		llama: !!llama,
		room: store.snapshot()
	});
};
