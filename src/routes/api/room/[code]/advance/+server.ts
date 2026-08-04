import { idempotentJson } from '$lib/server/idempotency';
import { stepRoom, type StepFrom } from '$lib/server/step';
import type { RequestHandler } from './$types';

/** Advance the round and return the full room so clients refresh immediately. Guarded against a replayed request — see stepIsCurrent. */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as { from?: StepFrom };
	return idempotentJson(event, () => stepRoom('advance', body.from));
};
