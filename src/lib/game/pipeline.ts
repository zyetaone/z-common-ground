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
