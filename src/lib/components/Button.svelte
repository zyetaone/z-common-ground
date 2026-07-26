<script lang="ts">
	import type { Snippet } from 'svelte';

	// One button primitive for the app's real button styles. Renders <a> when
	// given href, else <button>. The global :focus-visible ring (app.css) applies.
	let {
		variant = 'outline',
		size = 'md',
		href,
		type = 'button',
		disabled = false,
		class: klass = '',
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary' | 'teal' | 'outline' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		href?: string;
		type?: 'button' | 'submit';
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const base =
		'inline-flex items-center justify-center gap-1.5 rounded-xl font-display font-bold transition disabled:opacity-40 disabled:cursor-default';
	const sizes = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-5 py-2.5 text-sm',
		lg: 'px-6 py-4 text-base'
	};
	const variants = {
		primary: 'bg-gold text-[#241a05] hover:bg-gold/90',
		secondary: 'border border-gold/50 text-gold hover:bg-gold/10',
		teal: 'bg-teal text-[#04140f] hover:bg-teal/90',
		outline: 'border border-line text-ink hover:border-gold',
		ghost: 'text-muted hover:text-gold',
		danger: 'border border-red/50 bg-red/10 text-red hover:bg-red/20'
	};
	const cls = $derived(`${base} ${sizes[size]} ${variants[variant]} ${klass}`);
</script>

{#if href}
	<a {href} class={cls} {...rest}>{@render children?.()}</a>
{:else}
	<button {type} {disabled} class={cls} {...rest}>{@render children?.()}</button>
{/if}
