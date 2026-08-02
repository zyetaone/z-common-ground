import { error } from '@sveltejs/kit';
import {
	composeCompleteBriefFromCards,
	designCardsFromRoom
} from '$lib/game';
import { generateCompleteBriefFromCards } from '$lib/server/ai/rapidi';
import { withLiveRoom, readLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/with-idempotency';
import type { RequestHandler } from './$types';

/**
 * POST → reverse-engineer design JSON from room + each function mix,
 * recombine into a COMPLETE RapidI brief (AI or numbers fallback).
 * Call after finale + table images exist.
 */
export const POST: RequestHandler = async (event) => {
	return idempotentJson(event, async () => {
		const room = await readLiveRoom();
		if (room.aggregate.totalCoins <= 0) {
			throw error(400, 'No stake yet — place priorities before compose.');
		}

		const cards = designCardsFromRoom(room);
		if (cards.length === 0) {
			throw error(400, 'No design cards — need stake on at least one table.');
		}

		const ai = event.platform?.env?.AI;
		const rapidi = await generateCompleteBriefFromCards(ai, cards, room);
		const fallback = composeCompleteBriefFromCards(cards, room);
		const brief = rapidi ?? fallback;

		await withLiveRoom(() => {
			store.setEnhancedBrief('', brief, rapidi ? 'rapidi' : 'numbers');
		});

		return {
			brief,
			briefSource: rapidi ? 'rapidi' : 'numbers',
			rapidi: !!rapidi,
			cards,
			cardCount: cards.length,
			functionCards: cards.filter((c) => c.kind === 'function').length,
			room: store.snapshot()
		};
	});
};