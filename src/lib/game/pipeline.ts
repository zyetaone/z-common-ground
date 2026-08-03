/**
 * ZyetaI concept pipeline types + the per-table render loop.
 *
 * The pipeline steps (ZYETAI_STEPS) and the regen picker options
 * (LOOK_REGEN_OPTIONS) are UI data and live in their consumer components.
 * This file holds only the contract type and the iteration helper.
 */

/** What to run when regenerating. The picker maps each option to a mode. */
export type ZyetaIRunMode =
	| 'full' // 1→5 concept images + brief
	| 'brief' // reverse + compose only
	| 'images' // room + function concepts only
	| 'lookbook' // recompose brief report
	| 'design'; // workspace design sheets (design page only)

/**
 * Render one image per table, tolerating individual failures.
 *
 * Each call is a paid fal request and completed ones are already persisted
 * server-side, so a throw mid-loop is expensive: it discards the tables after
 * it and forces a re-run that re-pays for every image already made. A table can
 * legitimately fail — the endpoint rejects zero stake, and R3 lets a table
 * remove all of it while a run is in flight.
 *
 * Lives here rather than inline in the runes module so it is importable and
 * testable without a browser.
 *
 * `shouldStop` is polled before each render so an operator cancel takes effect
 * within one image instead of at the end of the loop. Tables not reached are
 * neither rendered nor reported failed — they simply did not run.
 */
export async function renderTablesTolerantly<T>(
	tableIds: number[],
	render: (tableId: number, index: number) => Promise<T>,
	onResult?: (tableId: number, result: T) => void,
	shouldStop?: () => boolean
): Promise<{ rendered: number[]; failedTables: number[]; stopped: boolean }> {
	const rendered: number[] = [];
	const failedTables: number[] = [];
	for (let i = 0; i < tableIds.length; i++) {
		if (shouldStop?.()) return { rendered, failedTables, stopped: true };
		const id = tableIds[i]!;
		try {
			const res = await render(id, i);
			onResult?.(id, res);
			rendered.push(id);
		} catch (err) {
			if (shouldStop?.()) return { rendered, failedTables, stopped: true };
			failedTables.push(id);
			console.error(`[zyetai] table ${id} render failed:`, err);
		}
	}
	return { rendered, failedTables, stopped: false };
}
