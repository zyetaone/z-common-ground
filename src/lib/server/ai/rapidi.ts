/**
 * RapidI brief narrative.
 * Workers AI binding (env.AI) — model resolved server-side via the binding's primary model.
 * Returns null if no AI binding, no stake, or the call fails (caller uses numbers brief).
 */
import { walletLabel, type DesignCard } from '$lib/game';
import { briefSystem, COMPOSE_SYSTEM, briefFactsForRapidi, designCardsJsonForRapidi } from './prompts';
import type { Aggregate, RoomState } from '$lib/game/types';

export type AiBinding = {
	run: (model: string, options: Record<string, unknown>) => Promise<unknown>;
};

function extractText(out: { response?: string } | string): string {
	if (typeof out === 'string') return out;
	const response = out?.response;
	return typeof response === 'string' ? response : '';
}

/** Workers AI binding shape we actually use (kept narrow so .run() is the only contract). */

/** Boardroom-tuned Workers AI chat model. */
const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function runChat(
	ai: AiBinding | undefined,
	system: string,
	user: string,
	max_tokens: number,
	model?: string
): Promise<string | null> {
	if (!ai) return null;
	const resolved = model ?? DEFAULT_CHAT_MODEL;
	try {
		const out = (await ai.run(resolved, {
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user }
			],
			max_tokens,
			temperature: 0.4
		})) as { response?: string };
		const text = extractText(out);
		if (!text || text.length <= 40) return null;
		return text;
	} catch (err) {
		console.error('[rapidi] brief failed:', err instanceof Error ? err.message : err);
		return null;
	}
}

/**
 * Generate narrative brief via Workers AI.
 * Returns null if no AI binding, no stake, or the call fails (caller uses numbers brief).
 */
export async function generateBriefWithRapidi(
	ai: AiBinding | undefined,
	agg: Aggregate,
	room?: RoomState | null
): Promise<string | null> {
	if (!ai) return null;
	if (agg.totalCoins <= 0) return null;
	const user = briefFactsForRapidi(agg, room);
	// The wallet is host-configurable; the system prompt used to hard-code $100M
	// and contradict the facts in the user message whenever it was changed.
	const text = await runChat(ai, briefSystem(walletLabel(room)), user, 480);
	return text;
}

/**
 * Complete brief from reverse-engineered design cards (after all table images exist).
 */
export async function generateCompleteBriefFromCards(
	ai: AiBinding | undefined,
	cards: DesignCard[],
	room: RoomState
): Promise<string | null> {
	if (!ai) return null;
	if (!cards.length) return null;
	const user = designCardsJsonForRapidi(cards);
	const text = await runChat(ai, COMPOSE_SYSTEM, user, 720);
	return text;
}