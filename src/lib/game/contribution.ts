/**
 * How each function contributes to the Common Ground layout / room mix.
 * Pure — drives contribution graphics and architecture presentation.
 */
import { roomPersonas, roomPriorities, tableBountyTokens, tableSeatIndex,
	FALLBACK_COLOR
} from './config';
import { priorityMix, workspaceZonesFromMatrix } from './brief';
import { formatUsd } from './money';
import { sum } from './scoring';
import { N_PRIORITIES, PRIORITIES } from './types';
import type { RoomState } from './types';

export interface ZoneContribution {
	priority: number;
	name: string;
	zone: string;
	pct: number; // of room mix
	color: string;
	preferred: boolean;
	/** Per-function share of this zone’s room total (0–100 of the zone) */
	byFunction: Array<{
		tableId: number;
		name: string;
		color: string;
		tokens: number;
		/** % of this zone’s tokens that came from this function */
		shareOfZone: number;
	}>;
}

export interface ArchitecturePresentation {
	mandate: string;
	concept: string;
	/** Ordered slides for a presenter walkthrough */
	slides: Array<{ title: string; body: string; imageUrl?: string | null; color?: string }>;
	zones: ZoneContribution[];
	/** Layout narrative */
	layoutPlan: string;
	drawingCount: number;
}

/** Zone-level contribution of every function to the room mix. */
export function zoneContributions(room: RoomState): ZoneContribution[] {
	const labels = roomPriorities(room);
	const personas = roomPersonas(room);
	const zones = workspaceZonesFromMatrix(room.aggregate.matrix, labels);
	const roomMix = priorityMix(room.aggregate.matrix, labels);

	return zones.map((z) => {
		const roomTok = roomMix.find((m) => m.priority === z.priority)?.tokens ?? 0;
		const byFunction = room.tables
			.map((t) => {
				const seat = tableSeatIndex(t.id);
				const p = personas[seat] ?? personas[0];
				const tokens = t.matrix?.[z.priority] ?? t.board[seat]?.[z.priority] ?? 0;
				return {
					tableId: t.id,
					name: p?.name ?? `T${t.id}`,
					color: p?.color ?? FALLBACK_COLOR,
					tokens,
					shareOfZone: roomTok > 0 ? Math.round((tokens / roomTok) * 100) : 0
				};
			})
			.filter((f) => f.tokens > 0)
			.sort((a, b) => b.tokens - a.tokens);

		return {
			priority: z.priority,
			name: z.name,
			zone: z.zone,
			pct: z.pct,
			color: z.color,
			preferred: z.preferred,
			byFunction
		};
	});
}

/** Full architecture concept + presentation plan from room state + drawings. */
export function architecturePresentation(room: RoomState): ArchitecturePresentation {
	const zones = zoneContributions(room);
	const preferred = zones.filter((z) => z.preferred);
	const personas = roomPersonas(room);
	const a = room.aggregate;
	const labels = roomPriorities(room);
	const lead = labels[a.alignment] ?? PRIORITIES[a.alignment];
	const leadPct = a.totalCoins
		? Math.round(((a.matrix[a.alignment] ?? 0) / a.totalCoins) * 100)
		: 0;

	const mandate =
		a.totalCoins > 0
			? `Common Ground workplace: ${leadPct}% of combined weight on ${lead}. Floorplate expresses every function’s ${formatUsd(tableBountyTokens(room))} choices as shared zones.`
			: 'Awaiting stakes — concept appears when tables place priorities.';

	const concept =
		preferred.length > 0
			? `Spatial concept: a multi-zone floorplate where ${preferred
					.map((z) => `${z.zone} (${z.pct}%)`)
					.join(', ')} dominate light, materials, and circulation. Secondary priorities sit as support rooms off the main spine.`
			: 'Spatial concept pending room mix.';

	const slides: ArchitecturePresentation['slides'] = [
		{
			title: '01 · Mandate',
			body: mandate,
			imageUrl: room.finaleImageUrl,
			color: '#1F8B78'
		},
		{
			title: '02 · Spatial concept',
			body: concept,
			imageUrl: room.finaleImageUrl,
			color: '#1F8B78'
		}
	];

	for (const z of preferred.slice(0, 4)) {
		const top = z.byFunction.slice(0, 3);
		const who = top.map((f) => `${f.name} ${f.shareOfZone}%`).join(' · ') || 'room-wide';
		// Prefer top funder's function render as zone reference, else room
		const leadTable = z.byFunction[0]?.tableId;
		const zoneImg =
			(leadTable != null
				? room.tables.find((t) => t.id === leadTable)?.imageUrl
				: null) ?? room.finaleImageUrl;
		slides.push({
			title: `Zone · ${z.zone}`,
			body: `${z.pct}% of the Common Ground plan. Contributors: ${who}. This zone’s visual language is set by who funded it most.`,
			imageUrl: zoneImg,
			color: z.color
		});
	}

	for (const t of room.tables) {
		if (!t.imageUrl) continue;
		const p = personas[tableSeatIndex(t.id)] ?? personas[0];
		const tok = sum(t.matrix ?? []);
		slides.push({
			title: `Lens · ${p?.name ?? `T${t.id}`}`,
			body: `${p?.name}’s full ${formatUsd(tableBountyTokens(room))} workplace (${tok} tokens). Use as a reference drawing for their preferred zones — not the room average.`,
			imageUrl: t.imageUrl,
			color: p?.color
		});
	}

	slides.push({
		title: 'Close · Layout synthesis',
		body: `Stack preferred zones along a primary axis; size rooms by room-mix %. Paint each zone with the palette of its top contributing functions. Function drawings are lens references; the room drawing is the combined plan.`,
		imageUrl: room.finaleImageUrl,
		color: '#B8932E'
	});

	const layoutPlan = preferred.length
		? preferred
				.map((z) => {
					const leadFn = z.byFunction[0];
					return `${z.pct}% ${z.zone}${leadFn ? ` (led by ${leadFn.name})` : ''}`;
				})
				.join(' → ')
		: 'No preferred zones yet.';

	const drawingCount =
		(room.finaleImageUrl ? 1 : 0) + room.tables.filter((t) => t.imageUrl).length;

	return { mandate, concept, slides, zones, layoutPlan, drawingCount };
}
