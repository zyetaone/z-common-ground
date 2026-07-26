/**
 * Workers AI — Llama 3 for future-workplace brief narrative.
 * Binding: env.AI (wrangler.jsonc ai.binding).
 */
import { briefFactsForLlm } from '$lib/game';
import type { Aggregate } from '$lib/game/types';

/** Fast, available on Workers AI free tier. */
export const LLAMA_MODEL = '@cf/meta/llama-3.1-8b-instruct' as const;

export type AiBinding = {
	run: (
		model: string,
		input: {
			messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
			max_tokens?: number;
			temperature?: number;
		}
	) => Promise<{ response?: string } | string>;
};

const SYSTEM = `You are a workplace strategy consultant for Zyeta / Common Ground.
Write a concise executive brief titled in spirit "Imagine the future of the workplace" — grounded ONLY in the stake numbers provided.
Never invent percentages. Never invent a mandate if total stake is zero.
Tone: sharp, boardroom, actionable. No fluff.
Structure:
1. MANDATE — lead priority % and what the workplace must deliver
2. WHERE THE MONEY WENT — bullets with original priority labels, % and $ / tokens
3. LEAD / RESOLVE / PROTECT — three short directives
4. SPATIAL PROGRAM — how floorplate tilts with the investment mix
5. ONE OPEN QUESTION for the design team
Keep under 280 words. Plain text only — no # markdown headings.`;

/**
 * Generate narrative brief via Cloudflare Workers AI Llama 3.
 * Returns null if no AI binding, no stake, or model failure (caller falls back to numbers brief).
 */
export async function generateBriefWithLlama(
	ai: AiBinding | undefined,
	agg: Aggregate
): Promise<string | null> {
	const facts = briefFactsForLlm(agg);
	if (!facts || !ai) return null;

	try {
		const out = await ai.run(LLAMA_MODEL, {
			messages: [
				{ role: 'system', content: SYSTEM },
				{
					role: 'user',
					content: `Write the future workplace brief from these room facts:\n\n${facts}`
				}
			],
			max_tokens: 700,
			temperature: 0.45
		});

		const text =
			typeof out === 'string'
				? out
				: typeof out?.response === 'string'
					? out.response
					: '';
		const cleaned = text.trim();
		return cleaned.length > 40 ? cleaned : null;
	} catch (err) {
		console.error('[llama] brief failed:', err instanceof Error ? err.message : err);
		return null;
	}
}
