<script lang="ts">
	import * as QRCodeLib from 'qrcode';

	let { url }: { url: string } = $props();
	let canvas: HTMLCanvasElement;

	$effect(() => {
		if (canvas && url) {
			QRCodeLib.toCanvas(canvas, url, {
				width: 256,
				margin: 2,
				color: { dark: '#000000', light: '#ffffff' }
			});
		}
	});
</script>

<div class="flex flex-col items-center gap-3">
	<canvas bind:this={canvas} class="rounded-lg shadow-md"></canvas>
	<p class="max-w-xs break-all text-center text-sm text-gray-500">{url}</p>
</div>
