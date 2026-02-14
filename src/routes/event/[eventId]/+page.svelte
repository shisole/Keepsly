<script lang="ts">
	import { page } from '$app/stores';
	import QRCode from '$lib/components/QRCode.svelte';
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import SEO from '$lib/components/SEO.svelte';

	let { data } = $props();

	let displayName = $derived(data.eventName ?? `Event ${data.eventId}`);
	let uploadUrl = $derived(`${$page.url.origin}/upload/${data.eventId}`);
	let galleryUrl = $derived(`${$page.url.origin}/gallery?event=${data.eventId}`);

	let photos = $state<string[]>([]);
	let copiedId = $state(false);
	let copiedUpload = $state(false);
	let copiedGallery = $state(false);

	async function fetchPhotos() {
		try {
			const res = await fetch(`/api/photos/${data.eventId}`);
			if (res.ok) {
				const result = await res.json();
				photos = result.photos;
			}
		} catch {
			// silently retry on next poll
		}
	}

	async function copyText(text: string, type: 'id' | 'upload' | 'gallery') {
		await navigator.clipboard.writeText(text);
		if (type === 'id') {
			copiedId = true;
			setTimeout(() => (copiedId = false), 2000);
		} else if (type === 'upload') {
			copiedUpload = true;
			setTimeout(() => (copiedUpload = false), 2000);
		} else {
			copiedGallery = true;
			setTimeout(() => (copiedGallery = false), 2000);
		}
	}

	async function shareUploadLink() {
		if (navigator.share) {
			await navigator.share({
				title: `Upload photos to ${displayName}!`,
				url: uploadUrl
			});
		} else {
			copyText(uploadUrl, 'upload');
		}
	}

	async function shareGalleryLink() {
		if (navigator.share) {
			await navigator.share({
				title: `${displayName} - Photo Gallery`,
				url: galleryUrl
			});
		} else {
			copyText(galleryUrl, 'gallery');
		}
	}

	$effect(() => {
		fetchPhotos();
		const interval = setInterval(fetchPhotos, 5000);
		return () => clearInterval(interval);
	});
</script>

<SEO
	title={`${displayName} - Keepsly`}
	description={`Share photos for ${displayName}. Scan the QR code or use the link to upload.`}
	image={data.bannerUrl ?? data.firstPhoto}
/>

<div class="mx-auto max-w-4xl px-4 py-8">
	<a
		href="/"
		class="mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
		Back
	</a>

	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">{displayName}</h1>
		<p class="text-gray-500">Share the QR code or link with your guests</p>
	</div>

	{#if data.bannerUrl}
		<div class="mb-8 overflow-hidden rounded-2xl shadow-sm ring-1 ring-gray-100">
			<img src={data.bannerUrl} alt="{displayName} banner" class="h-48 w-full object-cover" />
		</div>
	{/if}

	<div class="space-y-6">
		<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
			<h2 class="mb-4 text-center text-lg font-semibold text-gray-700">
				Scan to upload photos
			</h2>
			<QRCode url={uploadUrl} />
		</div>

		<div class="space-y-3">
			<div class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
				<span class="text-xs font-medium text-gray-400">ID</span>
				<span class="flex-1 truncate font-mono text-sm text-gray-700">{data.eventId}</span>
				<button
					onclick={() => copyText(data.eventId, 'id')}
					class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
				>
					{copiedId ? 'Copied!' : 'Copy'}
				</button>
			</div>

			<div class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
				<span class="text-xs font-medium text-gray-400">Upload</span>
				<span class="flex-1 truncate text-sm text-gray-700">{uploadUrl}</span>
				<button
					onclick={() => copyText(uploadUrl, 'upload')}
					class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
				>
					{copiedUpload ? 'Copied!' : 'Copy'}
				</button>
				<button
					onclick={shareUploadLink}
					class="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark"
				>
					Share
				</button>
			</div>

			<div class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
				<span class="text-xs font-medium text-gray-400">Gallery</span>
				<span class="flex-1 truncate text-sm text-gray-700">{galleryUrl}</span>
				<button
					onclick={() => copyText(galleryUrl, 'gallery')}
					class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
				>
					{copiedGallery ? 'Copied!' : 'Copy'}
				</button>
				<button
					onclick={shareGalleryLink}
					class="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark"
				>
					Share
				</button>
			</div>
		</div>

		<div>
			<h2 class="mb-4 text-lg font-semibold text-gray-700">
				Photos ({photos.length})
			</h2>
			<PhotoGallery {photos} />
		</div>
	</div>
</div>
