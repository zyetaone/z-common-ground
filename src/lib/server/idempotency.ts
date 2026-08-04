/**
 * Idempotency-Key store (D1) — replay a cached JSON response within the TTL.
 *
 * Why this exists: `session.post()` retries once on network failure using the
 * SAME key. If the first attempt reached the Worker but the response was lost,
 * the retry must replay the stored response instead of re-executing — otherwise
 * a lost response double-charges fal or double-applies a mutation.
 *
 * Why it is this small: every client call mints a fresh crypto.randomUUID(), so
 * a key is only ever reused by that sequential retry — the first request has
 * already failed before the second is sent. Two requests never hold the same
 * key at the same time, so there is no in-flight race to arbitrate.
 */
const TABLE = `CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  expires_at INTEGER NOT NULL
)`;

const TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Responses larger than this are not cached.
 *
 * Every mutating endpoint returns the whole room (~7KB and growing with image
 * archives), so caching the body doubled the write cost of every mutation —
 * one D1 write for the room, another for a verbatim copy of it. D1 has a
 * single primary, so on a distant colo that second write is another
 * cross-continent round trip. Skipping the cache costs a replay on the rare
 * retry path; paying it cost latency on every single call.
 */
const MAX_CACHED_BODY = 2048;

let schemaReady = false;

async function ensure(db: D1Database) {
	if (schemaReady) return;
	await db.prepare(TABLE).run();
	schemaReady = true;
}

export async function getIdempotentResponse(
	db: D1Database | undefined,
	key: string
): Promise<{ status: number; body: string } | null> {
	if (!db) return null;
	try {
		await ensure(db);
		const row = await db
			.prepare('SELECT status, body, expires_at FROM idempotency WHERE key = ?')
			.bind(key)
			.first<{ status: number; body: string; expires_at: number }>();
		if (!row) return null;
		if (row.expires_at < Date.now()) {
			await db.prepare('DELETE FROM idempotency WHERE key = ?').bind(key).run();
			return null;
		}
		return { status: row.status, body: row.body };
	} catch (err) {
		// A cache miss is always safe — fall through and re-execute.
		console.error('[idempotency] get failed', err instanceof Error ? err.message : err);
		return null;
	}
}

export async function saveIdempotentResponse(
	db: D1Database | undefined,
	key: string,
	status: number,
	body: string
): Promise<void> {
	if (!db) return;
	if (body.length > MAX_CACHED_BODY) return;
	try {
		await ensure(db);
		await db
			.prepare(
				`INSERT INTO idempotency (key, status, body, expires_at) VALUES (?, ?, ?, ?)
				 ON CONFLICT(key) DO UPDATE SET status = excluded.status, body = excluded.body, expires_at = excluded.expires_at`
			)
			.bind(key, status, body, Date.now() + TTL_MS)
			.run();
		// The lazy delete on read only fires for keys that are actually reused, so
		// without this sweep the table would grow without bound.
		if (Math.random() < 0.05) {
			await db.prepare('DELETE FROM idempotency WHERE expires_at < ?').bind(Date.now()).run();
		}
	} catch (err) {
		// Failing to cache costs a replay, not correctness.
		console.error('[idempotency] save failed', err instanceof Error ? err.message : err);
	}
}
