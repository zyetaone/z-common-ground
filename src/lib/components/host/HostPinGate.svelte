<script lang="ts">
	/**
	 * Host-screen PIN.
	 *
	 * This is a curtain, not a lock. It stops an attendee who scans the room QR
	 * and wanders to /host/LIVE from finding the advance button — which is the
	 * actual risk in a facilitated room. It does NOT protect the session: every
	 * /api/room/* route is unauthenticated, so anyone on the venue wifi who
	 * knows the URL can still POST an advance directly. Making that real means
	 * an auth check in the handlers, not in this component.
	 *
	 * Unlocked state lives in sessionStorage: one entry per browser tab session,
	 * so the facilitator types it once and a refresh mid-session doesn't lock
	 * them out, while a fresh tab asks again.
	 */
	const PIN = '1234';
	const KEY = 'cg-host-unlocked';

	let { children }: { children: import('svelte').Snippet } = $props();

	let unlocked = $state(read());
	/** Focus on mount without the autofocus attribute svelte-check rejects. */
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}
	let entry = $state('');
	let wrong = $state(false);

	function read(): boolean {
		if (typeof sessionStorage === 'undefined') return false;
		try {
			return sessionStorage.getItem(KEY) === '1';
		} catch {
			// Private-mode Safari throws on storage access — fall back to
			// per-render entry rather than locking the facilitator out.
			return false;
		}
	}

	function submit(e: Event) {
		e.preventDefault();
		if (entry.trim() !== PIN) {
			wrong = true;
			entry = '';
			return;
		}
		unlocked = true;
		wrong = false;
		try {
			sessionStorage.setItem(KEY, '1');
		} catch {
			/* unlocked for this render regardless */
		}
	}
</script>

{#if unlocked}
	{@render children()}
{:else}
	<div class="gate">
		<form class="card" onsubmit={submit}>
			<h1 class="title">Host console</h1>
			<p class="sub">Enter the facilitator PIN.</p>
			<input
				class="pin"
				class:wrong
				type="password"
				inputmode="numeric"
				autocomplete="off"
				aria-label="Facilitator PIN"
				use:focusOnMount
				bind:value={entry}
				oninput={() => (wrong = false)}
			/>
			{#if wrong}
				<p class="err" role="alert">Not that one.</p>
			{/if}
			<button type="submit" class="go" disabled={!entry.trim()}>Unlock</button>
			<a class="back" href="/present/LIVE">← Back to the deck</a>
		</form>
	</div>
{/if}

<style>
	.gate {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: min(320px, 100%);
		padding: 28px 24px;
		border-radius: 16px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		text-align: center;
	}
	.title {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		color: var(--color-ink);
	}
	.sub {
		font-size: 13px;
		color: var(--color-muted);
	}
	.pin {
		margin-top: 6px;
		padding: 12px;
		border-radius: 10px;
		border: 1px solid var(--color-line);
		background: transparent;
		color: var(--color-ink);
		font-family: var(--font-mono);
		font-size: 22px;
		letter-spacing: 0.4em;
		text-align: center;
	}
	.pin:focus {
		outline: 2px solid var(--color-gold);
		outline-offset: 1px;
	}
	.pin.wrong {
		border-color: var(--color-red);
	}
	.err {
		font-size: 12px;
		color: var(--color-red);
	}
	.go {
		padding: 11px;
		border-radius: 10px;
		border: 1px solid var(--color-gold);
		background: color-mix(in srgb, var(--color-gold) 14%, transparent);
		color: var(--color-gold-ink);
		font-weight: 700;
		cursor: pointer;
	}
	.go:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.back {
		margin-top: 2px;
		font-size: 12px;
		color: var(--color-muted);
	}
</style>
