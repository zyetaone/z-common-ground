/**
 * Live + archive photo helpers — SSOT for host UI and store archive shape.
 */
import { tablePersona } from './config';
import type { ArchivedImage, RoomState } from './types';

export type PhotoRow = { url: string; label: string; file: string };

/** YYYY-MM-DD — one key for host archive grouping. */
export function sessionDateKey(ms = Date.now()): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** LIVE-YYYY-MM-DD-HHMMSS — one id per archive batch. */
export function newSessionId(ms = Date.now()): string {
	const d = new Date(ms);
	const date = sessionDateKey(ms);
	const t = d.toISOString().slice(11, 19).replace(/:/g, '');
	return `LIVE-${date}-${t}`;
}

export function livePhotosFromRoom(room: RoomState | null | undefined): PhotoRow[] {
	if (!room) return [];
	const rows: PhotoRow[] = [];
	const roomUrls = [
		...(room.roomConceptUrls ?? []),
		...(room.finaleImageUrl ? [room.finaleImageUrl] : [])
	].filter((u, i, a) => a.indexOf(u) === i);
	roomUrls.forEach((url, i) => {
		rows.push({
			url,
			label: roomUrls.length > 1 ? `Room concept ${i + 1}` : 'Room finale',
			file: roomUrls.length > 1 ? `finale-room-${i + 1}.png` : 'finale-room.png'
		});
	});
	for (const t of room.tables) {
		if (!t.imageUrl) continue;
		const fn = tablePersona(t.id, room);
		const slug = fn.name.toLowerCase().replace(/\s+/g, '-');
		rows.push({
			url: t.imageUrl,
			label: `T${t.id} · ${fn.name}`,
			file: `table-${t.id}-${slug}.png`
		});
	}
	return rows;
}

export type ArchiveGroup = {
	/** Group key: sessionId or date fallback */
	key: string;
	/** Human label */
	label: string;
	sessionDate: string;
	sessionId?: string;
	/** Newest item time in group */
	sortAt: number;
	items: ArchivedImage[];
};

export type ArchiveSort = 'newest' | 'oldest';

/**
 * Group archive by session id (batch), falling back to session date.
 * Sort groups by date/session; items within group newest-first by default.
 */
export function groupArchive(
	items: readonly ArchivedImage[],
	sort: ArchiveSort = 'newest'
): ArchiveGroup[] {
	const map = new Map<string, ArchivedImage[]>();
	for (const a of items) {
		const day = a.sessionDate || sessionDateKey(a.archivedAt);
		const key = a.sessionId?.trim() || day;
		const list = map.get(key) ?? [];
		list.push(a);
		map.set(key, list);
	}

	const groups: ArchiveGroup[] = [...map.entries()].map(([key, list]) => {
		const sorted = [...list].sort((a, b) => b.archivedAt - a.archivedAt);
		const head = sorted[0];
		const sessionDate = head?.sessionDate || sessionDateKey(head?.archivedAt);
		const sessionId = head?.sessionId;
		const sortAt = Math.max(...sorted.map((x) => x.archivedAt));
		return {
			key,
			label: sessionId || `Session ${sessionDate}`,
			sessionDate,
			sessionId,
			sortAt,
			items: sort === 'oldest' ? [...sorted].reverse() : sorted
		};
	});

	groups.sort((a, b) =>
		sort === 'newest' ? b.sortAt - a.sortAt : a.sortAt - b.sortAt
	);
	return groups;
}

export function collectLiveAsArchive(room: RoomState | null | undefined): ArchivedImage[] {
	if (!room) return [];
	const now = Date.now();
	const sessionDate = sessionDateKey(now);
	const sessionId = newSessionId(now);
	const out: ArchivedImage[] = [];
	const roomUrls = [
		...(room.roomConceptUrls ?? []),
		...(room.finaleImageUrl ? [room.finaleImageUrl] : [])
	].filter((u, i, a) => a.indexOf(u) === i);
	for (const [i, url] of roomUrls.entries()) {
		out.push({
			url,
			label: roomUrls.length > 1 ? `Room concept ${i + 1}` : 'Room finale',
			kind: 'room',
			archivedAt: now,
			sessionDate,
			sessionId
		});
	}
	for (const t of room.tables) {
		if (!t.imageUrl) continue;
		const fn = tablePersona(t.id, room);
		out.push({
			url: t.imageUrl,
			label: `T${t.id} · ${fn.name}`,
			kind: 'table',
			tableId: t.id,
			archivedAt: now,
			sessionDate,
			sessionId
		});
	}
	return out;
}

export function mergeArchive(
	prev: readonly ArchivedImage[] | undefined,
	incoming: readonly ArchivedImage[],
	max = 96
): ArchivedImage[] {
	if (incoming.length === 0) return [...(prev ?? [])].slice(0, max);
	const seen = new Set<string>();
	const merged: ArchivedImage[] = [];
	for (const e of [...incoming, ...(prev ?? [])]) {
		if (!e.url || seen.has(e.url)) continue;
		seen.add(e.url);
		merged.push(e);
		if (merged.length >= max) break;
	}
	return merged;
}
