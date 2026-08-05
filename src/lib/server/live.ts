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
 *  - Past READ_DEADLINE_MS a read gives up waiting and proceeds. That trades a
 *    hung deck for a rare lost mutation: a reader that resumes between a
 *    writer's fn() and its CAS can replace the mutated singleton with D1's
 *    older copy, and the writer then persists that. Deliberate — a dropped chip
 *    self-heals on the next write, a request with no first byte does not.
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
 * Ceiling on waiting for the lock itself — for the writer ahead of us, and for
 * in-flight reads to finish. Both were unbounded, and neither has to complete
 * for a mutation to be safe: the compare-and-swap is the real guard.
 */
const LOCK_DEADLINE_MS = 2_000;

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
	const run = withDeadline(writeChain, LOCK_DEADLINE_MS, () => undefined, 'queued behind writer')
		.then(async () => {
			// Let any read that already started finish before we mutate — but not
			// forever. Seven phones polling twice a second plus the presenter and
			// the host console mean `activeReads` can simply never reach zero, and
			// a writer that waits for silence never runs. That is what wedged every
			// POST while GETs stayed healthy: not a slow database, a starved lock.
			// Past the deadline we mutate anyway; the CAS in `attempt` is what
			// actually protects the row, and a read that overlaps it re-syncs.
			await withDeadline(readsDrained, LOCK_DEADLINE_MS, () => undefined, 'reads draining');
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
		// and can't interleave with its CAS persist. Bounded: writeChain is a
		// module-level promise every writer appends to, so one stalled writer
		// would otherwise park every later read on this isolate forever.
		await withDeadline(
			writeChain.catch(() => {}) as Promise<void>,
			READ_DEADLINE_MS,
			() => undefined,
			'read waiting on writeChain'
		);
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
