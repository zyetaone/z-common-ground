import { error } from '@sveltejs/kit';
import { buildEnhancedBrief } from '$lib/game';
import { generateBriefWithRapidi } from '$lib/server/ai/rapidi';
import { withLiveRoom, readLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

/** POST → regenerate narrative brief only (RapidI). */
export const POST: RequestHandler = async (event) => {
	return idempotentJson(event, async () => {
		const room = await readLiveRoom();
		if (room.aggregate.totalCoins <= 0) {
			throw error(400, 'No stake yet — cannot generate a brief with 0 tokens.');
		}

		const ai = event.platform?.env?.AI;
		const rapidi = await generateBriefWithRapidi(ai, room.aggregate, room);
		const brief = rapidi ?? buildEnhancedBrief(room.aggregate, room);
		await withLiveRoom(() => store.setEnhancedBrief('', brief, rapidi ? 'rapidi' : 'numbers'));

		return {
			brief,
			briefSource: rapidi ? 'rapidi' : 'numbers',
			rapidi: !!rapidi,
			room: store.snapshot()
		};
	});
};