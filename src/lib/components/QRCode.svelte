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

	function save() {
		const dataUrl = canvas.toDataURL('image/png');
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = 'qr-code.png';
		a.click();
	}
</script>

<div class="flex flex-col items-center gap-3">
	<canvas bind:this={canvas} class="rounded-lg shadow-md"></canvas>
	<button
		onclick={save}
		class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
	>
		Save QR Code
	</button>
	<p class="max-w-xs break-all text-center text-sm text-gray-500">{url}</p>
</div>
