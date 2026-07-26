/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		interface Platform {
			env: {
				FAL_API_KEY?: string;
				FAL_KEY?: string;
				ANTHROPIC_API_KEY?: string;
				/** Workers AI binding (wrangler.jsonc ai.binding). */
				AI?: import('$lib/server/ai/llama').AiBinding;
				/** D1 store for the single LIVE room (wrangler.jsonc d1_databases). */
				common_ground_db?: D1Database;
			};
		}
	}
}

export {};
