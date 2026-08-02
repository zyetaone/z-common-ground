<script lang="ts" module>
	// Monochrome inline icons — inherit currentColor, replace ad-hoc emoji.
	// Only the glyphs actually used in the app. Add a path when a new one is needed.
	const paths = {
		search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-4.35-4.35',
		hourglass:
			'M6 2h12M6 22h12M8 2v3.5a4 4 0 0 0 1.2 2.8L12 11l2.8-2.7A4 4 0 0 0 16 5.5V2M8 22v-3.5a4 4 0 0 1 1.2-2.8L12 13l2.8 2.7A4 4 0 0 1 16 18.5V22',
		building:
			'M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01',
		broadcast:
			'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14',
		camera:
			'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
		flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
		chart: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3',
		trophy:
			'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
		snowflake:
			'M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4',
		handshake:
			'M3 4h8M21 4h-1.07a2 2 0 0 0-1.42.25l-.47.28a5.79 5.79 0 0 0-7.06-.87L8.19 6.47a1 1 0 1 0 3 3l.88-.88a3 3 0 0 1 4.24 0l3.88 3.88a1 1 0 1 1-3 3L14 14M11 17l2 2a1 1 0 1 0 3-3M21 3l1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3',
		lightning: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
		scale:
			'M16 16.5a2.5 2.5 0 0 0 5 0l-2.5-6-2.5 6ZM3 16.5a2.5 2.5 0 0 0 5 0l-2.5-6L3 16.5ZM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2',
		brain:
			'M12 18V5M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5M17.997 5.125a4 4 0 0 1 2.526 5.77M18 18a4 4 0 0 0 2-7.464M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517M6 18a4 4 0 0 1-2-7.464M6.003 5.125a4 4 0 0 0-2.526 5.77',
		phone:
			'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
		check: 'M20 6 9 17l-5-5',
		target:
			'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
		info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01'
	};
	export type IconName = keyof typeof paths;
</script>

<script lang="ts">
	let { name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number } =
		$props();
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
