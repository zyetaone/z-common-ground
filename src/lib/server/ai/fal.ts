// Server-only fal.ai image client.
// Concepts + drawing sets: Nano Banana 2 (2K) with GPT Image 2 high-quality path for finals.
import { fal } from '@fal-ai/client';

/** Fast/high concept stills — Google Nano Banana 2 */
const NANO_T2I = 'fal-ai/nano-banana-2';
/** Multi-ref compositing for plans / sections / collages */
const NANO_EDIT = 'fal-ai/nano-banana-2/edit';
/** Highest-fidelity finals (typography + boards) — OpenAI GPT Image 2 on fal */
const GPT_T2I = 'openai/gpt-image-2';
const GPT_EDIT = 'openai/gpt-image-2/edit';

export type ImageQuality = 'standard' | 'high';

/** `no_key` = config problem; `failed` = generation error (retry). */
export type ImageResult =
	| { url: string; error?: never; model?: string }
	| { url: null; error: 'no_key' | 'failed'; model?: string };

function pickUrl(result: unknown): string | null {
	const r = result as {
		data?: { images?: Array<{ url?: string }>; image?: { url?: string } };
		images?: Array<{ url?: string }>;
	};
	return (
		r?.data?.images?.[0]?.url ??
		r?.data?.image?.url ??
		r?.images?.[0]?.url ??
		null
	);
}

/**
 * Photoreal / concept workplace still (room or function lens).
 * High → Nano Banana 2 at 2K (crisper sheets). Standard → 1K.
 */
export async function generateImage(
	apiKey: string | undefined,
	prompt: string,
	opts?: { quality?: ImageQuality; aspect_ratio?: '16:9' | '1:1' | '4:3' | '3:2' }
): Promise<ImageResult> {
	if (!apiKey) return { url: null, error: 'no_key' };
	const quality = opts?.quality ?? 'high';
	const aspect = opts?.aspect_ratio ?? '16:9';
	const resolution = quality === 'high' ? '2K' : '1K';

	try {
		fal.config({ credentials: apiKey });
		// Prefer Nano Banana 2 for photoreal interiors (fast + strong architecture)
		const result = await fal.subscribe(NANO_T2I, {
			input: {
				prompt,
				num_images: 1,
				aspect_ratio: aspect,
				resolution,
				output_format: 'webp'
			}
		});
		const url = pickUrl(result);
		return url ? { url, model: NANO_T2I } : { url: null, error: 'failed', model: NANO_T2I };
	} catch (err) {
		console.error('[fal] nano t2i failed:', err instanceof Error ? err.message : err);
		// Fallback: GPT Image 2 text-to-image for finals when nano fails
		if (quality === 'high') {
			try {
				const gpt = await fal.subscribe(GPT_T2I, {
					input: {
						prompt,
						image_size: aspect === '16:9' ? '1536x1024' : '1024x1024',
						quality: 'high',
						num_images: 1
					}
				});
				const url = pickUrl(gpt);
				return url ? { url, model: GPT_T2I } : { url: null, error: 'failed', model: GPT_T2I };
			} catch (e2) {
				console.error('[fal] gpt-image-2 failed:', e2 instanceof Error ? e2.message : e2);
			}
		}
		return { url: null, error: 'failed' };
	}
}

/**
 * High-quality architectural sheets with reference images.
 * Tries GPT Image 2 edit first (best titleblock / diagram typography),
 * then Nano Banana 2 edit at 2K. Returns the first real failure rather than
 * silently cascading into further paid calls when both models fail.
 */
export async function generateImageWithRefs(
	apiKey: string | undefined,
	prompt: string,
	imageUrls: string[],
	opts?: {
		aspect_ratio?: '16:9' | '1:1' | '4:3' | '3:2' | '21:9';
		quality?: ImageQuality;
		/** Prefer GPT Image 2 for presentation boards (plans, collages with credit text) */
		preferGpt?: boolean;
	}
): Promise<ImageResult> {
	if (!apiKey) return { url: null, error: 'no_key' };
	const refs = imageUrls.filter(Boolean).slice(0, 14);
	if (!refs.length) {
		return generateImage(apiKey, prompt, { quality: opts?.quality ?? 'high' });
	}

	const quality = opts?.quality ?? 'high';
	const aspect = opts?.aspect_ratio ?? '16:9';
	const preferGpt = opts?.preferGpt ?? true;
	const resolution = quality === 'high' ? '2K' : '1K';

	fal.config({ credentials: apiKey });

	const tryGpt = async (): Promise<ImageResult | null> => {
		try {
			const result = await fal.subscribe(GPT_EDIT, {
				input: {
					prompt,
					image_urls: refs.slice(0, 8),
					image_size: aspect === '16:9' ? '1536x1024' : '1024x1024',
					quality: quality === 'high' ? 'high' : 'medium',
					num_images: 1
				}
			});
			const url = pickUrl(result);
			return url ? { url, model: GPT_EDIT } : null;
		} catch (err) {
			console.error('[fal] gpt-image-2/edit failed:', err instanceof Error ? err.message : err);
			return null;
		}
	};

	const tryNano = async (): Promise<ImageResult | null> => {
		try {
			const result = await fal.subscribe(NANO_EDIT, {
				input: {
					prompt,
					image_urls: refs,
					num_images: 1,
					aspect_ratio: aspect,
					resolution,
					output_format: 'webp'
				}
			});
			const url = pickUrl(result);
			return url ? { url, model: NANO_EDIT } : null;
		} catch (err) {
			console.error('[fal] nano edit failed:', err instanceof Error ? err.message : err);
			return null;
		}
	};

	if (preferGpt) {
		const gpt = await tryGpt();
		if (gpt) return gpt;
		const nano = await tryNano();
		if (nano) return nano;
	} else {
		const nano = await tryNano();
		if (nano) return nano;
		const gpt = await tryGpt();
		if (gpt) return gpt;
	}

	// When both models fail, return the real failure rather than silently
	// cascading into a third paid text-only call.
	return { url: null, error: 'failed', model: preferGpt ? GPT_EDIT : NANO_EDIT };
}
