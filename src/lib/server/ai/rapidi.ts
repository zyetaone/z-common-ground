/**
 * RapidI brief narrative.
 * Workers AI binding (env.AI) — model resolved server-side via the binding's primary model.
 * Returns null if no AI binding, no stake, or the call fails (caller uses numbers brief).
 */
import {
	type DesignCard
} from '$lib/game';
import { briefFactsForRapidi, designCardsJsonForRapidi } from './prompts';
import type { Aggregate, RoomState } from '$lib/game/types';

export type AiBinding = {
	run: (model: string, options: Record<string, unknown>) => Promise<unknown>;
};

const SYSTEM = `You are ZyetaI for Zyeta Common Ground (CoreNet boardroom).
Answer: where would each function spend their $100M, where is Common Ground, and what would that workplace look like.
Use the priority mix, lead, fault, blind, surprise, and journey facts in the user message.
Methodology note: this is a facilitated exercise. All 7 functions carry equal weight regardless of organisational size or budget authority. Alignment (CGI) is mean pairwise cosine similarity. "Lead" uses breadth of support; "fault" uses variance; "blind" is lowest-funded. These are directional signals from a structured conversation, not deterministic conclusions. Acknowledge this framing naturally — do not over-caveat but do not present the numbers as scientific fact.
Voice: crisp, senior, specific. No bullets of generic adjectives. Prefer one bold sentence over five hedged ones.
Under 320 words. Sharp. Visual.`;

/** Complete brief after every function image exists — recombine design JSON cards. */
const COMPOSE_SYSTEM = `You are ZyetaI. Design JSON cards reverse-engineered from each render:
read them and describe the workplace as a single coherent narrative.
Per-priority zone description first, then the room synthesis, then the open design question.
Under 450 words. Sound like a workplace strategist describing space, not a spreadsheet.`;

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
	const text = await runChat(ai, SYSTEM, user, 480);
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