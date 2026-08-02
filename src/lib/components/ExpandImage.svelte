<script lang="ts">
	import type { WorkspaceZone } from '$lib/game';

	/**
	 * Expand lightbox for AI images + multi-zone floorplate (preferred zones + complete layout).
	 */
	let {
		src,
		title = 'Workplace',
		caption = '',
		layoutBrief = '',
		zones = [] as WorkspaceZone[],
		brandColor = '#1F8B78',
		kind = 'room' as 'room' | 'function',
		open = $bindable(false)
	}: {
		src: string;
		title?: string;
		caption?: string;
		/** Complete multi-zone layout narrative */
		layoutBrief?: string;
		zones?: WorkspaceZone[];
		/** Persona or brand accent for chrome */
		brandColor?: string;
		kind?: 'room' | 'function';
		open?: boolean;
	} = $props();

	const preferred = $derived(zones.filter((z) => z.preferred));
	const hasZones = $derived(zones.length > 0);
	// Cumulative widths for floorplate strips (sum of pct should be ~100)
	const strips = $derived.by(() => {
		const list = zones.filter((z) => z.pct > 0);
		const total = list.reduce((s, z) => s + z.pct, 0) || 1;
		return list.map((z) => ({ ...z, w: (z.pct / total) * 100 }));
	});

	function close() {
		open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.preventDefault();
			close();
		}
	}

	async function download() {
		try {
			const res = await fetch(src, { mode: 'cors' });
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${title.replace(/\s+/g, '_')}_${Date.now()}.png`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch {
			window.open(src, '_blank', 'noopener');
		}
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open && src}
	<div class="root" role="dialog" aria-modal="true" aria-label={title} style="--brand:{brandColor}">
		<button type="button" class="backdrop" onclick={close} aria-label="Close"></button>
		<div class="sheet">
			<header>
				<div>
					<p class="kicker">
						{kind === 'room' ? 'Common Ground · zones' : 'Function lens · zones'}
					</p>
					<h3>{title}</h3>
				</div>
				<div class="acts">
					<button type="button" class="btn" onclick={download}>Download</button>
					<a class="btn" href={src} target="_blank" rel="noopener">Open tab</a>
					<button type="button" class="btn x" onclick={close}>Close · Esc</button>
				</div>
			</header>

			<div class="body">
				<div class="stage">
					<img {src} alt={title} />
				</div>

				{#if hasZones}
					<aside class="zones-panel" aria-label="Workspace zones">
						<p class="zp-k">Preferred zones</p>
						<div class="pref-chips">
							{#each preferred as z (z.priority)}
								<span class="chip pref" style="--zc:{z.color}">
									<span class="chip-pct">{z.pct}%</span>
									<span class="chip-name">{z.zone}</span>
								</span>
							{:else}
								<span class="chip muted">—</span>
							{/each}
						</div>

						<p class="zp-k mt">Complete floorplate layout</p>
						<p class="layout-note">
							Zone widths = priority weight. Preferred zones own light + materials.
						</p>

						<!-- Schematic multi-zone plan -->
						<div class="floor" role="img" aria-label="Zone floorplate schematic">
							<div class="floor-frame">
								<div class="floor-label">Workspace plan</div>
								<div class="strips">
									{#each strips as z (z.priority)}
										<div
											class="strip"
											class:pref={z.preferred}
											style="width:{Math.max(z.w, 3)}%;--zc:{z.color}"
											title="{z.name}: {z.pct}% · {z.zone}"
										>
											{#if z.w >= 11}
												<span class="strip-lab">{z.zone}</span>
												<span class="strip-pct">{z.pct}%</span>
											{:else if z.w >= 6}
												<span class="strip-pct">{z.pct}</span>
											{/if}
										</div>
									{/each}
								</div>
								<!-- Secondary “rooms” row for preferred only -->
								<div class="rooms">
									{#each preferred as z, i (z.priority)}
										<div class="room" style="--zc:{z.color}; flex: {z.pct}">
											<span class="room-dot"></span>
											<span class="room-n">{z.name}</span>
											<span class="room-z">{z.zone}</span>
										</div>
										{#if i < preferred.length - 1}
											<div class="corridor" aria-hidden="true"></div>
										{/if}
									{/each}
								</div>
							</div>
							<div class="legend">
								{#each strips as z (z.priority)}
									<div class="leg" class:dim={!z.preferred}>
										<span class="sw" style="background:{z.color}"></span>
										<span class="ln">{z.name}</span>
										<span class="lp">{z.pct}%</span>
									</div>
								{/each}
							</div>
						</div>

						{#if layoutBrief}
							<p class="layout-brief">{layoutBrief}</p>
						{/if}
					</aside>
				{/if}
			</div>

			{#if caption}
				<aside class="caption">
					<p class="cap-k">ZyetaI · concept brief</p>
					<p class="cap-t">{caption}</p>
				</aside>
			{/if}
		</div>
	</div>
{/if}

<style>
	.root {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		animation: in 0.2s ease both;
	}
	@keyframes in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.backdrop {
		position: absolute;
		inset: 0;
		border: none;
		background: rgba(0, 0, 0, 0.88);
		backdrop-filter: blur(10px);
		cursor: pointer;
	}
	.sheet {
		position: relative;
		z-index: 1;
		width: min(1200px, 100%);
		max-height: min(94vh, 980px);
		display: flex;
		flex-direction: column;
		border-radius: 18px;
		border: 1px solid color-mix(in srgb, var(--brand) 45%, var(--color-line));
		background: #0a0f1a;
		overflow: hidden;
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--brand) 20%, transparent),
			0 24px 80px rgba(0, 0, 0, 0.55);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 16px;
		border-bottom: 1px solid color-mix(in srgb, var(--brand) 28%, transparent);
		background: color-mix(in srgb, var(--brand) 8%, #0a0f1a);
	}
	.kicker {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--brand);
	}
	h3 {
		margin: 2px 0 0;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 800;
		color: #f3ecd8;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.btn {
		border: 1px solid var(--color-line);
		background: transparent;
		color: #e8e0c8;
		border-radius: 999px;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
	}
	.btn:hover {
		border-color: var(--brand);
		color: var(--brand);
	}
	.btn.x {
		color: var(--color-muted);
	}
	.body {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.95fr);
		overflow: hidden;
	}
	@media (max-width: 900px) {
		.body {
			grid-template-columns: 1fr;
			overflow: auto;
		}
	}
	.stage {
		min-height: 0;
		display: grid;
		place-items: center;
		padding: 12px;
		overflow: auto;
		background: #05080f;
	}
	.stage img {
		max-width: 100%;
		max-height: min(62vh, 640px);
		object-fit: contain;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--brand) 25%, transparent);
	}
	.zones-panel {
		padding: 14px 16px;
		border-left: 1px solid color-mix(in srgb, var(--brand) 22%, transparent);
		background: color-mix(in srgb, #0a0f1a 88%, var(--brand));
		overflow: auto;
		min-height: 0;
	}
	@media (max-width: 900px) {
		.zones-panel {
			border-left: none;
			border-top: 1px solid color-mix(in srgb, var(--brand) 22%, transparent);
		}
	}
	.zp-k {
		margin: 0 0 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--brand);
	}
	.zp-k.mt {
		margin-top: 14px;
	}
	.pref-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 10px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--zc, var(--brand)) 50%, transparent);
		background: color-mix(in srgb, var(--zc, var(--brand)) 18%, transparent);
		max-width: 100%;
	}
	.chip.pref {
		box-shadow: 0 0 12px color-mix(in srgb, var(--zc) 25%, transparent);
	}
	.chip.muted {
		color: #8a8470;
		border-color: var(--color-line);
	}
	.chip-pct {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 800;
		color: #f3ecd8;
	}
	.chip-name {
		font-size: 11px;
		font-weight: 600;
		color: #c8c0a8;
		line-height: 1.25;
	}
	.layout-note {
		margin: 0 0 8px;
		font-size: 11px;
		color: #8a8470;
	}
	.floor {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.floor-frame {
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--brand) 35%, transparent);
		background: #060a12;
		padding: 10px;
	}
	.floor-label {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #6a6558;
		margin-bottom: 8px;
	}
	.strips {
		display: flex;
		height: 72px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.strip {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		background: color-mix(in srgb, var(--zc) 42%, #121820);
		border-right: 1px solid rgba(0, 0, 0, 0.25);
		padding: 4px 2px;
		opacity: 0.72;
	}
	.strip.pref {
		opacity: 1;
		background: color-mix(in srgb, var(--zc) 62%, #0e141c);
		box-shadow: inset 0 0 20px color-mix(in srgb, var(--zc) 35%, transparent);
	}
	.strip:last-child {
		border-right: none;
	}
	.strip-lab {
		font-size: 8px;
		font-weight: 700;
		color: #fff;
		text-align: center;
		line-height: 1.15;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		max-width: 100%;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.strip-pct {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 800;
		color: #fff;
	}
	.rooms {
		display: flex;
		gap: 0;
		margin-top: 8px;
		min-height: 52px;
	}
	.room {
		flex: 1;
		min-width: 0;
		border-radius: 8px;
		border: 1px solid color-mix(in srgb, var(--zc) 45%, transparent);
		background: color-mix(in srgb, var(--zc) 14%, transparent);
		padding: 6px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.corridor {
		width: 6px;
		flex-shrink: 0;
		background: repeating-linear-gradient(
			90deg,
			transparent,
			transparent 2px,
			rgba(184, 147, 46, 0.25) 2px,
			rgba(184, 147, 46, 0.25) 3px
		);
	}
	.room-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--zc);
		box-shadow: 0 0 8px var(--zc);
	}
	.room-n {
		font-size: 10px;
		font-weight: 800;
		color: #f3ecd8;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.room-z {
		font-size: 9px;
		color: #9a9280;
		line-height: 1.2;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.legend {
		display: flex;
		flex-direction: column;
		gap: 3px;
		max-height: 120px;
		overflow: auto;
	}
	.leg {
		display: grid;
		grid-template-columns: 10px 1fr auto;
		gap: 8px;
		align-items: center;
		font-size: 11px;
	}
	.leg.dim {
		opacity: 0.55;
	}
	.sw {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.ln {
		color: #c8c0a8;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lp {
		font-family: var(--font-mono);
		font-weight: 700;
		color: #8a8470;
		font-size: 10px;
	}
	.layout-brief {
		margin: 12px 0 0;
		font-size: 12px;
		line-height: 1.45;
		color: #d0c8b0;
	}
	.caption {
		padding: 12px 16px 16px;
		border-top: 1px solid color-mix(in srgb, var(--brand) 30%, transparent);
		background: color-mix(in srgb, #0a0f1a 90%, var(--brand));
	}
	.cap-k {
		margin: 0 0 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--brand);
	}
	.cap-t {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
		color: #e8e0c8;
	}
</style>
