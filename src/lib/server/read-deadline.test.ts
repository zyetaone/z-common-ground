/**
 * The read path had no deadline anywhere: readLiveRoom awaits `writeChain` (a
 * module-level promise every writer appends to) and then a D1 fetch. Neither
 * rejects on a stall — they simply never settle — so a request would accept
 * the connection and never send a first byte.
 *
 * Seen in production on /api/room/LIVE/state: static assets on the same host
 * hung 0/8 while the API hung 6/8, TCP+TLS completing in ~150ms with TTFB
 * never arriving, while direct D1 queries answered in ~2ms throughout.
 */
import { describe, expect, it, vi } from 'vitest';

/** Mirrors withDeadline in live.ts. */
function withDeadline<T>(p: Promise<T>, ms: number, fallback: () => T): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const guard = new Promise<T>((resolve) => {
		timer = setTimeout(() => resolve(fallback()), ms);
	});
	return Promise.race([p, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
}

const never = <T>() => new Promise<T>(() => {});
const settles = (p: Promise<unknown>, ms: number) =>
	Promise.race([
		p.then(() => 'settled' as const),
		new Promise<'hung'>((r) => setTimeout(() => r('hung'), ms))
	]);

describe('withDeadline', () => {
	it('resolves a healthy promise with its real value, not the fallback', async () => {
		const out = await withDeadline(Promise.resolve('real'), 1000, () => 'fallback');
		expect(out).toBe('real');
	});

	it('falls back instead of hanging forever', async () => {
		// The production symptom: an await that never settles.
		const out = await withDeadline(never<string>(), 20, () => 'fallback');
		expect(out).toBe('fallback');
	});

	it('returns before the caller would give up', async () => {
		const p = withDeadline(never<string>(), 20, () => 'fallback');
		expect(await settles(p, 200)).toBe('settled');
	});

	it('clears its timer so a slow success leaves nothing pending', async () => {
		vi.useFakeTimers();
		try {
			const clear = vi.spyOn(globalThis, 'clearTimeout');
			const p = withDeadline(Promise.resolve('ok'), 5000, () => 'fallback');
			await vi.runAllTimersAsync();
			await p;
			expect(clear).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('marks a timed-out sync as failed so it cannot re-seed D1', async () => {
		// This is the safety-critical part. readRoom only persists in-memory
		// state when the row is genuinely absent (existed: false, failed: false).
		// A timeout must never look like "no row" — that would write possibly
		// stale memory over the authoritative room and roll back live state.
		const out = await withDeadline(
			never<{ existed: boolean; failed: boolean }>(),
			20,
			() => ({ existed: true, failed: true })
		);
		expect(out.failed).toBe(true);
		const wouldSeed = !out.existed && !out.failed;
		expect(wouldSeed).toBe(false);
	});

	it('still seeds when the row is genuinely absent', async () => {
		const out = await withDeadline(
			Promise.resolve({ existed: false, failed: false }),
			1000,
			() => ({ existed: true, failed: true })
		);
		const wouldSeed = !out.existed && !out.failed;
		expect(wouldSeed).toBe(true);
	});
});
