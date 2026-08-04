/**
 * The two rules that used to be written more than once.
 *
 * `canDraftDelta` had four copies (row ±, tap handler, + disabled, page draft)
 * and they disagreed in production: the + button rendered enabled while the tap
 * handler rejected every put-back.
 *
 * `sealTargetFor` replaces `roundLabel === 2 / === 3 / + 1 === 5` literals that
 * appeared in both the server rules and the phone. `move` is host-editable, so
 * the round number was never a safe proxy for the round's rule.
 */
import { describe, expect, it } from 'vitest';
import { SCENARIOS, sealTargetFor, sealTargetTokens } from '../config';
import { canDraftDelta } from './board';
import type { Scenario } from '../types';

const CHIP = 10;

describe('canDraftDelta', () => {
	const add = (o: Partial<Parameters<typeof canDraftDelta>[0]>) =>
		canDraftDelta({ removeOnly: false, current: 0, baseline: 0, delta: CHIP, remaining: 100, ...o });

	it('allows an add while the wallet has room', () => {
		expect(add({})).toBe(true);
	});

	it('refuses an add that exceeds the wallet headroom', () => {
		expect(add({ remaining: 0 })).toBe(false);
		expect(add({ remaining: CHIP - 1 })).toBe(false);
	});

	it('allows put-back in a remove round up to the round-open baseline', () => {
		// Cut 40 → 10 of a row that opened at 40: two put-backs fit, the third does not.
		expect(add({ removeOnly: true, current: 10, baseline: 40 })).toBe(true);
		expect(add({ removeOnly: true, current: 30, baseline: 40 })).toBe(true);
		expect(add({ removeOnly: true, current: 40, baseline: 40 })).toBe(false);
	});

	it('never lets a remove round grow past where it started', () => {
		expect(add({ removeOnly: true, current: 40, baseline: 30 })).toBe(false);
	});

	it('ignores the wallet when putting back — the chips are already accounted for', () => {
		expect(add({ removeOnly: true, current: 10, baseline: 40, remaining: 0 })).toBe(true);
	});

	it('allows a remove only when the chip fits in the cell', () => {
		const minus = (current: number) =>
			canDraftDelta({ removeOnly: true, current, baseline: 40, delta: -CHIP, remaining: 0 });
		expect(minus(10)).toBe(true);
		expect(minus(0)).toBe(false);
		// A part-chip cell: enabling this would render a live button that the
		// draft then refuses, because the row cannot go negative.
		expect(minus(5)).toBe(false);
	});

	it('rejects a zero or non-finite delta', () => {
		expect(add({ delta: 0 })).toBe(false);
		expect(add({ delta: Number.NaN })).toBe(false);
	});
});

describe('sealTargetFor', () => {
	const byLabel = (n: number) => SCENARIOS.find((s) => s.roundLabel === n)!;

	it('carries the shipped rules for R2, R3 and R5', () => {
		expect(sealTargetFor(byLabel(2))).toEqual({ kind: 'full' });
		expect(sealTargetFor(byLabel(3))?.kind).toBe('remove');
		expect(sealTargetFor(byLabel(5))?.kind).toBe('cap');
	});

	it('leaves the freeze-only rounds without a target', () => {
		expect(sealTargetFor(byLabel(1))).toBeUndefined();
		expect(sealTargetFor(byLabel(4))).toBeUndefined();
	});

	it('defaults any remove round to a removal target, wherever the host moves it', () => {
		// The bug this closes: `move` is host-editable, so a host could make R4 the
		// remove round. The direction was enforced (scenario-driven) but the amount
		// was gated on `roundLabel === 3`, so the round sealed with nothing cut.
		const moved = { ...byLabel(4), move: 'remove' } as Scenario;
		expect(sealTargetFor(moved)).toEqual({ kind: 'remove', fraction: 0.3 });
	});

	it('lets an explicit target win over the move-derived default', () => {
		const explicit = { ...byLabel(3), sealTarget: { kind: 'full' } } as Scenario;
		expect(sealTargetFor(explicit)).toEqual({ kind: 'full' });
	});
});

describe('sealTargetTokens', () => {
	it('scales every target to the host-configured wallet, not the $100M default', () => {
		const opts = { wallet: 70, standing: 50 };
		expect(sealTargetTokens({ kind: 'full' }, opts)).toBe(70);
		expect(sealTargetTokens({ kind: 'remove', fraction: 0.3 }, opts)).toBe(15); // ceil(50 * .3)
		expect(sealTargetTokens({ kind: 'cap', fraction: 0.9 }, opts)).toBe(63); // floor(70 * .9)
	});

	it('rounds the removal up so a table can never under-cut by a part chip', () => {
		expect(sealTargetTokens({ kind: 'remove', fraction: 0.3 }, { wallet: 100, standing: 35 })).toBe(11);
	});

	it('has no target when the round has no rule', () => {
		expect(sealTargetTokens(undefined, { wallet: 100, standing: 100 })).toBeUndefined();
	});
});
