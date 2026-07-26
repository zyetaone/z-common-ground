// Server-only fal.ai image client. Mirrors z-corenet's image-generator (nano-banana-2).
// Returns the hosted fal image URL (the store's setFinaleImage(code, url) takes a url).
import { fal } from '@fal-ai/client';

const IMAGE_MODEL = 'fal-ai/nano-banana-2';

/** `no_key` = config problem (add the key); `failed` = generation error (retry). */
export type ImageResult = { url: string; error?: never } | { url: null; error: 'no_key' | 'failed' };

/**
 * Generate one 16:9 workplace image. Returns the fal-hosted URL, or a typed
 * reason so the booth can tell a missing key from a real generation failure.
 */
export async function generateImage(apiKey: string | undefined, prompt: string): Promise<ImageResult> {
	if (!apiKey) return { url: null, error: 'no_key' };
	try {
		fal.config({ credentials: apiKey });
		const result = await fal.subscribe(IMAGE_MODEL, {
			input: {
				prompt,
				num_images: 1,
				aspect_ratio: '16:9',
				resolution: '1K',
				output_format: 'webp'
			}
		});
		const url = (result as { data?: { images?: Array<{ url?: string }> } }).data?.images?.[0]?.url;
		return url ? { url } : { url: null, error: 'failed' };
	} catch (err) {
		console.error('[fal] image generation failed:', err instanceof Error ? err.message : err);
		return { url: null, error: 'failed' };
	}
}
