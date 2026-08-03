/**
 * The ZyetaI package run is the most expensive thing the app does: two model
 * calls for text plus one fal image per funded table. These guard the ways a
 * partial failure turns into wasted spend.
 */
import { describe, expect, it } from 'vitest';
import { renderTablesTolerantly } from './pipeline';

describe('renderTablesTolerantly', () => {
	// Regression: the render loop had no try/catch, so a 400 on one table threw
	// and discarded every table after it — while the images already generated
	// had been paid for and persisted. A table can legitimately fail mid-run:
	// the endpoint rejects zero stake, and R3 lets a table remove all of it.
	it('keeps rendering after one table fails', async () => {
		const attempted: number[] = [];
		const { rendered, failedTables } = await renderTablesTolerantly(
			[1, 2, 3, 4],
			async (id) => {
				attempted.push(id);
				if (id === 2) throw new Error('No tokens on this table yet');
				return { url: `https://cdn/${id}.webp` };
			}
		);

		expect(attempted).toEqual([1, 2, 3, 4]); // every table was attempted
		expect(rendered).toEqual([1, 3, 4]); // the ones after the failure survived
		expect(failedTables).toEqual([2]);
	});

	it('reports every failure, not just the first', async () => {
		const { rendered, failedTables } = await renderTablesTolerantly(
			[1, 2, 3, 4, 5],
			async (id) => {
				if (id === 2 || id === 5) throw new Error('render failed');
				return { url: `https://cdn/${id}.webp` };
			}
		);
		expect(rendered).toEqual([1, 3, 4]);
		expect(failedTables).toEqual([2, 5]);
	});

	it('reports nothing failed when everything succeeds', async () => {
		const { rendered, failedTables } = await renderTablesTolerantly([1, 2, 3], async (id) => ({
			url: `https://cdn/${id}.webp`
		}));
		expect(rendered).toEqual([1, 2, 3]);
		expect(failedTables).toEqual([]);
	});

	it('survives every table failing without throwing', async () => {
		const { rendered, failedTables } = await renderTablesTolerantly([1, 2, 3], async () => {
			throw new Error('fal is down');
		});
		expect(rendered).toEqual([]);
		expect(failedTables).toEqual([1, 2, 3]);
	});

	it('runs sequentially — fal rate limits punish parallel bursts', async () => {
		const order: string[] = [];
		await renderTablesTolerantly([1, 2, 3], async (id) => {
			order.push(`start${id}`);
			await new Promise((r) => setTimeout(r, 5));
			order.push(`end${id}`);
			return null;
		});
		expect(order).toEqual(['start1', 'end1', 'start2', 'end2', 'start3', 'end3']);
	});

	it('passes the loop index through for progress reporting', async () => {
		const seen: Array<[number, number]> = [];
		await renderTablesTolerantly([7, 4, 1], async (id, i) => {
			seen.push([id, i]);
			return null;
		});
		expect(seen).toEqual([
			[7, 0],
			[4, 1],
			[1, 2]
		]);
	});

	it('only reports a result for tables that succeeded', async () => {
		const applied: number[] = [];
		await renderTablesTolerantly(
			[1, 2, 3],
			async (id) => {
				if (id === 2) throw new Error('boom');
				return { url: `u${id}` };
			},
			(id) => applied.push(id)
		);
		expect(applied).toEqual([1, 3]);
	});

	it('handles an empty list', async () => {
		const { rendered, failedTables } = await renderTablesTolerantly([], async () => null);
		expect(rendered).toEqual([]);
		expect(failedTables).toEqual([]);
	});
});
