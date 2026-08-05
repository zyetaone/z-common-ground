/**
 * Run a store read/mutation against the shared D1 room so every Worker isolate
 * — on any colo — sees the same LIVE state.
 *
 * Concurrency contract — D1 only, no in-process locking (see the note above
 * `withLiveRoom` for why the readers-writer lock was removed):
 *  - Every mutation re-syncs from D1, applies fn, then compare-and-swaps on
 *    updated_at. Losing the race re-syncs and re-runs on fresh state; after 3
 *    attempts (or MUTATION_BUDGET_MS) the request 409s and the client resyncs.
 *  - The row is written whole, so a read overlapping a write sees the old row
 *    or the new one, never a torn one.
 *  - Concurrent requests on one isolate can interleave against the shared Store
 *    singleton. The CAS is what makes that safe: a mutation only lands if D1
 *    still holds the version its sync read. Worst case is a lost chip that
 *    self-heals on the next write — a request that never answers does not.
 *  - Every await here is bounded. Unbounded waits, not contention, were what
 *    took the room down live.
 */
import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { store } from './store';
import type { RoomState } from '$lib/game/types';

const MAX_ATTEMPTS = 3;

/**
 * Ceiling on any single await in the read path.
 *
 * Nothing here used to have a deadline: `readLiveRoom` awaits `writeChain`,
 * which is a module-level promise that every writer chains onto, and then
 * awaits a D1 fetch. If either stalls rather than rejects, the request never
 * responds — the client sees an open connection with no first byte, and every
 * later read on that isolate queues behind it.
 *
 * Observed in production: static assets on the same host returned 0/8 hung
 * while /api/room/LIVE/state hung 6/8, with TCP and TLS completing in ~150ms
 * and TTFB never arriving. Direct D1 queries answered in ~2ms throughout, so
 * the database was healthy and the stall was in waiting on it.
 *
 * 5s is well past a healthy request (~200-400ms end to end) and well inside
 * the 500ms poll's tolerance for a skipped beat: a poll that degrades to the
 * in-memory snapshot is invisible, a poll that never returns is a dead deck.
 */
const READ_DEADLINE_MS = 5_000;

/**
 * Ceiling on one D1 write. Longer than the read: a write is a CAS that may do
 * an UPDATE, a SELECT and an INSERT, and giving up early costs a retry.
 */
const WRITE_DEADLINE_MS = 8_000;

/**
 * Total budget for one mutation, retries included.
 *
 * `session.post` aborts at 15s (MUTATE_TIMEOUT), so anything slower than this
 * can only ever reach the client as a timeout. Answering with a 409 instead
 * gives it something to act on: it resyncs and the room stays consistent.
 */
const MUTATION_BUDGET_MS = 11_000;

/**
 * Resolve to `fallback` if `p` has not settled within `ms`.
 *
 * The timer is always cleared, so a slow-but-successful promise can't leave a
 * pending timeout holding the isolate open.
 */
function withDeadline<T>(p: Promise<T>, ms: number, fallback: () => T, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const guard = new Promise<T>((resolve) => {
		timer = setTimeout(() => {
			console.warn(`[live] ${label} exceeded ${ms}ms — serving in-memory state`);
			resolve(fallback());
		}, ms);
	});
	return Promise.race([p, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
}

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
 * No per-isolate lock. This used to hold a readers-writer lock: writers ran one
 * at a time behind a module-level `writeChain`, and waited for `readsDrained`
 * before mutating.
 *
 * It was the single source of every outage during the first live session. Two
 * failure modes, both structural rather than tunable:
 *
 *  - `readsDrained` only resolves when in-flight reads hit zero. Seven phones
 *    polling twice a second, plus the presenter and host console, mean it can
 *    simply never resolve. Writers waited for a silence that never came, so
 *    GETs stayed healthy while every POST hung past the client's abort.
 *  - `writeChain` is a promise every writer appends to for the life of the
 *    isolate. One link that never settles poisons every request behind it,
 *    permanently. That is why a redeploy fixed it and it degraded again minutes
 *    later: new isolates, fresh chain, same slow poisoning.
 *
 * None of it was load-bearing. Correctness comes from the compare-and-swap in
 * `attempt`: a mutation reads the room, applies `fn`, and only lands if D1 still
 * holds the version it started from. A losing writer re-syncs and re-runs; a
 * read that overlaps a write sees either the old row or the new one, never a
 * torn one, because the row is written whole. The lock only ever served to make
 * the in-memory singleton's intermediate states invisible — and `store.sync`
 * already re-reads D1 at the top of every mutation.
 *
 * ponytail: no lock. If a future change makes an isolate's in-memory state
 * load-bearing between the sync and the CAS, reach for a Durable Object rather
 * than reviving this.
 */

export function withLiveRoom<T>(fn: () => T): Promise<T> {
	return attempt(fn);
}

export async function readLiveRoom(): Promise<RoomState> {
	return readRoom();
}

/**
 * `fn` MUST be pure with respect to the room — it re-runs (up to MAX_ATTEMPTS)
 * when another isolate wins the CAS. Never put a side effect (email, fal call,
 * payment) inside it; do that in the handler around withLiveRoom.
 */
async function attempt<T>(fn: () => T): Promise<T> {
	const d = d1Health();
	// Budget the WHOLE mutation, not each step inside it.
	//
	// Per-step deadlines are not enough: three attempts of (5s sync + 8s write)
	// is 39s, and session.post gives up at 15s. The client then retries the same
	// Idempotency-Key against a request the server may still be running, and the
	// facilitator sees "signal timed out" on an advance that had no way to answer
	// in time. Finish inside the client's patience or 409 and let it resync —
	// advance/retreat carry `from`, so a replay can't double-step the room.
	const giveUpAt = Date.now() + MUTATION_BUDGET_MS;
	const left = () => giveUpAt - Date.now();

	for (let i = 0; i < MAX_ATTEMPTS; i++) {
		if (left() <= 0) break;
		await store.sync(d);
		const expected = store.snapshot().updatedAt;
		const result = fn();
		// Bounded like the read. This was the last unbounded await in either path:
		// a hung D1 write parked the writer forever, and because `writersWaiting`
		// only drops when the writer finishes, every later read on the isolate
		// paid the full read deadline before it could even start. Treating a
		// stalled write as a lost CAS is correct — the row is unchanged, so the
		// retry re-runs on fresh state and the client resyncs on the 409.
		const won = await withDeadline(
			store.persistIfUnchanged(d, expected),
			Math.max(500, Math.min(WRITE_DEADLINE_MS, left())),
			() => false,
			'persistIfUnchanged'
		);
		if (won) return result;
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
	// store.sync bounds itself (Store.SYNC_DEADLINE_MS) and reports failed:true
	// on the timeout path, which is what stops the seed below from overwriting
	// D1 with possibly-stale memory.
	const { existed, failed } = await store.sync(d);
	const room = store.ensure();
	// Seeding is a write on the read path — bound it, or a stalled D1 write turns
	// a poll into a request that never answers.
	if (!existed && !failed) {
		await withDeadline(store.persist(d), WRITE_DEADLINE_MS, () => undefined, 'seed persist');
	}
	return room;
}
