import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Poll for a new deploy every 60s. Phones and the presenter laptop keep
			// one tab open for the whole session, and SvelteKit chunks are
			// content-hashed — so a tab loaded before a mid-session deploy keeps
			// running the old code until something reloads it. +layout does that
			// when this poll flips `updated`.
			version: { pollInterval: 60_000 }
		})
	]
});
