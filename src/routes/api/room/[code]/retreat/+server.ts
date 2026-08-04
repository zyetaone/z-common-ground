import { idempotentJson } from '$lib/server/idempotency';
import { stepRoom, type StepFrom } from '$lib/server/step';
import type { RequestHandler } from './$types';

/** Step back one phase/round and re-open boards for corrections. Guarded against a replayed request — see stepIsCurrent. */
export const POST: RequestHandler = async (event) => {
	const body = (await event.request.json().catch(() => ({}))) as { from?: StepFrom };
	return idempotentJson(event, () => stepRoom('retreat', body.from));
};
