/**
 * Presenter rail labels — pure, no Svelte.
 */
import { ROUND_COUNT } from '$lib/game';
import type { Phase } from '$lib/game/types';

export function advanceLabel(phase: Phase, roundLabel: number): string {
	if (phase === 'lobby') return 'Start R1 →';
	if (phase === 'round') {
		return roundLabel >= ROUND_COUNT ? 'Reveal →' : `R${roundLabel} → R${roundLabel + 1}`;
	}
	if (phase === 'reveal') return 'Finale →';
	return '…';
}

export function canAdvance(phase: Phase): boolean {
	return phase === 'lobby' || phase === 'round' || phase === 'reveal';
}

export function canRetreat(phase: Phase): boolean {
	return phase !== 'lobby';
}
