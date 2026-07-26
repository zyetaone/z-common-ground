<script lang="ts">
	// Monochrome inline icons — inherit currentColor, replace ad-hoc emoji.
	// Only the glyphs actually used in the app. Add a path when a new one is needed.
	let {
		name,
		size = 20,
		stroke = 2
	}: { name: 'search' | 'hourglass' | 'building' | 'broadcast' | 'camera'; size?: number; stroke?: number } =
		$props();

	const paths: Record<string, string> = {
		search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.35-4.35',
		hourglass:
			'M6 2h12M6 22h12M8 2v3.5a4 4 0 0 0 1.2 2.8L12 11l2.8-2.7A4 4 0 0 0 16 5.5V2M8 22v-3.5a4 4 0 0 1 1.2-2.8L12 13l2.8 2.7A4 4 0 0 1 16 18.5V22',
		building: 'M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01',
		broadcast:
			'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14',
		camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	<path d={paths[name]} />
</svg>
