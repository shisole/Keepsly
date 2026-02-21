<script lang="ts">
	import { page } from '$app/stores';
	import QRCode from '$lib/components/QRCode.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import SocialShare from '$lib/components/SocialShare.svelte';
	import { connectPhotoStream } from '$lib/utils/photo-stream';

	let { data } = $props();

	let photos = $state<string[]>(data.initialPhotos);
	let nextCursor = $state<string | null>(data.initialNextCursor ?? null);
	let loadingMore = $state(false);
	let sentinelEl = $state<HTMLDivElement | null>(null);
	let uploadUrl = $derived(`${$page.url.origin}/upload/${data.eventId}`);
	let galleryUrl = $derived(`${$page.url.origin}/gallery?event=${data.eventId}`);

	let expired = $derived(new Date() > new Date(data.uploadDeadline));
	let timeRemaining = $state('');

	let copiedUpload = $state(false);
	let copiedGallery = $state(false);
	let downloadingZip = $state(false);

	// Lightbox
	let lightboxIndex = $state<number | null>(null);
	let lightboxUrl = $derived(lightboxIndex !== null ? photos[lightboxIndex] : null);
	let touchStartX = 0;
	let touchStartY = 0;
	let swiping = false;
	let downloadingPhoto = $state(false);

	function openLightbox(index: number) {
		lightboxIndex = index;
		document.body.style.overflow = 'hidden';
	}

	function closeLightbox() {
		lightboxIndex = null;
		document.body.style.overflow = '';
	}

	function prevPhoto() {
		if (lightboxIndex !== null) {
			lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
		}
	}

	function nextPhoto() {
		if (lightboxIndex !== null) {
			lightboxIndex = (lightboxIndex + 1) % photos.length;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (lightboxIndex === null) return;
		if (e.key === 'Escape') closeLightbox();
		if (e.key === 'ArrowLeft') prevPhoto();
		if (e.key === 'ArrowRight') nextPhoto();
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
			if (dx > 0) prevPhoto();
			else nextPhoto();
		}
	}

	async function downloadPhoto() {
		if (!lightboxUrl || downloadingPhoto) return;
		downloadingPhoto = true;
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
			// silent
		} finally {
			downloadingPhoto = false;
		}
	}

	function deleteLightboxPhoto() {
		if (lightboxUrl) {
			const target = lightboxUrl;
			closeLightbox();
			deleteTarget = target;
		}
	}

	// Photo deletion
	let deleteTarget = $state<string | null>(null);
	let deleting = $state(false);
	let deletingPhotos = $state(new Set<string>());
	let newPhotos = $state(new Set<string>());

	function updateTimeRemaining() {
		const deadline = new Date(data.uploadDeadline);
		const now = new Date();
		const diff = deadline.getTime() - now.getTime();
		if (diff <= 0) {
			timeRemaining = 'Expired';
			return;
		}
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		if (days > 0) {
			timeRemaining = `${days}d ${hours}h remaining`;
		} else {
			const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
			timeRemaining = `${hours}h ${minutes}m remaining`;
		}
	}

	async function copyText(text: string, type: 'upload' | 'gallery') {
		await navigator.clipboard.writeText(text);
		if (type === 'upload') {
			copiedUpload = true;
			setTimeout(() => (copiedUpload = false), 2000);
		} else {
			copiedGallery = true;
			setTimeout(() => (copiedGallery = false), 2000);
		}
	}

	async function downloadAll() {
		downloadingZip = true;
		try {
			const res = await fetch(`/api/photos/${data.eventId}/download`);
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${data.eventName}-photos.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			// silent
		} finally {
			downloadingZip = false;
		}
	}

	function getPhotoId(photoUrl: string): string {
		// URL format: https://pub-xxx.r2.dev/events/{eventId}/{photoId}.jpg
		const parts = photoUrl.split('/');
		const filename = parts[parts.length - 1];
		return filename.replace('.jpg', '');
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		const photoId = getPhotoId(deleteTarget);
		const target = deleteTarget;
		try {
			const res = await fetch(
				`/api/photos/${data.eventId}/${photoId}?key=${data.hostKey}`,
				{ method: 'DELETE' }
			);
			if (res.ok) {
				const updated = new Set(deletingPhotos);
				updated.add(target);
				deletingPhotos = updated;
				setTimeout(() => {
					photos = photos.filter((p) => p !== target);
					const cleanup = new Set(deletingPhotos);
					cleanup.delete(target);
					deletingPhotos = cleanup;
				}, 400);
			}
		} catch {
			// silent
		} finally {
			deleting = false;
			deleteTarget = null;
		}
	}

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		loadingMore = true;
		try {
			const res = await fetch(`/api/photos/${data.eventId}?limit=20&cursor=${nextCursor}`);
			if (!res.ok) return;
			const json = await res.json();
			photos = [...photos, ...json.photos];
			nextCursor = json.nextCursor ?? null;
		} catch {
			// silent
		} finally {
			loadingMore = false;
		}
	}

	$effect(() => {
		const el = sentinelEl;
		if (!el || !nextCursor) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && nextCursor && !loadingMore) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(el);
		return () => observer.disconnect();
	});

	$effect(() => {
		updateTimeRemaining();
		const timer = setInterval(updateTimeRemaining, 60000);
		let isFirstSSE = true;
		const disconnect = connectPhotoStream(data.eventId, {
			onPhotos: (p) => {
				// Detect newly added photos (skip first SSE to avoid animating initial load)
				if (!isFirstSSE) {
					const currentSet = new Set(photos);
					const added = p.filter((url) => !currentSet.has(url));
					if (added.length > 0) {
						const fresh = new Set(newPhotos);
						added.forEach((url) => fresh.add(url));
						newPhotos = fresh;
						setTimeout(() => {
							const cleanup = new Set(newPhotos);
							added.forEach((url) => cleanup.delete(url));
							newPhotos = cleanup;
						}, 400);
					}
				}
				isFirstSSE = false;
				// Keep photos that are currently animating out
				const animating = [...deletingPhotos].filter((url) => !p.includes(url));
				photos = [...p, ...animating];
				nextCursor = null;
			}
		});
		return () => {
			clearInterval(timer);
			disconnect();
		};
	});
</script>

<SEO
	title={`Manage ${data.eventName} — Keepsly`}
	description={`Host dashboard for ${data.eventName}`}
/>

<svelte:window onkeydown={handleKeydown} />

<div class="mx-auto max-w-4xl px-4 py-8">
	<a
		href="/event/{data.eventId}"
		class="mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Event
	</a>

	<!-- Header -->
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">{data.eventName}</h1>
		<p class="text-gray-500">Host Dashboard</p>
	</div>

	{#if data.bannerUrl}
		<div class="mb-8 overflow-hidden rounded-2xl shadow-sm ring-1 ring-gray-100">
			<img
				src={data.bannerUrl}
				alt="{data.eventName} banner"
				class="h-48 w-full object-cover"
			/>
		</div>
	{/if}

	<!-- Stats Cards -->
	<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
		<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
			<p class="text-sm text-gray-500">Total Photos</p>
			<p class="text-3xl font-bold text-gray-900">{photos.length}</p>
			<p class="text-xs text-gray-400">of {data.maxPhotos} max per guest</p>
		</div>
		<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
			<p class="text-sm text-gray-500">Upload Deadline</p>
			<p class="text-lg font-bold {expired ? 'text-red-600' : 'text-gray-900'}">
				{timeRemaining}
			</p>
			<p class="text-xs text-gray-400">
				{new Date(data.uploadDeadline).toLocaleDateString()}
			</p>
		</div>
		<div
			class="col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:col-span-1"
		>
			<p class="text-sm text-gray-500">Status</p>
			<p class="text-lg font-bold {expired ? 'text-red-600' : 'text-green-600'}">
				{expired ? 'Closed' : 'Active'}
			</p>
			<p class="text-xs text-gray-400">
				{expired ? 'Uploads closed' : 'Accepting uploads'}
			</p>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="mb-8 space-y-3">
		<h2 class="text-lg font-semibold text-gray-700">Share & Download</h2>

		<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
			<h3 class="mb-4 text-center text-sm font-medium text-gray-500">
				Scan to upload photos
			</h3>
			<QRCode url={uploadUrl} />
		</div>

		<div
			class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100"
		>
			<span class="text-xs font-medium text-gray-400">Upload</span>
			<span class="flex-1 truncate text-sm text-gray-700">{uploadUrl}</span>
			<button
				onclick={() => copyText(uploadUrl, 'upload')}
				class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
			>
				{copiedUpload ? 'Copied!' : 'Copy'}
			</button>
		</div>

		<SocialShare url={uploadUrl} text={`Upload photos to ${data.eventName}!`} />

		<div
			class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100"
		>
			<span class="text-xs font-medium text-gray-400">Gallery</span>
			<span class="flex-1 truncate text-sm text-gray-700">{galleryUrl}</span>
			<button
				onclick={() => copyText(galleryUrl, 'gallery')}
				class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
			>
				{copiedGallery ? 'Copied!' : 'Copy'}
			</button>
		</div>

		{#if photos.length > 0}
			<button
				onclick={downloadAll}
				disabled={downloadingZip}
				class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
			>
				{#if downloadingZip}
					<span class="inline-flex items-center gap-2">
						<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							></path>
						</svg>
						Preparing ZIP...
					</span>
				{:else}
					<span class="inline-flex items-center gap-2">
						<svg
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
							/>
						</svg>
						Download All Photos ({photos.length})
					</span>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Photo Grid with Moderation -->
	<div>
		<h2 class="mb-4 text-lg font-semibold text-gray-700">
			Photos ({photos.length})
		</h2>

		{#if photos.length === 0}
			<p class="py-12 text-center text-gray-400">
				No photos yet. Waiting for uploads...
			</p>
		{:else}
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
				{#each photos as photo, i}
					<div
						class="group relative aspect-square overflow-hidden rounded-lg"
						style={deletingPhotos.has(photo) ? 'animation: photo-delete 0.4s ease-out forwards; pointer-events: none;' : newPhotos.has(photo) ? 'animation: photo-add 0.4s ease-out;' : ''}
					>
						<button
							onclick={() => openLightbox(i)}
							class="h-full w-full"
						>
							<div class="absolute inset-0 animate-pulse bg-gray-200"></div>
							<img
								src={photo}
								alt=""
								class="relative h-full w-full object-cover opacity-0 transition-opacity duration-300"
								loading="lazy"
								onload={(e) => {
									(e.currentTarget as HTMLImageElement).classList.remove('opacity-0');
								}}
							/>
						</button>
						<button
							onclick={(e) => {
								e.stopPropagation();
								deleteTarget = photo;
							}}
							aria-label="Delete photo"
							class="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-all hover:bg-red-600 group-hover:opacity-100"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
			{#if nextCursor}
				<div bind:this={sentinelEl} class="flex justify-center py-6">
					{#if loadingMore}
						<svg class="h-6 w-6 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Lightbox -->
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
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
		</button>

		<button
			onclick={(e) => { e.stopPropagation(); prevPhoto(); }}
			aria-label="Previous photo"
			class="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/40 sm:left-4"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
		</button>

		<img
			src={lightboxUrl}
			alt="Full size"
			class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		/>

		<button
			onclick={(e) => { e.stopPropagation(); nextPhoto(); }}
			aria-label="Next photo"
			class="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/40 sm:right-4"
		>
			<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
		</button>

		<button
			onclick={(e) => { e.stopPropagation(); downloadPhoto(); }}
			disabled={downloadingPhoto}
			aria-label="Download photo"
			class="absolute bottom-4 right-4 z-10 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/40 disabled:opacity-50"
		>
			{#if downloadingPhoto}
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

		<button
			onclick={(e) => { e.stopPropagation(); deleteLightboxPhoto(); }}
			aria-label="Delete photo"
			class="absolute bottom-4 left-4 z-10 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-red-600"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
			</svg>
		</button>

		<div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
			{lightboxIndex + 1} / {photos.length}
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if deleteTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={() => {
			if (!deleting) deleteTarget = null;
		}}
		onkeydown={() => {}}
	>
		<div
			class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<h3 class="mb-2 text-lg font-semibold text-gray-900">Delete photo?</h3>
			<p class="mb-6 text-sm text-gray-500">
				This action cannot be undone. The photo will be permanently removed.
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => {
						deleteTarget = null;
					}}
					disabled={deleting}
					class="flex-1 rounded-xl border border-gray-300 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={confirmDelete}
					disabled={deleting}
					class="flex-1 rounded-xl bg-red-600 py-2.5 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
				>
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
