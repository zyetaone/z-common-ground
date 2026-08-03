/**
 * The image prompt has one job: turn where the money went into a room that
 * looks like that. These guard the two ways that silently stops being true.
 */
import { describe, expect, it } from 'vitest';
import { finalePrompt } from './prompts';

/** matrix helper: 7 priorities, values in $M. */
const m = (...v: number[]) => v;


describe('finalePrompt reflects where the money went', () => {
	// Regression: the prompt used only the top 4 priorities and gave each the
	// same amount of text, so a room with a clear lead and a room with none
	// produced byte-identical design instructions.
	it('a led room and a flat room do not produce the same instructions', () => {
		const led = finalePrompt(m(40, 10, 10, 10, 10, 10, 10));
		const flat = finalePrompt(m(15, 15, 14, 14, 14, 14, 14));
		expect(led).not.toBe(flat);
	});

	it('two differently-led rooms produce different instructions', () => {
		const talentLed = finalePrompt(m(40, 10, 10, 10, 10, 10, 10));
		const futureLed = finalePrompt(m(10, 10, 10, 10, 10, 10, 40));
		expect(talentLed).not.toBe(futureLed);
	});

	// Regression: with 7 funded priorities the tail was dropped entirely, so
	// roughly a third of the room's money never reached the image.
	it('every funded priority appears, not just the top four', () => {
		const spread = finalePrompt(m(18, 17, 15, 15, 13, 12, 10));
		for (const name of [
			'Talent',
			'Employee Experience',
			'Employer Brand',
			'Productivity',
			'Innovation',
			'Cost / ROI',
			'Future Readiness'
		]) {
			expect(spread).toContain(name);
		}
	});

	it('an unfunded priority stays out of the render', () => {
		const noInnovation = finalePrompt(m(20, 20, 20, 20, 0, 10, 10));
		expect(noInnovation).not.toContain('Innovation');
	});

	// A room has one palette, one mood and one acoustic character. Emitting
	// four sets of each is how renders turned to mush.
	it('only the lead priority sets the whole-room properties', () => {
		const led = finalePrompt(m(40, 10, 10, 10, 10, 10, 10));
		expect(led.match(/drives the palette/g) ?? []).toHaveLength(1);
		expect(led.match(/sets the room mood/g) ?? []).toHaveLength(1);
		expect(led.match(/sets the acoustic character/g) ?? []).toHaveLength(1);
	});

	it('gives the lead more description than a minor priority', () => {
		const p = finalePrompt(m(50, 5, 5, 10, 10, 10, 10));
		const lead = p.slice(p.indexOf('Talent ('), p.indexOf('|'));
		expect(lead).toContain('materials');
		// A 5% priority is an accent, not a full art direction.
		expect(p).toContain('accents only');
	});

	it('is deterministic', () => {
		const a = finalePrompt(m(30, 20, 10, 10, 10, 10, 10));
		const b = finalePrompt(m(30, 20, 10, 10, 10, 10, 10));
		expect(a).toBe(b);
	});

	it('survives an empty room without inventing a lead', () => {
		const empty = finalePrompt(m(0, 0, 0, 0, 0, 0, 0));
		expect(empty).toContain('balanced');
		expect(empty.length).toBeGreaterThan(0);
	});
});

describe('priority vocabularies stay distinct', () => {
	// Productivity and Innovation both describe "work happening in rooms".
	// They shared 7 keyword stems, which made the two mixes render alike.
	it('a Productivity-led and an Innovation-led room read differently', () => {
		const prod = finalePrompt(m(5, 5, 5, 55, 10, 10, 10));
		const inno = finalePrompt(m(5, 5, 5, 10, 55, 10, 10));
		expect(prod).not.toBe(inno);
		// The lead vocabulary should be visibly different, not just reordered.
		expect(prod).toContain('deep work');
		expect(inno).toContain('prototyping benches');
	});
});
