/**
 * Run a store read/mutation against the shared D1 room so every Worker isolate
 * — on any colo — sees the same LIVE state.
 */
import { getRequestEvent } from '$app/server';
import { store } from './store';
import type { RoomState } from '$lib/game/types';

/** The D1 binding for the current request (undefined in non-request contexts). */
function db() {
	return getRequestEvent().platform?.env?.common_ground_db;
}

export async function withLiveRoom<T>(fn: () => T): Promise<T> {
	const d = db();
	await store.sync(d);
	const result = fn();
	await store.persist(d);
	return result;
}

export async function readLiveRoom(): Promise<RoomState> {
	// Reads never clobber a live writer. But if D1 has no room yet — first
	// request, or a fresh DB — seed it from whatever we hold so the session
	// can't fail to start.
	const d = db();
	const existed = await store.sync(d);
	const room = store.ensure();
	if (!existed) await store.persist(d);
	return room;
}
