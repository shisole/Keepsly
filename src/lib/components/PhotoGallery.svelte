<script lang="ts">
	let { photos }: { photos: string[] } = $props();
	let lightboxIndex = $state<number | null>(null);

	let lightboxUrl = $derived(lightboxIndex !== null ? photos[lightboxIndex] : null);

	// Swipe tracking
	let touchStartX = 0;
	let touchStartY = 0;
	let swiping = false;

	function openLightbox(index: number) {
		lightboxIndex = index;
		document.body.style.overflow = 'hidden';
	}

	function closeLightbox() {
		lightboxIndex = null;
		document.body.style.overflow = '';
	}

	function prev() {
		if (lightboxIndex !== null) {
			lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
		}
	}

	function next() {
		if (lightboxIndex !== null) {
			lightboxIndex = (lightboxIndex + 1) % photos.length;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (lightboxIndex === null) return;
		if (e.key === 'Escape') closeLightbox();
		if (e.key === 'ArrowLeft') prev();
		if (e.key === 'ArrowRight') next();
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		swiping = false;
	}

	function handleTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
			swiping = true;
			if (dx > 0) prev();
			else next();
		}
	}

	let downloading = $state(false);

	async function downloadPhoto() {
		if (!lightboxUrl || downloading) return;
		downloading = true;
		try {
			const res = await fetch(lightboxUrl);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `photo-${(lightboxIndex ?? 0) + 1}.jpg`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			// download failed silently
		} finally {
			downloading = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if photos.length === 0}
	<p class="py-12 text-center text-gray-400">No photos yet. Waiting for uploads...</p>
{:else}
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
		{#each photos as photo, i}
			<button
				onclick={() => openLightbox(i)}
				class="relative aspect-square overflow-hidden rounded-lg transition-transform hover:scale-[1.02]"
			>
				<div class="absolute inset-0 animate-pulse bg-gray-200"></div>
				<img
					src={photo}
					alt=""
					class="relative h-full w-full object-cover opacity-0 transition-opacity duration-300"
					loading="lazy"
					onload={(e) => { (e.currentTarget as HTMLImageElement).classList.remove('opacity-0'); }}
				/>
			</button>
		{/each}
	</div>
{/if}

{#if lightboxUrl !== null && lightboxIndex !== null}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
		onclick={(e) => { if (!swiping) closeLightbox(); }}
		onkeydown={() => {}}
		ontouchstart={handleTouchStart}
		ontouchend={handleTouchEnd}
	>
		<button
			onclick={(e) => { e.stopPropagation(); closeLightbox(); }}
			aria-label="Close"
			class="absolute left-3 top-3 z-10 rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/40 sm:hidden"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>

		<button
			onclick={(e) => { e.stopPropagation(); prev(); }}
			aria-label="Previous photo"
			class="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/40 sm:left-4"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
		</button>

		<img
			src={lightboxUrl}
			alt="Full size"
			class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		/>

		<button
			onclick={(e) => { e.stopPropagation(); next(); }}
			aria-label="Next photo"
			class="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/40 sm:right-4"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
		</button>

		<button
			onclick={(e) => { e.stopPropagation(); downloadPhoto(); }}
			disabled={downloading}
			aria-label="Download photo"
			class="absolute bottom-4 right-4 z-10 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/40 disabled:opacity-50"
		>
			{#if downloading}
				<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
				</svg>
			{:else}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
				</svg>
			{/if}
		</button>

		<div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
			{lightboxIndex + 1} / {photos.length}
		</div>
	</div>
{/if}
