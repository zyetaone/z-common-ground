import { json, error, type RequestEvent } from '@sveltejs/kit';
import {
	getIdempotentResponse,
	saveIdempotentResponse,
	validIdempotencyKey
} from './idempotency';

type JsonBody = Record<string, unknown> | unknown;

/**
 * Wrap a mutating handler: if Idempotency-Key present, replay or cache the JSON result.
 */
export async function withIdempotency(
	event: RequestEvent,
	run: () => Promise<{ status?: number; body: JsonBody }>
): Promise<Response> {
	const key = event.request.headers.get('idempotency-key') ?? event.request.headers.get('Idempotency-Key');
	const db = event.platform?.env?.common_ground_db;

	if (key && !validIdempotencyKey(key)) {
		throw error(400, 'Invalid Idempotency-Key (8–128 chars, alphanumeric/_/-)');
	}

	if (key && db) {
		const cached = await getIdempotentResponse(db, key);
		if (cached) {
			return new Response(cached.body, {
				status: cached.status,
				headers: {
					'content-type': 'application/json',
					'idempotency-key': key,
					'idempotency-key-replay': 'true'
				}
			});
		}
	}

	const result = await run();
	const status = result.status ?? 200;
	const bodyStr = JSON.stringify(result.body);

	if (key && db && status >= 200 && status < 300) {
		await saveIdempotentResponse(db, key, status, bodyStr);
	}

	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (key) headers['idempotency-key'] = key;
	return new Response(bodyStr, { status, headers });
}

/** Convenience: always 200 JSON. */
export async function idempotentJson(
	event: RequestEvent,
	run: () => Promise<JsonBody>
): Promise<Response> {
	return withIdempotency(event, async () => ({ body: await run() }));
}
