import { error, type RequestEvent } from '@sveltejs/kit';
import { getIdempotentResponse, saveIdempotentResponse } from './idempotency';

type JsonBody = Record<string, unknown> | unknown;

/** 8–128 chars of URL-safe text. Long enough to be collision-free, short
 *  enough that a malicious client can't bloat the D1 row. */
const KEY_RE = /^[a-zA-Z0-9_-]{8,128}$/;

export function validIdempotencyKey(key: string | null | undefined): key is string {
	return !!key && KEY_RE.test(key);
}

/**
 * Wrap a mutating handler so a retry with the same Idempotency-Key replays the
 * stored response instead of re-executing.
 *
 * Without a key or a D1 binding this is a plain pass-through: idempotency is an
 * optimisation on the retry path, never a precondition for serving a request.
 */
export async function withIdempotency(
	event: RequestEvent,
	run: () => Promise<{ status?: number; body: JsonBody }>
): Promise<Response> {
	const key = event.request.headers.get('idempotency-key');
	const db = event.platform?.env?.common_ground_db;

	if (key && !validIdempotencyKey(key)) {
		throw error(400, 'Invalid Idempotency-Key (8–128 chars, alphanumeric/_/-)');
	}

	if (key && db) {
		const cached = await getIdempotentResponse(db, key);
		if (cached) {
			return json(cached.body, cached.status, {
				'idempotency-key': key,
				'idempotency-key-replay': 'true'
			});
		}
	}

	const result = await run();
	const status = result.status ?? 200;
	const bodyStr = JSON.stringify(result.body);

	// Only cache success. A 4xx/5xx should be retryable on its merits.
	if (key && db && status >= 200 && status < 300) {
		await saveIdempotentResponse(db, key, status, bodyStr);
	}

	return json(bodyStr, status, key ? { 'idempotency-key': key } : {});
}

function json(body: string, status: number, extra: Record<string, string>): Response {
	return new Response(body, {
		status,
		headers: { 'content-type': 'application/json', ...extra }
	});
}

/** Convenience: always 200 JSON. */
export async function idempotentJson(
	event: RequestEvent,
	run: () => Promise<JsonBody>
): Promise<Response> {
	return withIdempotency(event, async () => ({ body: await run() }));
}
