import { describe, expect, it } from 'vitest';
import { stepIsCurrent } from './phase';

/**
 * The guard that stops a retried advance from skipping a round: the client
 * replays the same request after a network failure, and the room body is too
 * large for the idempotency cache to replay the stored response instead.
 */
describe('stepIsCurrent — advance/retreat replay guard', () => {
	const at = (phase: string, round: number) => ({ phase, round }) as never;

	it('moves when the caller is on the round it thinks it is', () => {
		expect(stepIsCurrent(at('round', 2), { phase: 'round', round: 2 })).toBe(true);
	});

	it('refuses when the round already moved — the retry must not double-advance', () => {
		expect(stepIsCurrent(at('round', 3), { phase: 'round', round: 2 })).toBe(false);
	});

	it('refuses when only the phase moved', () => {
		expect(stepIsCurrent(at('reveal', 4), { phase: 'round', round: 4 })).toBe(false);
	});

	it('opts out when the caller sends no position', () => {
		expect(stepIsCurrent(at('round', 2), undefined)).toBe(true);
	});
});
