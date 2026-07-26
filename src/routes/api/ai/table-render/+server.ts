import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { tableFunctionPrompt, tablePersona, tableSeatIndex, sum } from '$lib/game';
import { generateImage } from '$lib/server/ai/fal';
import { readLiveRoom, withLiveRoom } from '$lib/server/live';
import { store } from '$lib/server/store';
import type { RequestHandler } from './$types';

/**
 * POST { tableId } → fal image from that function table’s cumulative bets (z-corenet style).
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json().catch(() => ({}))) as { tableId?: number };
	const tableId = Number(body.tableId);
	if (!Number.isFinite(tableId) || tableId < 1 || tableId > 7) {
		throw error(400, 'tableId 1–7 required');
	}

	const room = await readLiveRoom();
	const table = room.tables.find((t) => t.id === tableId);
	if (!table) throw error(404, 'Table not found');

	const seat = tableSeatIndex(tableId);
	const bets = (table.board[seat] ?? []).map((n) => Number(n) || 0);
	if (sum(bets) <= 0) {
		throw error(400, 'No tokens on this table yet — place stake before generating.');
	}

	const persona = tablePersona(tableId);
	const prompt = tableFunctionPrompt(persona.name, bets);
	const key = env.FAL_API_KEY || env.FAL_KEY || platform?.env?.FAL_API_KEY || platform?.env?.FAL_KEY;
	const { url, error: imageError } = await generateImage(key, prompt);

	if (url) {
		await withLiveRoom(() => store.setTableImage('', tableId, url));
	}

	return json({
		url,
		imageError,
		prompt,
		tableId,
		functionName: persona.name,
		room: store.snapshot()
	});
};
