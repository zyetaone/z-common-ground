/**
 * The readers-writer lock in live.ts serialises writers and lets reads run
 * concurrently. Under a real boot — session.boot() fires ensure() (a write)
 * and poll() (a read) together — it deadlocked, and POST /api/room hung until
 * the client timed out while GET /state stayed fast.
 *
 * These reproduce the interleavings against the same lock shape.
 */
import { describe, expect, it } from 'vitest';

/** Mirrors the lock in live.ts so the ordering can be exercised in isolation. */
function makeLock() {
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

	return {
		write<T>(fn: () => Promise<T> | T): Promise<T> {
			writersWaiting += 1;
			const run = writeChain.then(async () => {
				await readsDrained;
				try {
					return await fn();
				} finally {
					writersWaiting -= 1;
				}
			});
			writeChain = run.catch(() => {});
			return run as Promise<T>;
		},
		async read<T>(fn: () => Promise<T> | T): Promise<T> {
			if (writersWaiting > 0) await writeChain.catch(() => {});
			readAcquired();
			try {
				return await fn();
			} finally {
				readReleased();
			}
		}
	};
}

const settles = <T>(p: Promise<T>, ms = 300) =>
	Promise.race([
		p.then(() => 'settled' as const),
		new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))
	]);

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

describe('live.ts readers-writer lock', () => {
	it('completes a write issued while a read is in flight', async () => {
		// This is the boot sequence: poll() (read) and ensure() (write) overlap.
		const lock = makeLock();
		let releaseRead: () => void = () => {};
		const readGate = new Promise<void>((r) => (releaseRead = r));

		const read = lock.read(async () => {
			await readGate;
			return 'read';
		});
		await tick();
		const write = lock.write(async () => 'write');

		// Let the read finish; the write must then drain and resolve.
		releaseRead();
		expect(await settles(Promise.all([read, write]))).toBe('settled');
	});

	it('does not deadlock when a second read arrives behind a queued write', async () => {
		// The reported hang: read A in flight, write queued behind it, read B
		// arrives and waits on writeChain — which is waiting on read A draining.
		const lock = makeLock();
		let releaseA: () => void = () => {};
		const gateA = new Promise<void>((r) => (releaseA = r));

		const readA = lock.read(async () => {
			await gateA;
			return 'A';
		});
		await tick();
		const write = lock.write(async () => 'W');
		await tick();
		const readB = lock.read(async () => 'B');

		releaseA();
		expect(await settles(Promise.all([readA, write, readB]))).toBe('settled');
	});

	it('keeps writers serialised', async () => {
		const lock = makeLock();
		const order: string[] = [];
		const w1 = lock.write(async () => {
			order.push('w1-start');
			await tick(20);
			order.push('w1-end');
		});
		const w2 = lock.write(async () => {
			order.push('w2-start');
			order.push('w2-end');
		});
		await Promise.all([w1, w2]);
		expect(order).toEqual(['w1-start', 'w1-end', 'w2-start', 'w2-end']);
	});

	it('lets concurrent reads overlap so store.sync can coalesce them', async () => {
		const lock = makeLock();
		let inFlight = 0;
		let maxInFlight = 0;
		await Promise.all(
			Array.from({ length: 5 }, () =>
				lock.read(async () => {
					inFlight += 1;
					maxInFlight = Math.max(maxInFlight, inFlight);
					await tick(10);
					inFlight -= 1;
				})
			)
		);
		expect(maxInFlight).toBeGreaterThan(1);
	});
});
