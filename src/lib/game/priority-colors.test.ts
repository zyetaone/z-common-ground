/**
 * PRIORITY_COLORS is a chart *encoding*, not decoration: on the presenter deck
 * the stacked bars distinguish priorities by colour alone, and any segment
 * under 12% carries no inline label. Two pairs used to collide badly enough to
 * read as one block (Experience/Future at dE 15, Talent/Brand at dE 9 under
 * deuteranopia). These bounds keep a future palette edit honest.
 */
import { describe, expect, it } from 'vitest';
import { PRIORITY_COLORS, PRIORITIES } from '$lib/game';

type RGB = [number, number, number];

function rgb(hex: string): RGB {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16),
		parseInt(h.slice(2, 4), 16),
		parseInt(h.slice(4, 6), 16)
	];
}

function lin(c: number): number {
	const s = c / 255;
	return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function lab(hex: string): RGB {
	const [r, g, b] = rgb(hex).map(lin) as RGB;
	let X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
	const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	let Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
	const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	X = f(X);
	Z = f(Z);
	const fy = f(Y);
	return [116 * fy - 16, 500 * (X - fy), 200 * (fy - Z)];
}

/** CIE76 colour difference. */
function deltaE(a: string, b: string): number {
	const [l1, a1, b1] = lab(a);
	const [l2, a2, b2] = lab(b);
	return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Approximate deuteranopia — the most common colour-vision deficiency. */
function deuteranope(hex: string): string {
	const [r, g, b] = rgb(hex).map(lin) as RGB;
	const L = 17.8824 * r + 43.5161 * g + 4.11935 * b;
	const S = 0.0299566 * r + 0.184309 * g + 1.46709 * b;
	const M2 = 0.494207 * L + 1.24827 * S;
	const out: RGB = [
		0.0809444479 * L - 0.130504409 * M2 + 0.116721066 * S,
		-0.0102485335 * L + 0.0540193266 * M2 - 0.113614708 * S,
		-0.000365296938 * L - 0.00412161469 * M2 + 0.693511405 * S
	];
	const unlin = (c: number) => {
		const x = Math.max(0, Math.min(1, c));
		return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
	};
	return (
		'#' +
		out
			.map((c) =>
				Math.round(unlin(c) * 255)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

function contrast(a: string, b: string): number {
	const rel = (hex: string) => {
		const [r, g, bb] = rgb(hex).map(lin) as RGB;
		return 0.2126 * r + 0.7152 * g + 0.0722 * bb;
	};
	const [hi, lo] = [rel(a), rel(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const pairs = () => {
	const out: Array<[number, number]> = [];
	for (let i = 0; i < PRIORITY_COLORS.length; i++) {
		for (let j = i + 1; j < PRIORITY_COLORS.length; j++) out.push([i, j]);
	}
	return out;
};

describe('PRIORITY_COLORS', () => {
	it('has one colour per priority', () => {
		expect(PRIORITY_COLORS.length).toBe(PRIORITIES.length);
	});

	it('keeps every pair distinguishable for normal vision', () => {
		for (const [i, j] of pairs()) {
			const d = deltaE(PRIORITY_COLORS[i], PRIORITY_COLORS[j]);
			expect(
				d,
				`${PRIORITIES[i]} vs ${PRIORITIES[j]} only dE ${d.toFixed(1)} apart`
			).toBeGreaterThan(25);
		}
	});

	it('keeps every pair distinguishable under deuteranopia', () => {
		// ~6% of men. Pre-fix, Talent vs Brand collapsed to dE 9.2 here, so a
		// stacked bar showed two adjacent segments as a single block.
		for (const [i, j] of pairs()) {
			const d = deltaE(deuteranope(PRIORITY_COLORS[i]), deuteranope(PRIORITY_COLORS[j]));
			expect(
				d,
				`${PRIORITIES[i]} vs ${PRIORITIES[j]} only dE ${d.toFixed(1)} apart for deuteranopes`
			).toBeGreaterThan(15);
		}
	});

	it('stays visible as a fill on both themes', () => {
		// The deck renders on .stage-dark (#10160f), the phone and host on cream.
		// A fill has to read as a distinct block on either.
		for (let i = 0; i < PRIORITY_COLORS.length; i++) {
			const light = contrast(PRIORITY_COLORS[i], '#fdf8ed');
			const dark = contrast(PRIORITY_COLORS[i], '#18221a');
			expect(light, `${PRIORITIES[i]} washes out on cream`).toBeGreaterThan(1.4);
			expect(dark, `${PRIORITIES[i]} washes out on the dark stage`).toBeGreaterThan(3);
		}
	});

	it('carries a readable percentage label on every fill', () => {
		// The stacked bars print a 10px % inside each segment. Two wrong answers
		// were shipped before this bound existed: white (1.59:1 on Talent), then
		// var(--color-ink) — which looks right but resolves to CREAM inside
		// .stage-dark, failing all seven again at 1.35:1. The label is a literal
		// dark value because the fills are pale in both themes.
		for (let i = 0; i < PRIORITY_COLORS.length; i++) {
			const c = contrast(PRIORITY_COLORS[i], '#111a14');
			expect(c, `${PRIORITIES[i]} label unreadable at ${c.toFixed(2)}:1`).toBeGreaterThan(4.5);
		}
	});

	it('keeps Cost / ROI on the brand red', () => {
		// Load-bearing elsewhere: danger, the R3 cut round, the fault chip.
		expect(PRIORITY_COLORS[5].toLowerCase()).toBe('#e0554b');
	});
});
