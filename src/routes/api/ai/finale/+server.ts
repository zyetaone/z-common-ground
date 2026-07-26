import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { buildEnhancedBrief, finalePrompt } from '$lib/game';
import { generateImage } from '$lib/server/ai/fal';
import { generateBriefWithLlama } from '$lib/server/ai/llama';
import { withLiveRoom, readLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/**
 * POST → (1) Llama 3 brief from room mix  (2) fal render from %-weighted prompt.
 * No stake → 400. No Workers AI → numbers skeleton brief. No FAL key → url null.
 */
export const POST: RequestHandler = async ({ platform }) => {
	const room = await readLiveRoom();
	if (room.aggregate.totalCoins <= 0) {
		throw error(400, 'No stake yet — tables must submit tokens before brief/render.');
	}

	const factsBrief = buildEnhancedBrief(room.aggregate);
	const ai = platform?.env?.AI;
	const llama = await generateBriefWithLlama(ai, room.aggregate);
	const brief = llama ?? factsBrief;

	const prompt = finalePrompt(room.aggregate.matrix);
	const key = env.FAL_API_KEY || env.FAL_KEY || platform?.env?.FAL_API_KEY || platform?.env?.FAL_KEY;
	const { url, error: imageError } = await generateImage(key, prompt);

	await withLiveRoom(() => {
		store.setEnhancedBrief('', brief, llama ? 'llama' : 'numbers');
		if (url) store.setFinaleImage('', url);
	});

	return json({
		url,
		imageError,
		prompt,
		brief,
		briefSource: llama ? 'llama' : 'numbers',
		llama: !!llama,
		room: store.snapshot()
	});
};
