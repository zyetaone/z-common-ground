/**
 * Contrast guard for the design tokens.
 *
 * The palette carries specific accessibility promises ("4.6:1 on cream"), and
 * those are arithmetic — so they can be checked rather than trusted. Without
 * this, a future palette tweak silently drops text below WCAG AA and nothing
 * fails until someone squints at a projector.
 *
 * Ratios are WCAG 2.1 relative luminance.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app.css', 'utf8');

/** Read a hex token, optionally the copy scoped inside a selector block. */
function token(name: string, scope?: string): string {
	if (scope) {
		const block = new RegExp(`${scope.replace('.', '\\.')}[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(css);
		if (block) {
			const scoped = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(block[1]);
			if (scoped) return scoped[1];
		}
	}
	const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
	if (!m) throw new Error(`token ${name} not found`);
	return m[1];
}

function luminance(hex: string): number {
	let h = hex.replace('#', '');
	if (h.length === 3) h = [...h].map((c) => c + c).join('');
	const chan = (i: number) => {
		const v = parseInt(h.slice(i, i + 2), 16) / 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}

function ratio(fg: string, bg: string): number {
	const a = luminance(fg);
	const b = luminance(bg);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const AA = 4.5; // WCAG AA, normal text
const AA_LARGE = 3; // WCAG AA, large/bold text

describe('token contrast on the cream surface', () => {
	const cream = token('--color-bg');

	it.each([
		['--color-ink', AA],
		['--color-muted', AA],
		['--color-gold-ink', AA],
		['--color-teal-ink', AA],
		['--color-red', AA_LARGE] // used for danger accents and headings
	])('%s clears its WCAG minimum on cream', (name, min) => {
		expect(ratio(token(name), cream)).toBeGreaterThanOrEqual(min);
	});

	// Raw brand gold/teal are for fills, borders and dots — not body text.
	// If someone reaches for them as a text colour, this documents why not.
	it('documents that raw gold is not AA as text on cream', () => {
		expect(ratio(token('--color-gold'), cream)).toBeLessThan(AA);
	});
});

describe('token contrast on the stage-dark surface', () => {
	const panel = token('--color-panel', '.stage-dark');

	it.each([
		['--color-teal-ink', AA],
		['--color-gold-ink', AA]
	])('%s clears WCAG AA on the dark panel', (name, min) => {
		expect(ratio(token(name, '.stage-dark'), panel)).toBeGreaterThanOrEqual(min);
	});
});

describe('token contrast on the board felt', () => {
	// The printable board and /boards index paint text straight onto felt.
	// These are physical artifacts people read across a table, so AA matters
	// as much as on screen.
	const felt = token('--color-felt');

	it.each([
		['--color-felt-ink', AA],
		['--color-felt-muted', AA] // /boards caption is 12px — not "large text"
	])('%s clears WCAG AA on plain felt', (name, min) => {
		expect(ratio(token(name), felt)).toBeGreaterThanOrEqual(min);
	});

	it('stays legible on the darker felt panel too', () => {
		const deep = token('--color-felt-deep');
		expect(ratio(token('--color-felt-ink'), deep)).toBeGreaterThanOrEqual(AA);
		expect(ratio(token('--color-felt-muted'), deep)).toBeGreaterThanOrEqual(AA);
	});
});

describe('text on solid fills', () => {
	// Pills and badges: ink on a gold fill. Measured 6.14:1 — comfortably AA,
	// short of AAA. Recorded so a palette change can't quietly drop it below AA.
	it('on-gold text clears AA against the gold fill', () => {
		expect(ratio(token('--color-on-gold'), token('--color-gold'))).toBeGreaterThanOrEqual(AA);
	});

	// Regression: white on the *brand* teal is 4.18:1 — below AA. Solid-fill
	// controls use --color-teal-fill instead, so this must stay above the line.
	it('on-teal text clears AA against the teal fill used for buttons', () => {
		expect(ratio(token('--color-on-teal'), token('--color-teal-fill'))).toBeGreaterThanOrEqual(AA);
	});

	it('documents why raw brand teal is not a fill behind white text', () => {
		expect(ratio(token('--color-on-teal'), token('--color-teal'))).toBeLessThan(AA);
	});
});
