/**
 * Browser download helpers — one copy of the anchor dance.
 *
 * This existed three times (host session export, host photo archive, the
 * expand-image viewer) and every copy revoked the object URL on the line after
 * `a.click()`. That is a race: the click only *schedules* the download, so
 * revoking synchronously can cancel it before the browser has read the blob.
 * Chrome usually wins the race, Safari and Firefox do not — which is exactly
 * the browser a facilitator saves the room's renders from.
 *
 * Revoke is deferred instead. The URL leaks for a minute, which costs nothing
 * against a download that actually completes.
 */

/** Long enough for a fal render over venue wifi; short enough to fail visibly. */
const FETCH_TIMEOUT = 20_000;
const REVOKE_DELAY = 60_000;

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
}

/**
 * Fetch a cross-origin asset and save it, so a fal CDN image downloads instead
 * of navigating away from the session. Throws if the fetch fails or stalls —
 * callers fall back to opening the URL in a tab.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
	const res = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(FETCH_TIMEOUT) });
	if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
	downloadBlob(await res.blob(), filename);
}
