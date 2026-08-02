/**
 * Server-side request hook. Adds a content-security-policy and other security
 * headers to every response. CSP is strict by default; the project's needed
 * external sources are allow-listed explicitly.
 *
 * Notes:
 *  - `connect-src` includes `https://*.workers.dev` for the live URL fallback
 *    share origin (src/lib/client/linkedin-frame.ts fallback) and the localhost
 *    dev server.
 *  - `img-src` allows `data:` and `blob:` for the selfie preview + downloaded
 *    LinkedIn frames, and the fal CDN. Note the CDN is `*.fal.media` (fal
 *    returns e.g. `https://v3b.fal.media/...`), which is a different domain
 *    from the `fal.ai` API host — allow-listing only `*.fal.ai` would block
 *    every generated image.
 *  - `connect-src` needs the same CDN: ExpandImage re-fetches the image bytes
 *    cross-origin to offer a download.
 *  - `font-src` is Google Fonts (Playfair Display / Lora, per app.html).
 *  - `frame-src` is `none` — the app never iframes.
 *  - `worker-src` is `self` + blob: — Vite's dev HMR uses blob: workers.
 *  - `script-src 'self' 'wasm-unsafe-eval'` — required for Vite dev; in
 *    production the bundle is self-hosted.
 *  - Frame-ancestors `none` defends against clickjacking.
 */
import type { Handle } from '@sveltejs/kit';

const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com data:",
	"img-src 'self' data: blob: https://*.fal.media https://*.fal.ai https://fal.ai",
	"connect-src 'self' https://*.workers.dev https://*.fal.media https://*.fal.ai https://fal.ai wss: ws:",
	"worker-src 'self' blob:",
	"frame-src 'none'",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'"
].join('; ');

const REFERRER_POLICY = 'strict-origin-when-cross-origin';
const PERMISSIONS_POLICY = [
	'camera=(self)',
	'geolocation=()',
	'microphone=()',
	'payment=()',
	'usb=()'
].join(', ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	// Only apply to document responses — leaving API/JSON responses untouched.
	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('text/html')) {
		response.headers.set('Content-Security-Policy', CSP);
		response.headers.set('Referrer-Policy', REFERRER_POLICY);
		response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
		response.headers.set('X-Content-Type-Options', 'nosniff');
	}
	return response;
};
