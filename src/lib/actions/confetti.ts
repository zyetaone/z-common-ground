import type { Action } from 'svelte/action';

type ConfettiOpts = { count?: number; key?: string };

/** Short boardroom confetti burst (seal / celebrate). */
export const confetti: Action<HTMLElement, ConfettiOpts | undefined> = (node, opts) => {
	if (typeof window === 'undefined') return {};
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};

	// Once-guard: remounts (e.g. a reload mid-sealed-round) must not re-celebrate.
	if (opts?.key) {
		try {
			const k = `cg-confetti-${opts.key}`;
			if (sessionStorage.getItem(k)) return {};
			sessionStorage.setItem(k, '1');
		} catch {
			/* storage unavailable — fire anyway */
		}
	}

	const count = opts?.count ?? 14;
	const c = document.createElement('canvas');
	Object.assign(c.style, {
		position: 'fixed',
		inset: '0',
		pointerEvents: 'none',
		zIndex: '90'
	});
	document.body.appendChild(c);
	const ctx = c.getContext('2d');
	if (!ctx) {
		c.remove();
		return {};
	}
	c.width = innerWidth;
	c.height = innerHeight;
	// Origin: the host node's centre, not mid-viewport.
	const rect = node.getBoundingClientRect();
	const ox = rect.left + rect.width / 2;
	const oy = rect.top + rect.height / 2;
	const colors = ['#B8932E', '#1F8B78'];
	const parts = Array.from({ length: count }, () => ({
		x: ox,
		y: oy,
		vx: (Math.random() - 0.5) * 14,
		vy: -6 - Math.random() * 8,
		r: 3 + Math.random() * 4,
		life: 1,
		color: colors[Math.floor(Math.random() * colors.length)]
	}));
	let raf = 0;
	const draw = () => {
		ctx.clearRect(0, 0, c.width, c.height);
		for (const p of parts) {
			p.x += p.vx;
			p.y += p.vy;
			p.vy += 0.35;
			p.life -= 0.018;
			if (p.life <= 0) continue;
			ctx.globalAlpha = Math.max(0, p.life);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fill();
		}
		if (parts.some((p) => p.life > 0)) raf = requestAnimationFrame(draw);
		else c.remove();
	};
	raf = requestAnimationFrame(draw);
	return {
		destroy() {
			cancelAnimationFrame(raf);
			c.remove();
		}
	};
};
