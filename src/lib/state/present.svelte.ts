// Presenter analysis deck — pattern-recognition beats (in-page).
// Matrix → Breakdown → Evolution → Priorities → Functions.
// Concepts: /present/LIVE/look · Architectural set: /present/LIVE/design
// Optional deep-link query: s=1 to s=N
import { DECK_SCREENS } from '$lib/game';

/** Single source of truth — the deck's screen list in game/brief.ts. */
const TOTAL = DECK_SCREENS.length;

let screen = $state(1);

export const present = {
	get screen() {
		return screen;
	},
	get total() {
		return TOTAL;
	},

	setScreen(n: number) {
		if (n >= 1 && n <= TOTAL) screen = n;
	},

	/** Enter deck; keep current slide if already in range, else 1. */
	enterAnalysis() {
		if (screen < 1 || screen > TOTAL) screen = 1;
	},

	next() {
		if (screen < TOTAL) screen += 1;
	},

	prev() {
		if (screen > 1) screen -= 1;
	}
};
