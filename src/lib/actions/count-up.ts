import type { Action } from 'svelte/action';
import { formatUsdFull } from '$lib/game';

/** Animate a token total as compact USD (spend bar). */
export const countUp: Action<HTMLElement, number> = (node, value) => {
	let prev = value;
	let raf = 0;

	function animate(from: number, to: number) {
		if (typeof window === 'undefined') {
			node.textContent = formatUsdFull(to);
			return;
		}
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
			node.textContent = formatUsdFull(to);
			prev = to;
			return;
		}
		const start = performance.now();
		const dur = 280;
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / dur);
			const eased = 1 - Math.pow(1 - t, 3);
			node.textContent = formatUsdFull(from + (to - from) * eased);
			if (t < 1) raf = requestAnimationFrame(tick);
			else prev = to;
		};
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(tick);
	}

	animate(0, value);

	return {
		update(next: number) {
			animate(prev, next);
		},
		destroy() {
			cancelAnimationFrame(raf);
		}
	};
};
