<script lang="ts">
	let { photos }: { photos: string[] } = $props();
	let lightboxUrl = $state<string | null>(null);

	function openLightbox(url: string) {
		lightboxUrl = url;
	}

	function closeLightbox() {
		lightboxUrl = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeLightbox();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if photos.length === 0}
	<p class="py-12 text-center text-gray-400">No photos yet. Waiting for uploads...</p>
{:else}
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
		{#each photos as photo}
			<button
				onclick={() => openLightbox(photo)}
				class="aspect-square overflow-hidden rounded-lg transition-transform hover:scale-[1.02]"
			>
				<img src={photo} alt="" class="h-full w-full object-cover" loading="lazy" />
			</button>
		{/each}
	</div>
{/if}

{#if lightboxUrl}
	<button
		onclick={closeLightbox}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
	>
		<img src={lightboxUrl} alt="Full size" class="max-h-full max-w-full rounded-lg object-contain" />
	</button>
{/if}
