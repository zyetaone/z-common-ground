<script lang="ts">
	import QR from 'qrcode';
	import { onMount } from 'svelte';

	let { text, size = 160 }: { text: string; size?: number } = $props();
	let dataUrl = $state('');

	onMount(async () => {
		dataUrl = await QR.toDataURL(text, { width: size, margin: 1, color: { dark: '#070b14', light: '#F7F3EA' } });
	});
</script>

{#if dataUrl}
	<img src={dataUrl} alt="QR code" class="rounded-lg" />
{:else}
	<div class="rounded-lg" style="width:{size}px;height:{size}px;background:#F7F3EA"></div>
{/if}
