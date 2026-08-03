<script lang="ts">
	import type { FunctionProfile } from '$lib/game';
	import { formatUsd, PRIORITY_COLORS } from '$lib/game';
	import Modal from '$lib/components/Modal.svelte';

	let {
		open = $bindable(false),
		profile
	}: {
		open?: boolean;
		profile: FunctionProfile | null;
	} = $props();

	const colors = PRIORITY_COLORS;
</script>

<Modal bind:open label={profile ? `${profile.name} profile` : 'Function profile'}>
	{#if profile}
		<div class="sheet" style="--fn:{profile.color}">
			<header class="head">
				<div class="id">
					<span class="dot"></span>
					<div>
						<p class="cg-kicker" style="margin:0">Table {profile.tableId} · personality scan</p>
						<h2>{profile.name}</h2>
						<p class="archetype">{profile.archetype}</p>
					</div>
				</div>
				<button type="button" class="x" onclick={() => (open = false)}>Close</button>
			</header>

			<p class="headline">{profile.headline}</p>

			{#if profile.tags.length}
				<div class="tags" role="list">
					{#each profile.tags as tag (tag)}
						<span class="tag" role="listitem">{tag}</span>
					{/each}
				</div>
			{/if}

			<div class="meta">
				<div class="chip">
					<span class="t">Wallet shape</span>
					<strong>{formatUsd(profile.total)}</strong>
				</div>
				<div class="chip">
					<span class="t">vs room</span>
					<strong class="teal">{profile.commonGround}/100</strong>
				</div>
				<div class="chip wide">
					<span class="t">Lens</span>
					<strong class="sm">{profile.lens}</strong>
				</div>
			</div>

			<section class="block">
				<h3>Personality traits</h3>
				<p class="sub">From their priority choices — not self-report.</p>
				<div class="traits">
					{#each profile.traits as tr (tr.id)}
						<div class="trait" title={tr.hint}>
							<div class="trait-top">
								<span class="trait-lab">{tr.label}</span>
								<span class="trait-sc">{tr.score}</span>
							</div>
							<div class="track">
								<div class="fill" style="width:{Math.max(4, tr.score)}%"></div>
							</div>
							<p class="trait-hint">{tr.hint}</p>
						</div>
					{/each}
				</div>
			</section>

			<section class="block two">
				<div>
					<h3>Prefers</h3>
					<ul class="plist">
						{#each profile.prefers as p (p.name)}
							<li>
								<span class="pn">{p.name}</span>
								<span class="pp">{p.pct}%</span>
							</li>
						{:else}
							<li class="empty">—</li>
						{/each}
					</ul>
				</div>
				<div>
					<h3>Light / empty</h3>
					<ul class="plist avoid">
						{#each profile.avoids as p (p.name)}
							<li>
								<span class="pn">{p.name}</span>
								<span class="pp">{p.pct}%</span>
							</li>
						{:else}
							<li class="empty">Funds most priorities</li>
						{/each}
					</ul>
				</div>
			</section>

			<section class="block">
				<h3>Full mix</h3>
				<div class="bars">
					{#each profile.mix as m (m.priority)}
						{#if m.pct > 0 || m.tokens > 0}
							<div class="bar-row">
								<span class="bn" style="color:{colors[m.priority]}">{m.name}</span>
								<div class="btrack">
									<div
										class="bfill"
										style="width:{Math.max(m.pct, m.pct > 0 ? 3 : 0)}%;background:{colors[m.priority]}"
									></div>
								</div>
								<span class="bp">{m.pct}% · {formatUsd(m.tokens)}</span>
							</div>
						{/if}
					{/each}
				</div>
			</section>

			{#if profile.bullets.length}
				<section class="block">
					<h3>Read-aloud</h3>
					<ul class="bullets">
						{#each profile.bullets as b, i (i)}
							<li>{b}</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if profile.mission}
				<p class="mission"><span class="t">Mission</span> {profile.mission}</p>
			{/if}
		</div>
	{/if}
</Modal>

<style>
	.sheet {
		width: min(560px, 100vw - 32px);
		max-height: min(88dvh, 820px);
		overflow: auto;
		border-radius: var(--radius-lg);
		border: 1px solid color-mix(in srgb, var(--fn) 40%, var(--color-line));
		background: var(--color-bg);
		padding: 20px 22px 24px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	.id {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		min-width: 0;
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--fn);
		box-shadow: 0 0 16px var(--fn);
		margin-top: 6px;
		flex-shrink: 0;
	}
	h2 {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.archetype {
		margin: 4px 0 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--fn);
	}
	.x {
		border: 1px solid var(--color-line);
		background: transparent;
		border-radius: 10px;
		padding: 8px 12px;
		font-size: 12px;
		cursor: pointer;
		flex-shrink: 0;
		color: var(--color-ink);
	}
	.headline {
		margin: 0 0 12px;
		font-size: 14px;
		line-height: 1.45;
		color: var(--color-ink);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 14px;
	}
	.tag {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--fn) 40%, var(--color-line));
		background: color-mix(in srgb, var(--fn) 12%, transparent);
		color: var(--color-ink);
	}
	.meta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 16px;
	}
	.chip {
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.chip.wide {
		grid-column: 1 / -1;
	}
	.chip .t {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-muted);
	}
	.chip strong {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 800;
	}
	.chip strong.sm {
		font-size: 13px;
		font-weight: 700;
		line-height: 1.3;
	}
	.chip strong.teal {
		color: var(--color-teal-ink);
	}
	.block {
		margin-bottom: 16px;
	}
	.block h3 {
		margin: 0 0 4px;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 800;
	}
	.sub {
		margin: 0 0 10px;
		font-size: 11px;
		color: var(--color-muted);
	}
	.traits {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.trait-top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.trait-lab {
		font-weight: 700;
		font-size: 12px;
	}
	.trait-sc {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 800;
		color: var(--fn);
		font-variant-numeric: tabular-nums;
	}
	.track {
		height: 6px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
		overflow: hidden;
		margin: 4px 0 2px;
	}
	.fill {
		height: 100%;
		border-radius: 99px;
		background: var(--fn);
		transition: width var(--dur-slow, 480ms) var(--ease-out-quart, ease);
	}
	.trait-hint {
		margin: 0;
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.35;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	@media (max-width: 480px) {
		.two {
			grid-template-columns: 1fr;
		}
	}
	.plist {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.plist li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
		background: var(--color-panel);
		border: 1px solid var(--color-line);
	}
	.plist.avoid li {
		opacity: 0.85;
	}
	.pn {
		font-weight: 600;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pp {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--color-muted);
		flex-shrink: 0;
	}
	.empty {
		color: var(--color-muted);
		font-size: 12px;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bar-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(48px, 1.2fr) auto;
		gap: 8px;
		align-items: center;
		font-size: 11px;
	}
	.bn {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.btrack {
		height: 6px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--color-ink) 8%, transparent);
		overflow: hidden;
	}
	.bfill {
		height: 100%;
		border-radius: 99px;
	}
	.bp {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
		white-space: nowrap;
	}
	.bullets {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 13px;
		line-height: 1.45;
		color: var(--color-ink);
	}
	.bullets li {
		margin-bottom: 6px;
	}
	.mission {
		margin: 0;
		padding-top: 10px;
		border-top: 1px solid var(--color-line);
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.4;
	}
	.mission .t {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		margin-right: 6px;
		color: var(--color-muted);
	}
</style>
