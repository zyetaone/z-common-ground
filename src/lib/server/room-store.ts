/**
 * Single source of truth for the LIVE room: one D1 row.
 *
 * D1 has a single primary, so every colo reads the same state — unlike the
 * Cache API (per-colo), which split writes and reads across a multi-colo edge.
 * The whole room is one JSON blob under id 'LIVE'; last write wins.
 */
import type { RoomState } from '$lib/game/types';

const ROOM_ID = 'LIVE';
let schemaReady = false;

/** CREATE TABLE once per isolate — idempotent, self-heals any environment. */
async function ensureSchema(db: D1Database): Promise<void> {
	if (schemaReady) return;
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS room (
				id TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			)`
		)
		.run();
	schemaReady = true;
}

export async function loadRoom(db: D1Database | undefined): Promise<RoomState | null> {
	if (!db) return null;
	try {
		await ensureSchema(db);
		const row = await db
			.prepare('SELECT data FROM room WHERE id = ?')
			.bind(ROOM_ID)
			.first<{ data: string }>();
		if (!row) return null;
		const data = JSON.parse(row.data) as RoomState;
		if (!data || typeof data.updatedAt !== 'number' || !Array.isArray(data.tables)) return null;
		return data;
	} catch (err) {
		console.error('[room-store] load failed', err instanceof Error ? err.message : err);
		return null;
	}
}

export async function saveRoom(db: D1Database | undefined, room: RoomState): Promise<void> {
	if (!db) return;
	try {
		await ensureSchema(db);
		await db
			.prepare(
				`INSERT INTO room (id, data, updated_at) VALUES (?, ?, ?)
				 ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
			)
			.bind(ROOM_ID, JSON.stringify(room), room.updatedAt ?? Date.now())
			.run();
	} catch (err) {
		console.error('[room-store] save failed', err instanceof Error ? err.message : err);
	}
}
