/**
 * Idempotency-Key store (D1) — replay cached JSON responses within TTL.
 * KISS: lazy TTL on read; no cron.
 */
const TABLE = `CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  status INTEGER NOT NULL,
  body TEXT NOT NULL,
  expires_at INTEGER NOT NULL
)`;

const KEY_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const TTL_MS = 24 * 60 * 60 * 1000;

let schemaReady = false;

async function ensure(db: D1Database) {
	if (schemaReady) return;
	await db.prepare(TABLE).run();
	schemaReady = true;
}

export function validIdempotencyKey(key: string | null | undefined): key is string {
	return !!key && KEY_RE.test(key);
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
	try {
		await ensure(db);
		const expires = Date.now() + TTL_MS;
		await db
			.prepare(
				`INSERT INTO idempotency (key, status, body, expires_at) VALUES (?, ?, ?, ?)
				 ON CONFLICT(key) DO UPDATE SET status = excluded.status, body = excluded.body, expires_at = excluded.expires_at`
			)
			.bind(key, status, body, expires)
			.run();
		// Probabilistic TTL sweep — the lazy delete on read only fires for reused
		// keys, so without this the table grows unboundedly.
		if (Math.random() < 0.05) {
			await db.prepare('DELETE FROM idempotency WHERE expires_at < ?').bind(Date.now()).run();
		}
	} catch (err) {
		console.error('[idempotency] save failed', err instanceof Error ? err.message : err);
	}
}
