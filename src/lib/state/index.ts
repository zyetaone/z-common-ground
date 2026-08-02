/**
 * Global client state — Svelte 5 runes modules (*.svelte.ts).
 *
 * Prefer: $state + $derived in modules/components
 * Avoid: $effect for sync (use events, onMount, or explicit methods)
 *
 *  .svelte     → UI
 *  .svelte.ts  → shared state + actions
 *  .ts         → pure domain / server
 */
export { SESSION, session } from './session.svelte';
export { present } from './present.svelte';
export { host } from './host.svelte';
