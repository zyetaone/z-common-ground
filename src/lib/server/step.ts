import { withLiveRoom } from './live';
import { store } from './store';
import { stepIsCurrent, type StepFrom } from '$lib/game/rules/phase';

export type { StepFrom };

/** Advance or retreat the clock, guarded against a replayed request. */
export async function stepRoom(dir: 'advance' | 'retreat', from: StepFrom) {
	const result = await withLiveRoom(() => {
		const cur = store.ensure();
		if (!stepIsCurrent(cur, from)) {
			return { phase: cur.phase, round: cur.round, boardsOpened: false, replayed: true };
		}
		return store[dir]();
	});
	return { ...result, room: store.snapshot() };
}
