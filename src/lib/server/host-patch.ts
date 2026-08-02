/**
 * Patch validators for host-editable surface area (persona, scenario, priority labels).
 * Pure functions — return typed Partial<T> for the route handler to merge into the store.
 * `error()` is thrown so the SvelteKit request returns 400 with the message.
 */
import { error } from '@sveltejs/kit';
import { N_PRIORITIES, type Persona, type Scenario } from '$lib/game/types';

/** Print-friendly text only — rejects control chars (newlines, NUL) so a patch
 *  can't smuggle layout breaks or terminal escapes into persisted copy.
 *  Accepts the Latin supplement, extended Latin, and general punctuation so
 *  em-dash (—), en-dash (–), curly quotes, etc. all pass.
 *
 *  This is a *charset* guard, not an XSS guard: `<script>` is printable ASCII
 *  and passes. Markup is handled separately by HAS_MARKUP below, and Svelte
 *  escapes interpolated text anyway (no `{@html}` on any host-editable field). */
const SAFE_TEXT = /^[\x20-\x7E\u00A0-\u02FF\u2010-\u205F]*$/;

/** Emoji fields are pictographic by definition, so SAFE_TEXT would reject every
 *  default (📈 🤖 ✂️ 🌟 🎯). Allow printable text plus the pictographic blocks,
 *  variation selectors and ZWJ used by compound emoji (✂️ = U+2702 U+FE0F). */
const SAFE_EMOJI =
	/^[\x20-\x7E\u00A0-\u02FF\u2010-\u205F\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2B00}-\u{2BFF}]*$/u;

/** Defence in depth: refuse anything that looks like markup or a JS URL, even
 *  though Svelte escapes these on render. Keeps injected copy out of the stored
 *  room in the first place, so a future `{@html}` or PDF/canvas export can't
 *  resurrect it. */
const HAS_MARKUP = /[<>]|javascript:|data:text\/html/i;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Shared text guard for every host-editable string field. */
function assertSafeText(field: string, raw: string, emoji = false): void {
	if (HAS_MARKUP.test(raw)) {
		throw error(400, `${field} must not contain markup`);
	}
	if (!(emoji ? SAFE_EMOJI : SAFE_TEXT).test(raw)) {
		throw error(400, `${field} contains disallowed characters`);
	}
}

const PERSONA_STRING_LIMITS = {
	name: 80,
	lens: 140,
	mission: 240,
	strength: 240,
	risk: 240,
	hashtag: 18
} as const;

const SCENARIO_STRING_LIMITS = {
	title: 80,
	question: 240,
	instruction: 240,
	hint: 240,
	emoji: 8
} as const;

export const PRIORITY_LABEL_LIMIT = 80;

const ROUND_MODES = ['wait', 'capture', 'hold'] as const;
const ROUND_MOVES = ['add', 'remove'] as const;

/** Validate and cleanly project a host persona edit. Drops unknown keys. */
export function sanitizePersonaPatch(input: Record<string, unknown>): Partial<Persona> {
	const out: Partial<Persona> = {};

	for (const [key, raw] of Object.entries(input)) {
		switch (key) {
			case 'name':
			case 'lens':
			case 'mission':
			case 'strength':
			case 'risk':
			case 'hashtag': {
				if (typeof raw !== 'string') throw error(400, `persona.${key} must be a string`);
				if (raw.length > PERSONA_STRING_LIMITS[key]) {
					throw error(400, `persona.${key} exceeds ${PERSONA_STRING_LIMITS[key]} chars`);
				}
				assertSafeText(`persona.${key}`, raw);
				out[key] = raw;
				break;
			}
			case 'color': {
				if (typeof raw !== 'string' || !HEX_COLOR.test(raw)) {
					throw error(400, 'persona.color must be a 6-digit hex color (#RRGGBB)');
				}
				out.color = raw;
				break;
			}
			case 'bias': {
				if (
					!Array.isArray(raw) ||
					raw.length !== N_PRIORITIES ||
					!raw.every((v) => typeof v === 'number' && Number.isFinite(v))
				) {
					throw error(400, `persona.bias must be an array of ${N_PRIORITIES} finite numbers`);
				}
				out.bias = raw as Persona['bias'];
				break;
			}
		}
	}

	return out;
}

/** Validate and cleanly project a host scenario edit. Drops unknown keys. */
export function sanitizeScenarioPatch(input: Record<string, unknown>): Partial<Scenario> {
	const out: Partial<Scenario> = {};

	for (const [key, raw] of Object.entries(input)) {
		switch (key) {
			case 'title':
			case 'question':
			case 'instruction':
			case 'hint':
			case 'emoji': {
				if (typeof raw !== 'string') throw error(400, `scenario.${key} must be a string`);
				const isEmoji = key === 'emoji';
				// Emoji are multi-code-unit (✂️ is 2, 🎯 is 2), so count grapheme-ish
				// code points rather than UTF-16 length or the 8-char cap fits only ~4.
				const len = isEmoji ? [...raw].length : raw.length;
				if (len > SCENARIO_STRING_LIMITS[key]) {
					throw error(400, `scenario.${key} exceeds ${SCENARIO_STRING_LIMITS[key]} chars`);
				}
				assertSafeText(`scenario.${key}`, raw, isEmoji);
				out[key] = raw;
				break;
			}
			case 'mode': {
				if (typeof raw !== 'string' || !ROUND_MODES.includes(raw as Scenario['mode'])) {
					throw error(400, `scenario.mode must be one of ${ROUND_MODES.join(', ')}`);
				}
				out.mode = raw as Scenario['mode'];
				break;
			}
			case 'move': {
				if (typeof raw !== 'string' || !ROUND_MOVES.includes(raw as Scenario['move'])) {
					throw error(400, `scenario.move must be one of ${ROUND_MOVES.join(', ')}`);
				}
				out.move = raw as Scenario['move'];
				break;
			}
		}
	}

	return out;
}

/** Validate the 7 priority labels. */
export function sanitizePriorityLabels(labels: unknown[]): string[] {
	if (labels.length !== N_PRIORITIES) {
		throw error(400, `priorities must contain exactly ${N_PRIORITIES} labels`);
	}
	return labels.map((label, i) => {
		if (typeof label !== 'string') throw error(400, `priorities[${i}] must be a string`);
		if (label.length > PRIORITY_LABEL_LIMIT) {
			throw error(400, `priorities[${i}] exceeds ${PRIORITY_LABEL_LIMIT} chars`);
		}
		assertSafeText(`priorities[${i}]`, label);
		return label;
	});
}
