/**
 * Host form drafts — $state + $derived-style getters.
 * Sync from room via sync(room) on user actions / explicit call, not $effect.
 */
import type { RoomState } from '$lib/game/types';
import { DEFAULT_ROOM_BOUNTY_TOKENS, DEFAULT_TABLE_COUNT } from '$lib/game';

let tableCount = $state(DEFAULT_TABLE_COUNT);
let roomBountyTokens = $state(DEFAULT_ROOM_BOUNTY_TOKENS);
let synced = false;

export const host = {
	get tableCount() {
		return tableCount;
	},
	set tableCount(n: number) {
		tableCount = n;
	},
	get roomBountyTokens() {
		return roomBountyTokens;
	},
	set roomBountyTokens(n: number) {
		roomBountyTokens = n;
	},

	/** One-shot pull from room (call when host page mounts, not in $effect loops). */
	syncOnce(room: RoomState | null) {
		if (!room || synced) return;
		tableCount = room.tables.length;
		roomBountyTokens = room.roomBountyTokens ?? DEFAULT_ROOM_BOUNTY_TOKENS;
		synced = true;
	},

	/** Force re-sync after reset. */
	resync(room: RoomState | null) {
		synced = false;
		host.syncOnce(room);
	}
};
