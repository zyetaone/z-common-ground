/**
 * Screen 4 shows each function's cut (R2→R3) and rebuild (R3→R5) as chips,
 * plus a net. The net is the part that is easy to get wrong: it looks like it
 * should be `rebuildTotal - cutTotal`, but those two lists are filtered — cut
 * holds only R3 *decreases*, rebuild only R5 *increases*. Money moved OFF a
 * priority at R5 appears in neither, so the inferred net silently overstates.
 */
import { describe, expect, it } from 'vitest';

/** The shipped calculation: true signed movement between two rounds. */
function netR2toR5(r2: number[], r5: number[]): number {
	let net = 0;
	for (let i = 0; i < r2.length; i++) net += (r5[i] ?? 0) - (r2[i] ?? 0);
	return net;
}

/** The pre-fix calculation, kept to pin the bug it caused. */
function inferredNet(r2: number[], r3: number[], r5: number[]): number {
	let cut = 0;
	let build = 0;
	for (let i = 0; i < r2.length; i++) {
		const d3 = (r3[i] ?? 0) - (r2[i] ?? 0);
		if (d3 < 0) cut += -d3;
		const d5 = (r5[i] ?? 0) - (r3[i] ?? 0);
		if (d5 > 0) build += d5;
	}
	return build - cut;
}

describe('PrioritiesSummary net', () => {
	it('matches the inferred net when R5 only adds', () => {
		// [Talent, EE, Brand, Productivity, Innovation, Cost, Future]
		const r2 = [50, 0, 0, 30, 0, 20, 0];
		const r3 = [20, 0, 0, 20, 0, 20, 0]; // cut 30 + 10
		const r5 = [50, 0, 0, 20, 0, 50, 0]; // build 30 + 30
		expect(netR2toR5(r2, r5)).toBe(20);
		expect(inferredNet(r2, r3, r5)).toBe(20); // agrees in the simple case
	});

	it('reports the real loss when a table REALLOCATES at R5', () => {
		// R5 is an add round, but applyBoardDelta only blocks positive deltas on
		// remove rounds — a negative delta at R5 is legal. So a table can move
		// money off one priority onto another.
		const r2 = [50, 0, 0, 0, 0, 40, 0];
		const r3 = [20, 0, 0, 0, 0, 40, 0]; // cut 30 off Talent
		const r5 = [20, 0, 0, 0, 20, 20, 0]; // move 20 off Cost onto Innovation

		// The -20 at R5 is in neither chip list, so the old math loses it and
		// claims the function is only down 10.
		expect(inferredNet(r2, r3, r5)).toBe(-10);
		expect(netR2toR5(r2, r5)).toBe(-30); // the truth
	});

	it('reports flat only when the wallet really returned to its R2 total', () => {
		const r2 = [50, 0, 0, 0, 0, 0, 0];
		const r3 = [20, 0, 0, 0, 0, 0, 0];
		const r5 = [50, 0, 0, 0, 0, 0, 0];
		expect(netR2toR5(r2, r5)).toBe(0);
	});

	it('counts a rebuild past the original position as a gain', () => {
		expect(netR2toR5([50, 0], [90, 0])).toBe(40);
	});

	it('handles ragged rows without NaN', () => {
		expect(netR2toR5([50, 10], [])).toBe(-60);
		expect(netR2toR5([], [30])).toBe(0); // nothing to compare against
	});
});
