/**
 * MobileFinale is the last screen a participant sees. Two ways its top-priority
 * readout has misreported: a raw index when labels are absent, and a priority
 * the table never chose when the table never staked.
 */
import { describe, expect, it } from 'vitest';
import { PRIORITIES } from '$lib/game';

/** Mirrors the component's `top` derivation. */
function topPriority(counts: number[], totalTokens: number, labels?: string[]) {
	let best = 0;
	let idx = -1;
	for (let i = 0; i < counts.length; i++) {
		if ((counts[i] ?? 0) > best) {
			best = counts[i] ?? 0;
			idx = i;
		}
	}
	if (idx < 0 || totalTokens <= 0) return { name: '', share: 0, best: 0 };
	const names = labels?.length ? labels : (PRIORITIES as unknown as string[]);
	const name = names[idx]?.trim() || PRIORITIES[idx] || '—';
	return { name, share: Math.round((best / totalTokens) * 100), best };
}

describe('MobileFinale top priority', () => {
	it('names the priority, never a raw index', () => {
		// Regression: with no labels the fallback was `Priority ${idx + 1}`, so a
		// participant's final screen could read "56% on Priority 2".
		const { name, share } = topPriority([0, 50, 0, 20, 0, 10, 10], 90);
		expect(name).toBe(PRIORITIES[1]);
		expect(name).not.toMatch(new RegExp('^Priority \\d'));
		expect(share).toBe(56);
	});

	it('prefers host-supplied labels when present', () => {
		const custom = ['A', 'Custom EE', 'C', 'D', 'E', 'F', 'G'];
		expect(topPriority([0, 50, 0, 20, 0, 10, 10], 90, custom).name).toBe('Custom EE');
	});

	it('falls back to the canonical name for a blank custom label', () => {
		const sparse = ['A', '   ', 'C', 'D', 'E', 'F', 'G'];
		expect(topPriority([0, 50, 0, 20, 0, 10, 10], 90, sparse).name).toBe(PRIORITIES[1]);
	});

	it('reports nothing for a table that never staked', () => {
		// Regression: idx defaulted to 0, so an empty board rendered "0% on Talent"
		// — naming a priority the table never chose. A table can reach the finale
		// without ever submitting.
		expect(topPriority([0, 0, 0, 0, 0, 0, 0], 0)).toEqual({ name: '', share: 0, best: 0 });
	});

	it('handles a single-priority board', () => {
		const { name, share } = topPriority([0, 0, 0, 0, 0, 0, 90], 90);
		expect(name).toBe(PRIORITIES[6]);
		expect(share).toBe(100);
	});
});
