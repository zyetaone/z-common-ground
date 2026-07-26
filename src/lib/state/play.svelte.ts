/**
 * Player join — table is the leaf of the hierarchy (no seats).
 * $state only; navigation is event-driven (no $effect).
 */
import { SESSION } from './session.svelte';

const LS = `cg-play-${SESSION}`;

let tableId = $state<number | null>(null);

function save() {
	if (typeof localStorage === 'undefined') return;
	try {
		if (tableId == null) localStorage.removeItem(LS);
		else localStorage.setItem(LS, JSON.stringify({ tableId }));
	} catch {
		/* ignore */
	}
}

function load() {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(LS);
		if (!raw) return;
		const s = JSON.parse(raw) as { tableId?: number };
		if (typeof s.tableId === 'number') tableId = s.tableId;
	} catch {
		/* ignore */
	}
}

load();

export const play = {
	get tableId() {
		return tableId;
	},

	/** $derived-friendly: has a table chosen */
	get hasTable() {
		return tableId != null;
	},

	pickTable(id: number) {
		tableId = id;
		save();
	},

	clear() {
		tableId = null;
		save();
	}
};
