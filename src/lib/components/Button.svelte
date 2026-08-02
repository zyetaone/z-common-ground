<script lang="ts">
	import type { Snippet } from 'svelte';

	// One button primitive for the app's real button styles. Renders <a> when
	// given href, else <button>. The global :focus-visible ring (app.css) applies.
	let {
		variant = 'secondary',
		size = 'md',
		href,
		type = 'button',
		disabled = false,
		class: klass = '',
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		href?: string;
		type?: 'button' | 'submit';
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const base =
		'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] font-display font-bold transition-all duration-[var(--dur-fast)] ease-[var(--ease-out-quart)] disabled:opacity-40 disabled:cursor-default active:scale-[0.97]';
	const sizes = {
		sm: 'px-3 py-1.5 text-xs min-h-11',
		md: 'px-5 py-2.5 text-sm min-h-11',
		lg: 'px-6 py-4 text-base min-h-12'
	};
	const variants = {
		/* primary = confirm / live / submit (teal action).
		   Uses --color-teal-fill, not the raw brand teal: white on brand teal is
		   4.18:1, below WCAG AA. See the token comment in app.css. */
		primary:
			'bg-[var(--color-teal-fill)] text-[var(--color-on-teal)] hover:bg-[var(--color-teal)]',
		/* secondary = emphasis / deck nav / neutral bordered (gold border) */
		secondary: 'border border-gold/50 text-gold-ink hover:bg-gold/10',
		ghost: 'text-muted hover:text-gold-ink',
		danger: 'border border-red/50 bg-red/10 text-red hover:bg-red/20'
	};
	const cls = $derived(`${base} ${sizes[size]} ${variants[variant]} ${klass}`);
</script>

{#if href}
	<a {href} class={cls} {...rest}>{@render children?.()}</a>
{:else}
	<button {type} {disabled} class={cls} {...rest}>{@render children?.()}</button>
{/if}
