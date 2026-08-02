<script lang="ts">
	import HostConfigOptions from './HostConfigOptions.svelte';
	import HostConfigPersonas from './HostConfigPersonas.svelte';
	import HostConfigQuestions from './HostConfigQuestions.svelte';
	import HostConfigSession from './HostConfigSession.svelte';

	/**
	 * Host "Content & settings" shell — tab chrome only. Each tab owns its own
	 * drafts and saves, so an unsaved edit in one tab can't collide with another.
	 */
	type ConfigTab = 'questions' | 'options' | 'personas' | 'session';

	let tab = $state<ConfigTab>('questions');

	/**
	 * Bumped when the session tab resets content overrides. Keying the editors on
	 * it remounts them, dropping drafts that patch values which no longer exist.
	 */
	let overridesVersion = $state(0);

	const tabs: { id: ConfigTab; label: string; hint: string }[] = [
		{ id: 'questions', label: 'Questions', hint: 'Round Q + hints' },
		{ id: 'options', label: 'Options', hint: '7 board labels' },
		{ id: 'personas', label: 'Personas', hint: 'Functions' },
		{ id: 'session', label: 'Session', hint: 'Budget · tables' }
	];
</script>

<section class="rounded-2xl border border-teal/35 bg-panel/40 overflow-hidden">
	<header class="p-5 border-b border-line/40">
		<h2 class="text-[11px] uppercase tracking-[0.26em] text-teal-ink">Content &amp; settings</h2>
		<p class="text-xs text-muted mt-0.5">
			Edit questions, board option names, personas, and session controls. Saves to LIVE (D1).
		</p>
	</header>

	<nav class="flex flex-wrap gap-0 border-b border-line/40 px-2 sm:px-3" aria-label="Config sections">
		{#each tabs as t (t.id)}
			<button
				type="button"
				onclick={() => (tab = t.id)}
				class="px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition text-left"
				class:border-teal={tab === t.id}
				class:text-teal-ink={tab === t.id}
				class:border-transparent={tab !== t.id}
				class:text-muted={tab !== t.id}
			>
				<span class="block">{t.label}</span>
				<span class="block text-[9px] font-normal opacity-70 hidden sm:block">{t.hint}</span>
			</button>
		{/each}
	</nav>

	<div class="p-5 max-h-[min(70vh,720px)] overflow-y-auto">
		{#key overridesVersion}
			<!-- The three editors stay mounted and are hidden with CSS rather than
			     torn down by {#if}, so an unsaved draft survives a tab switch.
			     Only `overridesVersion` may drop them. -->
			<div hidden={tab !== 'questions'}><HostConfigQuestions /></div>
			<div hidden={tab !== 'options'}><HostConfigOptions /></div>
			<div hidden={tab !== 'personas'}><HostConfigPersonas /></div>
			<div hidden={tab !== 'session'}>
				<HostConfigSession onResetOverrides={() => (overridesVersion += 1)} />
			</div>
		{/key}
	</div>
</section>
