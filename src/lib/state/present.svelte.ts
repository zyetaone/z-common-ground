/**
 * Presenter analysis deck — 5 screens.
 * Extra analysis in modal (not in this counter).
 */
const TOTAL = 5;

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

	enterAnalysis() {
		screen = 1;
	},

	next() {
		if (screen < TOTAL) screen += 1;
	},

	prev() {
		if (screen > 1) screen -= 1;
	}
};
