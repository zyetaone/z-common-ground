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
 *  - Reads exclude writers but not each other. A poll must not land between a
 *    writer's fn() and persistIfUnchanged (it would overwrite the in-memory
 *    singleton with the pre-mutation D1 copy), but two polls can't corrupt
 *    anything. Serializing reads against each other would also defeat
 *    store.sync's in-flight coalescing, turning N concurrent polls into N
 *    sequential D1 round-trips — measurably worse under a full room.
 *    Hence the readers-writer lock below.
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

/**
 * Per-isolate readers-writer lock.
 *
 * Writers run one at a time and never overlap a read. Readers run concurrently
 * with each other, so `store.sync` can coalesce them into one D1 fetch.
 * Writers take priority: once one is queued, new readers wait behind it, so a
 * steady 500 ms poll from every device can't starve an advance.
 */
let writeChain: Promise<unknown> = Promise.resolve();
let activeReads = 0;
let readsDrained: Promise<void> = Promise.resolve();
let signalReadsDrained: () => void = () => {};
let writersWaiting = 0;

function readAcquired() {
	if (activeReads === 0) {
		readsDrained = new Promise<void>((resolve) => (signalReadsDrained = resolve));
	}
	activeReads += 1;
}

function readReleased() {
	activeReads -= 1;
	if (activeReads === 0) signalReadsDrained();
}

export function withLiveRoom<T>(fn: () => T): Promise<T> {
	writersWaiting += 1;
	const run = writeChain.then(async () => {
		// Let any read that already started finish before we mutate.
		await readsDrained;
		try {
			return await attempt(fn);
		} finally {
			writersWaiting -= 1;
		}
	});
	writeChain = run.catch(() => {});
	return run;
}

/**
 * Reads wait for an in-flight or queued write, then run concurrently with other
 * reads. `store.sync` dedupes the overlapping D1 fetches.
 */
export async function readLiveRoom(): Promise<RoomState> {
	if (writersWaiting > 0) {
		// A write is queued or running — ride behind it so we observe its result
		// and can't interleave with its CAS persist.
		await writeChain.catch(() => {});
	}
	readAcquired();
	try {
		return await readRoom();
	} finally {
		readReleased();
	}
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

async function readRoom(): Promise<RoomState> {
	// Reads never clobber a live writer. Seed D1 from memory ONLY when the row
	// is truly absent (first request / fresh DB). A failed or invalid read must
	// never trigger a persist — writing stale memory over the authoritative
	// row would silently roll back live state.
	const d = d1Health();
	const { existed, failed } = await store.sync(d);
	const room = store.ensure();
	if (!existed && !failed) await store.persist(d);
	return room;
}
