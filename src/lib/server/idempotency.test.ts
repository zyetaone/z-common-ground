/**
 * Idempotency store — cache, replay, TTL expiry, and failure tolerance.
 *
 * Uses a small in-memory D1 stub. The stub only has to support the four
 * statements this module issues; anything more would be simulating SQLite
 * rather than testing our code.
 */
import { describe, expect, it } from 'vitest';
import { getIdempotentResponse, saveIdempotentResponse } from './idempotency';
import { validIdempotencyKey } from './with-idempotency';

type Row = { status: number; body: string; expires_at: number };

function makeD1(opts: { failOn?: RegExp } = {}) {
	const store = new Map<string, Row>();

	function exec(sql: string, p: unknown[]) {
		if (opts.failOn?.test(sql)) throw new Error('D1 down');

		if (/^CREATE TABLE/.test(sql)) return { row: null, changes: 0 };

		if (/^INSERT INTO idempotency/.test(sql)) {
			const [key, status, body, expires_at] = p as [string, number, string, number];
			store.set(key, { status, body, expires_at }); // ON CONFLICT DO UPDATE
			return { row: null, changes: 1 };
		}
		if (/^SELECT .* WHERE key = \?/.test(sql)) {
			const [key] = p as [string];
			return { row: store.get(key) ?? null, changes: 0 };
		}
		if (/^DELETE FROM idempotency WHERE key = \?/.test(sql)) {
			const [key] = p as [string];
			return { row: null, changes: store.delete(key) ? 1 : 0 };
		}
		if (/^DELETE FROM idempotency WHERE expires_at/.test(sql)) {
			const [cutoff] = p as [number];
			let changes = 0;
			for (const [k, v] of store) if (v.expires_at < cutoff) (store.delete(k), changes++);
			return { row: null, changes };
		}
		return { row: null, changes: 0 };
	}

	return {
		store,
		prepare(sql: string) {
			const params: unknown[] = [];
			const chain = {
				bind(...args: unknown[]) {
					params.push(...args);
					return chain;
				},
				async first<T>() {
					return (exec(sql, params).row as T | null) ?? null;
				},
				async run() {
					return { meta: { changes: exec(sql, params).changes } };
				}
			};
			return chain;
		},
		/** Backdate an entry so the next read sees it as expired. */
		expire(key: string) {
			const row = store.get(key);
			if (row) store.set(key, { ...row, expires_at: Date.now() - 1 });
		}
	} as unknown as D1Database & { store: Map<string, Row>; expire: (k: string) => void };
}

describe('validIdempotencyKey', () => {
	it('accepts 8-128 chars of URL-safe text', () => {
		expect(validIdempotencyKey('abcd1234')).toBe(true);
		expect(validIdempotencyKey('a_b-c_1234567890')).toBe(true);
		expect(validIdempotencyKey('x'.repeat(128))).toBe(true);
	});

	it('rejects too short, too long, or missing', () => {
		expect(validIdempotencyKey('short')).toBe(false);
		expect(validIdempotencyKey('x'.repeat(129))).toBe(false);
		expect(validIdempotencyKey(null)).toBe(false);
		expect(validIdempotencyKey(undefined)).toBe(false);
	});

	it('rejects characters that could bloat or confuse the row', () => {
		expect(validIdempotencyKey('has spaces!')).toBe(false);
		expect(validIdempotencyKey('emoji-🎯-key')).toBe(false);
		expect(validIdempotencyKey('semi;colon;key')).toBe(false);
	});
});

describe('idempotency store', () => {
	const KEY = 'retry-key-0001';

	it('misses before anything is stored', async () => {
		const db = makeD1();
		expect(await getIdempotentResponse(db, KEY)).toBeNull();
	});

	it('replays exactly what was saved', async () => {
		const db = makeD1();
		await saveIdempotentResponse(db, KEY, 200, '{"ok":true}');
		expect(await getIdempotentResponse(db, KEY)).toEqual({ status: 200, body: '{"ok":true}' });
	});

	it('preserves a non-200 status', async () => {
		const db = makeD1();
		await saveIdempotentResponse(db, KEY, 201, '{"created":1}');
		expect((await getIdempotentResponse(db, KEY))?.status).toBe(201);
	});

	it('treats an expired entry as a miss and clears it', async () => {
		const db = makeD1();
		await saveIdempotentResponse(db, KEY, 200, '{"stale":true}');
		db.expire(KEY);
		expect(await getIdempotentResponse(db, KEY)).toBeNull();
		expect(db.store.has(KEY)).toBe(false); // swept, not left to rot
	});

	// The whole point: a lost response must not re-charge fal or re-mutate.
	it('serves the first response to a retry, without re-running', async () => {
		const db = makeD1();
		let runs = 0;
		const handler = async () => {
			runs++;
			return `{"run":${runs}}`;
		};

		const first = (await getIdempotentResponse(db, KEY)) ?? {
			status: 200,
			body: await handler()
		};
		await saveIdempotentResponse(db, KEY, first.status, first.body);

		// Retry with the same key — the response was lost, not the mutation.
		const second = (await getIdempotentResponse(db, KEY)) ?? {
			status: 200,
			body: await handler()
		};

		expect(runs).toBe(1);
		expect(second.body).toBe(first.body);
	});

	it('degrades to a miss when D1 reads fail, rather than throwing', async () => {
		const db = makeD1({ failOn: /^SELECT/ });
		await expect(getIdempotentResponse(db, KEY)).resolves.toBeNull();
	});

	it('swallows a failed write — losing the cache costs a replay, not correctness', async () => {
		const db = makeD1({ failOn: /^INSERT/ });
		await expect(saveIdempotentResponse(db, KEY, 200, '{}')).resolves.toBeUndefined();
	});

	it('is a no-op without a D1 binding', async () => {
		expect(await getIdempotentResponse(undefined, KEY)).toBeNull();
		await expect(saveIdempotentResponse(undefined, KEY, 200, '{}')).resolves.toBeUndefined();
	});

	it('does not cache an oversized body', async () => {
		// Every mutating endpoint returns the whole room (~7KB). Caching it meant
		// two D1 writes per mutation — the room, then a verbatim copy — and D1 has
		// one primary, so from a distant colo that was a second cross-continent
		// round trip. Measured as an 11.7s hang on POST /api/room with 2ms of CPU.
		const db = makeD1();
		const big = JSON.stringify({ room: 'x'.repeat(8000) });
		await saveIdempotentResponse(db, KEY, 200, big);
		expect(await getIdempotentResponse(db, KEY)).toBeNull();
	});

	it('still caches a small body', async () => {
		const db = makeD1();
		await saveIdempotentResponse(db, KEY, 200, '{"ok":true}');
		expect(await getIdempotentResponse(db, KEY)).toEqual({ status: 200, body: '{"ok":true}' });
	});
});
