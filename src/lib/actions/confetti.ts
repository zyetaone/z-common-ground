import type { Action } from 'svelte/action';

/** Short boardroom confetti burst (seal / celebrate). */
export const confetti: Action<HTMLElement, { count?: number } | undefined> = (node, opts) => {
	if (typeof window === 'undefined') return {};
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};

	const count = opts?.count ?? 14;
	const c = document.createElement('canvas');
	Object.assign(c.style, {
		position: 'fixed',
		inset: '0',
		pointerEvents: 'none',
		zIndex: '70'
	});
	document.body.appendChild(c);
	const ctx = c.getContext('2d');
	if (!ctx) {
		c.remove();
		return {};
	}
	c.width = innerWidth;
	c.height = innerHeight;
	const colors = ['#B8932E', '#1F8B78', '#E0665A', '#3FB6A2', '#E0A458'];
	const parts = Array.from({ length: count }, () => ({
		x: innerWidth / 2,
		y: innerHeight * 0.35,
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
