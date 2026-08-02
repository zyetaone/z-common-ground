/**
 * Run a store read/mutation against the shared D1 room so every Worker isolate
 * — on any colo — sees the same LIVE state.
 *
 * Concurrency contract:
 *  - Same isolate: mutations are serialized by a per-isolate mutex (the Store
 *    is a shared singleton — interleaving sync/fn/persist would corrupt it).
 *  - Cross isolate: persist is a compare-and-swap on updated_at. Losing the
 *    race re-syncs and re-runs the mutation on fresh state; after 3 attempts
 *    the request 409s and the client resyncs (session.post handles 409).
 */
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { store } from './store';
import type { RoomState } from '$lib/game/types';

const MAX_ATTEMPTS = 3;

/** The D1 binding for the current request (undefined in non-request contexts). */
function db() {
	return getRequestEvent().platform?.env?.common_ground_db;
}

let warnedNoD1 = false;
function d1Health() {
	const d = db();
	if (!d && !warnedNoD1) {
		warnedNoD1 = true;
		console.warn(
			'[live] D1 binding "common_ground_db" missing — in-memory only; state will diverge across isolates and vanish on redeploy.'
		);
	}
	return d;
}

/** Per-isolate mutation queue — one sync→mutate→persist at a time. */
let chain: Promise<unknown> = Promise.resolve();

export function withLiveRoom<T>(fn: () => T): Promise<T> {
	const run = chain.then(() => attempt(fn));
	chain = run.catch(() => {});
	return run;
}

/**
 * `fn` MUST be pure with respect to the room — it re-runs (up to MAX_ATTEMPTS)
 * when another isolate wins the CAS. Never put a side effect (email, fal call,
 * payment) inside it; do that in the handler around withLiveRoom.
 */
async function attempt<T>(fn: () => T): Promise<T> {
	const d = d1Health();
	for (let i = 0; i < MAX_ATTEMPTS; i++) {
		await store.sync(d);
		const expected = store.snapshot().updatedAt;
		const result = fn();
		if (await store.persistIfUnchanged(d, expected)) return result;
		// Another isolate wrote first — re-sync and re-run on fresh state.
	}
	throw error(409, 'Room changed under us — refreshed. Please retry.');
}

export async function readLiveRoom(): Promise<RoomState> {
	// Reads never clobber a live writer. But if D1 has no room yet — first
	// request, or a fresh DB — seed it from whatever we hold so the session
	// can't fail to start.
	const d = d1Health();
	const existed = await store.sync(d);
	const room = store.ensure();
	if (!existed) await store.persist(d);
	return room;
}
