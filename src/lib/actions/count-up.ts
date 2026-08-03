import type { Action } from 'svelte/action';
import { formatUsdFull } from '$lib/game';

/** Animate a token total as compact USD (spend bar). */
export const countUp: Action<HTMLElement, number> = (node, value) => {
	// Duration from the --dur-base design token, read once at init (fallback 280ms).
	let dur = 280;
	if (typeof window !== 'undefined') {
		const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-base').trim();
		const ms = raw.endsWith('ms')
			? parseFloat(raw)
			: raw.endsWith('s')
				? parseFloat(raw) * 1000
				: NaN;
		if (Number.isFinite(ms) && ms > 0) dur = ms;
	}

	// Last value actually rendered — mid-flight updates continue from here,
	// not from the last completed animation (avoids a visible backward jump).
	let displayed = 0;
	let raf = 0;

	function animate(from: number, to: number) {
		if (typeof window === 'undefined') {
			node.textContent = formatUsdFull(to);
			displayed = to;
			return;
		}
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
			node.textContent = formatUsdFull(to);
			displayed = to;
			return;
		}
		const start = performance.now();
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / dur);
			const eased = 1 - Math.pow(1 - t, 3);
			const v = from + (to - from) * eased;
			node.textContent = formatUsdFull(v);
			displayed = v;
			if (t < 1) raf = requestAnimationFrame(tick);
			else displayed = to;
		};
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(tick);
	}

	// First paint snaps to the current value — a remount (render tab back,
	// {#key} remount in the deck) must not re-sweep from $0. Only update()
	// animates.
	node.textContent = formatUsdFull(value);
	displayed = value;

	return {
		update(next: number) {
			animate(displayed, next);
		},
		destroy() {
			cancelAnimationFrame(raf);
		}
	};
};
