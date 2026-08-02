<script lang="ts">
	import {
		livePhotosFromRoom,
		groupArchive,
		type ArchiveSort,
		type PhotoRow
	} from '$lib/game';
	import { session } from '$lib/state';

	let photoTab = $state<'live' | 'archive'>('live');
	let archiveSort = $state<ArchiveSort>('newest');

	const st = $derived(session.room);
	const livePhotos = $derived(livePhotosFromRoom(st));
	const archivePhotos = $derived(st?.imageArchive ?? []);
	const archiveGroups = $derived(groupArchive(archivePhotos, archiveSort));

	function downloadImage(url: string, name: string) {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.target = '_blank';
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function downloadAll(rows: PhotoRow[]) {
		rows.forEach((u, i) => setTimeout(() => downloadImage(u.url, u.file), i * 400));
	}

	function groupAsRows(items: typeof archivePhotos, prefix: string): PhotoRow[] {
		return items.map((a, i) => ({
			url: a.url,
			label: a.label,
			file: `${prefix}-${a.kind}-${i + 1}.png`
		}));
	}

	async function archiveLivePhotos() {
		if (livePhotos.length === 0) return;
		await session.archiveGeneratedImages();
		photoTab = 'archive';
	}
</script>

<section class="rounded-2xl border border-line bg-panel/40 p-5 space-y-3">
	<div class="flex items-center justify-between gap-2 flex-wrap">
		<div>
			<h2 class="text-[11px] uppercase tracking-[0.26em] text-muted">Photos & archive</h2>
			<p class="text-xs text-muted">
				Live {livePhotos.length} · Archive {archivePhotos.length}
				{#if archiveGroups.length > 0}
					· {archiveGroups.length} session{archiveGroups.length === 1 ? '' : 's'}
				{/if}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if photoTab === 'live' && livePhotos.length > 0}
				<button
					type="button"
					onclick={() => downloadAll(livePhotos)}
					class="rounded-xl bg-teal px-4 py-2 font-display text-xs font-bold text-[var(--color-on-teal)] shadow hover:bg-teal/90"
				>
					Save live ↓
				</button>
				<button
					type="button"
					disabled={session.busy}
					onclick={archiveLivePhotos}
					class="rounded-xl border border-line px-4 py-2 font-display text-xs font-bold text-muted hover:border-gold hover:text-gold-ink disabled:opacity-40"
				>
					{session.busy ? 'Archiving…' : 'Archive & clear live'}
				</button>
			{/if}
		</div>
	</div>

	<nav class="flex gap-1 border-b border-line/50 pb-0">
		<button
			type="button"
			onclick={() => (photoTab = 'live')}
			class="px-3 py-1.5 text-[11px] font-bold border-b-2 -mb-px transition"
			class:border-teal={photoTab === 'live'}
			class:text-teal-ink={photoTab === 'live'}
			class:border-transparent={photoTab !== 'live'}
			class:text-muted={photoTab !== 'live'}
		>
			Live
		</button>
		<button
			type="button"
			onclick={() => (photoTab = 'archive')}
			class="px-3 py-1.5 text-[11px] font-bold border-b-2 -mb-px transition"
			class:border-teal={photoTab === 'archive'}
			class:text-teal-ink={photoTab === 'archive'}
			class:border-transparent={photoTab !== 'archive'}
			class:text-muted={photoTab !== 'archive'}
		>
			Archive
		</button>
	</nav>

	{#if photoTab === 'live'}
		{#if livePhotos.length === 0}
			<p class="text-xs text-muted py-2">
				No live renders. Generate from presenter, then archive here by session.
			</p>
		{:else}
			<div class="grid gap-2">
				{#each livePhotos as row (row.url + row.file)}
					<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
						<img
							src={row.url}
							alt={row.label}
							class="h-14 w-24 shrink-0 rounded-lg border border-line object-cover"
							loading="lazy"
						/>
						<div class="flex-1 min-w-0">
							<div class="font-display font-bold text-xs truncate">{row.label}</div>
						</div>
						<button
							type="button"
							onclick={() => downloadImage(row.url, row.file)}
							class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold"
						>
							Save
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{:else if archiveGroups.length === 0}
		<p class="text-xs text-muted py-2">
			Archive is empty. Use “Archive & clear live” to park photos under a session id (date + time).
		</p>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-2 pb-1">
			<p class="text-[10px] text-muted font-mono uppercase tracking-wider">
				Grouped by session id · sorted by date
			</p>
			<div class="flex rounded-lg border border-line overflow-hidden text-[10px] font-bold">
				<button
					type="button"
					onclick={() => (archiveSort = 'newest')}
					class="px-2.5 py-1.5"
					class:bg-teal={archiveSort === 'newest'}
					class:text-bg={archiveSort === 'newest'}
					class:text-muted={archiveSort !== 'newest'}
				>
					Newest first
				</button>
				<button
					type="button"
					onclick={() => (archiveSort = 'oldest')}
					class="px-2.5 py-1.5 border-l border-line"
					class:bg-teal={archiveSort === 'oldest'}
					class:text-bg={archiveSort === 'oldest'}
					class:text-muted={archiveSort !== 'oldest'}
				>
					Oldest first
				</button>
			</div>
		</div>

		<div class="space-y-4 max-h-[52vh] overflow-y-auto pr-0.5">
			{#each archiveGroups as g (g.key)}
				<div class="space-y-2 rounded-xl border border-line/60 bg-bg/40 p-3">
					<div class="flex items-center justify-between gap-2 flex-wrap">
						<div class="min-w-0">
							<h3 class="font-mono text-[11px] font-bold tracking-wide text-gold-ink truncate" title={g.label}>
								{g.label}
							</h3>
							<p class="text-[10px] text-muted">
								{g.sessionDate}
								{#if g.sessionId}
									· id <span class="font-mono">{g.sessionId}</span>
								{/if}
								· {g.items.length} photo{g.items.length === 1 ? '' : 's'}
							</p>
						</div>
						<button
							type="button"
							onclick={() => downloadAll(groupAsRows(g.items, g.sessionId || g.sessionDate))}
							class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold"
						>
							Save session ↓
						</button>
					</div>
					<div class="grid gap-2">
						{#each g.items as a, i (`${g.key}-${a.url}-${i}`)}
							<div class="flex items-center gap-3 rounded-xl border border-line bg-bg p-2.5">
								<img
									src={a.url}
									alt={a.label}
									class="h-14 w-24 shrink-0 rounded-lg border border-line object-cover"
									loading="lazy"
								/>
								<div class="flex-1 min-w-0">
									<div class="font-display font-bold text-xs truncate">{a.label}</div>
									<div class="text-[10px] text-muted font-mono">
										{a.kind}{#if a.tableId}
											· T{a.tableId}{/if} · {new Date(a.archivedAt).toLocaleString()}
									</div>
								</div>
								<button
									type="button"
									onclick={() =>
										downloadImage(
											a.url,
											`${g.sessionId || g.sessionDate}-${a.kind}-${i + 1}.png`
										)}
									class="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold hover:border-gold"
								>
									Save
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
