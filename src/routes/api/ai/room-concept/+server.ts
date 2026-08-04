import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { formatUsd, roomPriorities, tableBountyTokens } from '$lib/game';
import { finalePrompt } from '$lib/server/ai/prompts';
import { generateImage } from '$lib/server/ai/fal';
import { withLiveRoom, readLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

/**
 * POST → generate one Common Ground room still and push onto the concept palette.
 * Image only — does not rewrite the brief. Use `/api/ai/brief` for brief and `/api/ai/brief-edit` for manual edits.
 */
export const POST: RequestHandler = async (event) => {
	return idempotentJson(event, async () => {
		const room = await readLiveRoom();
		if (room.aggregate.totalCoins <= 0) {
			throw error(400, 'No stake yet — place priorities before generating a room concept.');
		}

		const prompt = finalePrompt(room.aggregate.matrix, {
			labels: roomPriorities(room),
			budgetLabel: formatUsd(tableBountyTokens(room))
		});
		const key =
			env.FAL_API_KEY ||
			env.FAL_KEY ||
			event.platform?.env?.FAL_API_KEY ||
			event.platform?.env?.FAL_KEY;

		const { url, error: imageError, model } = await generateImage(key, prompt, {
			quality: 'high'
		});

		if (url) {
			await withLiveRoom(() => {
				store.setFinaleImage(url);
			});
		}

		// No `room` in the body. Every mutating route returns the whole room (~11KB)
		// and the idempotency cache refuses anything over 2KB, so nothing was ever
		// cached — and this is the one route where a replay costs money: the client
		// retries once on network failure with the same key, which meant a second
		// fal generation. Without the room the body fits, so the retry replays.
		// session.roomConcept() already falls through to poll() when room is absent.
		// The prompt went too — 4KB on its own, and no caller ever read it.
		// Keep this body small: over 2KB and the retry re-bills instead of replaying.
		return {
			url,
			imageError,
			model,
			paletteSize: store.snapshot().roomConceptUrls?.length ?? (url ? 1 : 0)
		};
	});
};
