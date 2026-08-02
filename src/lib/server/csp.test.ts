/**
 * CSP guard.
 *
 * A too-strict CSP fails silently: images just don't render, and nothing throws
 * server-side. The classic trap here is that fal's API host (`fal.ai`) and its
 * image CDN (`v3b.fal.media`) are different domains, so allow-listing only
 * `*.fal.ai` blocks every generated image while looking correct.
 */
import { describe, expect, it } from 'vitest';
import { handle } from '../../hooks.server';

/** Run the hook over a fake request and read back the CSP directives. */
async function cspFor(contentType: string): Promise<Record<string, string>> {
	const response = new Response('<!doctype html>', {
		headers: { 'content-type': contentType }
	});
	const res = await handle({
		event: { request: new Request('http://localhost/') } as never,
		resolve: async () => response
	} as never);
	const header = res.headers.get('content-security-policy');
	if (!header) return {};
	return Object.fromEntries(
		header.split(';').map((d) => {
			const [name, ...rest] = d.trim().split(/\s+/);
			return [name, rest.join(' ')];
		})
	);
}

describe('content-security-policy', () => {
	it('applies to documents', async () => {
		const csp = await cspFor('text/html');
		expect(Object.keys(csp).length).toBeGreaterThan(0);
	});

	it('leaves API/JSON responses untouched', async () => {
		expect(await cspFor('application/json')).toEqual({});
	});

	// Regression: fal serves images from *.fal.media, not *.fal.ai.
	it('allows the fal image CDN, not just the fal API host', async () => {
		const csp = await cspFor('text/html');
		expect(csp['img-src']).toContain('fal.media');
		// ExpandImage re-fetches the bytes cross-origin for the download button.
		expect(csp['connect-src']).toContain('fal.media');
	});

	it('allows the assets the app actually loads', async () => {
		const csp = await cspFor('text/html');
		expect(csp['style-src']).toContain('fonts.googleapis.com'); // app.html
		expect(csp['font-src']).toContain('fonts.gstatic.com');
		expect(csp['img-src']).toContain('data:'); // selfie preview
		expect(csp['img-src']).toContain('blob:'); // LinkedIn frame canvas
	});

	it('keeps the clickjacking and base-tag defences', async () => {
		const csp = await cspFor('text/html');
		expect(csp['frame-ancestors']).toBe("'none'");
		expect(csp['base-uri']).toBe("'self'");
	});

	it('sets the companion security headers', async () => {
		const response = new Response('<!doctype html>', {
			headers: { 'content-type': 'text/html' }
		});
		const res = await handle({
			event: { request: new Request('http://localhost/') } as never,
			resolve: async () => response
		} as never);
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
		// The phone takes a selfie for the LinkedIn frame.
		expect(res.headers.get('permissions-policy')).toContain('camera=(self)');
	});
});
