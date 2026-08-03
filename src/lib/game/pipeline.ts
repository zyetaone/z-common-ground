/**
 * ZyetaI concept pipeline (Look page) — sequential stages:
 *   1 Lenses → 2 Brief → 3 Zones → 4 Images (room, then each lens) → 5 Lookbook
 * Design drawings are a separate pipeline on /present/LIVE/design.
 */
export const ZYETAI_STEPS = [
	{
		id: 1,
		key: 'lens' as const,
		label: 'Lenses',
		short: '1 · Lenses',
		desc: 'Read each function’s priority shape.'
	},
	{
		id: 2,
		key: 'reverse' as const,
		label: 'Brief',
		short: '2 · Brief',
		desc: 'Write the analysis brief from the room mix.'
	},
	{
		id: 3,
		key: 'zones' as const,
		label: 'Zones',
		short: '3 · Zones',
		desc: 'Map multi-zone spatial requirements.'
	},
	{
		id: 4,
		key: 'images' as const,
		label: 'Images',
		short: '4 · Images',
		desc: 'Room concept, then each function still — in order.'
	},
	{
		id: 5,
		key: 'lookbook' as const,
		label: 'Lookbook',
		short: '5 · Lookbook',
		desc: 'Compose brief + DBR after images exist.'
	}
] as const;

export type ZyetaIStepKey = (typeof ZYETAI_STEPS)[number]['key'];

/** What to run when regenerating. */
export type ZyetaIRunMode =
	| 'full' // 1→5 concept images + brief
	| 'brief' // reverse + compose only
	| 'images' // room + function concepts only
	| 'lookbook' // recompose brief report
	| 'design'; // workspace design sheets (design page only)

/** Regen choices on the Look (analysis) screen — no workspace design. */
export const LOOK_REGEN_OPTIONS: Array<{
	mode: Exclude<ZyetaIRunMode, 'design'>;
	label: string;
	hint: string;
}> = [
	{
		mode: 'full',
		label: 'Full pipeline (1→5)',
		hint: 'Lenses → brief → zones → images (room then lenses) → lookbook.'
	},
	{
		mode: 'brief',
		label: 'Brief only (1→3, 5)',
		hint: 'Refresh brief + zones + lookbook; keep concept images.'
	},
	{
		mode: 'images',
		label: 'Images only (4→5)',
		hint: 'New room concept + any missing function stills, then recompose lookbook.'
	},
	{
		mode: 'lookbook',
		label: 'Lookbook only (5)',
		hint: 'Recompose brief/DBR from current images; no new fal calls.'
	}
];

/** @deprecated use LOOK_REGEN_OPTIONS — kept for import compatibility */
export const REGEN_OPTIONS = LOOK_REGEN_OPTIONS;

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
 */
export async function renderTablesTolerantly<T>(
	tableIds: number[],
	render: (tableId: number, index: number) => Promise<T>,
	onResult?: (tableId: number, result: T) => void
): Promise<{ rendered: number[]; failedTables: number[] }> {
	const rendered: number[] = [];
	const failedTables: number[] = [];
	for (let i = 0; i < tableIds.length; i++) {
		const id = tableIds[i]!;
		try {
			const res = await render(id, i);
			onResult?.(id, res);
			rendered.push(id);
		} catch (err) {
			failedTables.push(id);
			console.error(`[zyetai] table ${id} render failed:`, err);
		}
	}
	return { rendered, failedTables };
}
