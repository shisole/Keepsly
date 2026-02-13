<script lang="ts">
	let {
		files,
		onRemove
	}: { files: File[]; onRemove: (index: number) => void } = $props();

	let previews = $derived(files.map((f) => URL.createObjectURL(f)));

	$effect(() => {
		const urls = previews;
		return () => urls.forEach((u) => URL.revokeObjectURL(u));
	});
</script>

{#if files.length > 0}
	<div class="grid grid-cols-3 gap-2">
		{#each previews as src, i}
			<div class="group relative aspect-square overflow-hidden rounded-lg">
				<img {src} alt="Preview {i + 1}" class="h-full w-full object-cover" />
				<button
					onclick={() => onRemove(i)}
					class="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white transition-opacity hover:bg-black/80"
				>
					&times;
				</button>
			</div>
		{/each}
	</div>
{/if}
