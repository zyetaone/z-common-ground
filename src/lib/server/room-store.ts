/**
 * Single source of truth for the LIVE room: one D1 row.
 *
 * D1 has a single primary, so every colo reads the same state — unlike the
 * Cache API (per-colo), which split writes and reads across a multi-colo edge.
 * The whole room is one JSON blob under id 'LIVE'. Mutations persist via
 * saveRoomIfUnchanged, a compare-and-swap on updated_at: the write only lands
 * when the row still matches the version synced before mutating, so a losing
 * isolate's write is rejected instead of silently overwriting. Plain saveRoom
 * (seed/reset paths) is unconditional last-write-wins.
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

/**
 * Conditional save — compare-and-swap on updated_at. Only writes when the D1
 * row still matches `expectedUpdatedAt` (the version we synced before mutating).
 * Returns true when the write won; false when another isolate wrote first.
 * With no D1 binding there is nothing to race against — reports success.
 */
export async function saveRoomIfUnchanged(
	db: D1Database | undefined,
	room: RoomState,
	expectedUpdatedAt: number
): Promise<boolean> {
	if (!db) return true;
	try {
		await ensureSchema(db);
		const res = await db
			.prepare(`UPDATE room SET data = ?, updated_at = ? WHERE id = ? AND updated_at = ?`)
			.bind(JSON.stringify(room), room.updatedAt ?? Date.now(), ROOM_ID, expectedUpdatedAt)
			.run();
		if ((res.meta.changes ?? 0) > 0) return true;
		// No row matched — either first save ever, or someone else wrote first.
		const existing = await db
			.prepare('SELECT updated_at FROM room WHERE id = ?')
			.bind(ROOM_ID)
			.first<{ updated_at: number }>();
		if (existing) return false;
		await db
			.prepare('INSERT INTO room (id, data, updated_at) VALUES (?, ?, ?)')
			.bind(ROOM_ID, JSON.stringify(room), room.updatedAt ?? Date.now())
			.run();
		return true;
	} catch (err) {
		console.error('[room-store] conditional save failed', err instanceof Error ? err.message : err);
		return false;
	}
}
