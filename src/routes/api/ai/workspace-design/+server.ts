import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { drawingSetFromRoom, workspaceDesignSheets } from '$lib/game';
import type { WorkspaceDesignKind, WorkspaceDesignSheet } from '$lib/game/types';
import { generateImageWithRefs } from '$lib/server/ai/fal';
import { withLiveRoom, readLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import { idempotentJson } from '$lib/server/idempotency';
import type { RequestHandler } from './$types';

/** Allowlist of shape kinds the route accepts. Mirrors `WorkspaceDesignKind`. */
const _VALID_WORKSPACE_DESIGN_KINDS: readonly WorkspaceDesignKind[] = [
	'collage',
	'plan',
	'section',
	'elevation',
	'concept'
];

/**
 * POST → Generate architectural workspace design sheets from final brief + concept refs.
 * Collage, plan, section, elevation, concept axon — fal edit with all drawing URLs.
 * Requires stake + at least a brief (or drawings).
 *
 * Body `{ kind? }`: with a kind, generates just that one sheet and upserts it
 * (per-sheet generate/regen from the design studio). Without a kind, generates
 * the full set sequentially; each finished sheet is upserted by kind, so a
 * partial failure keeps the previously generated sheets.
 */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as { kind?: string };
	if (
		body.kind !== undefined &&
		!_VALID_WORKSPACE_DESIGN_KINDS.includes(body.kind as WorkspaceDesignKind)
	) {
		throw error(400, `Unknown sheet kind: ${body.kind}`);
	}

	return idempotentJson(event, async () => {
		const room = await readLiveRoom();
		if (room.aggregate.totalCoins <= 0) {
			throw error(400, 'No stake yet — tables must place priorities first.');
		}
		if (!room.enhancedBrief?.trim() && !room.finaleImageUrl) {
			throw error(400, 'Finalise the architectural brief (and preferably concept images) first.');
		}

		const key =
			env.FAL_API_KEY ||
			env.FAL_KEY ||
			event.platform?.env?.FAL_API_KEY ||
			event.platform?.env?.FAL_KEY;

		const refs = drawingSetFromRoom(room).map((d) => d.url);
		const allSpecs = workspaceDesignSheets(room);
		const kind = body.kind as WorkspaceDesignKind | undefined;
		const specs = kind ? allSpecs.filter((s) => s.kind === kind) : allSpecs;
		if (kind && specs.length === 0) {
			throw error(400, `Unknown sheet kind: ${kind}`);
		}

		const sheets: WorkspaceDesignSheet[] = [];
		let imageError: 'no_key' | 'failed' | undefined;

		// Sequential to respect fal rate limits; each sheet uses full ref set.
		// Each finished sheet is upserted by kind — partial failures never wipe
		// sheets that already existed.
		for (const spec of specs) {
			const { url, error: err } = await generateImageWithRefs(key, spec.prompt, refs, {
				aspect_ratio: '16:9',
				quality: 'high',
				// GPT Image 2 first for titleblock / "Created by ZyetaI"; Nano Banana 2 edit fallback
				preferGpt: true
			});
			if (err === 'no_key') {
				imageError = 'no_key';
				break;
			}
			if (url) {
				const sheet: WorkspaceDesignSheet = {
					kind: spec.kind,
					label: spec.label,
					url,
					prompt: spec.prompt.slice(0, 400)
				};
				sheets.push(sheet);
				await withLiveRoom(() => {
					store.upsertWorkspaceDesign(sheet);
				});
			} else if (err) {
				imageError = 'failed';
			}
		}

		return {
			kind,
			sheets,
			count: sheets.length,
			imageError,
			room: store.snapshot()
		};
	});
};
