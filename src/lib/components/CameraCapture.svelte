<script lang="ts">
	let { onFiles, disabled = false }: { onFiles: (files: File[]) => void; disabled?: boolean } =
		$props();
	let fileInput: HTMLInputElement;
	let cameraInput: HTMLInputElement;

	function handleFiles(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
			onFiles(Array.from(input.files));
			input.value = '';
		}
	}
</script>

<div class="flex gap-3">
	<button
		onclick={() => cameraInput.click()}
		{disabled}
		class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
	>
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
			/>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
		Camera
	</button>

	<button
		onclick={() => fileInput.click()}
		{disabled}
		class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50 disabled:opacity-50"
	>
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
		Gallery
	</button>
</div>

<input
	bind:this={cameraInput}
	type="file"
	accept="image/*"
	capture="environment"
	onchange={handleFiles}
	class="hidden"
/>
<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	multiple
	onchange={handleFiles}
	class="hidden"
/>
