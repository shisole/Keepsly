<script lang="ts">
	import { page } from '$app/stores';
	import QRCode from '$lib/components/QRCode.svelte';
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import SocialShare from '$lib/components/SocialShare.svelte';
	import { getHostKey } from '$lib/utils/host-keys';

	let { data } = $props();

	let displayName = $derived(data.eventName ?? `Event ${data.eventId}`);
	let uploadUrl = $derived(`${$page.url.origin}/upload/${data.eventId}`);
	let galleryUrl = $derived(`${$page.url.origin}/gallery?event=${data.eventId}`);

	let photos = $state<string[]>([]);
	let copiedId = $state(false);
	let copiedUpload = $state(false);
	let copiedGallery = $state(false);
	let hostKey = $state<string | null>(null);
	let manageUrl = $derived(
		hostKey ? `${$page.url.origin}/event/${data.eventId}/manage?key=${hostKey}` : null
	);
	let downloadingZip = $state(false);

	async function downloadAll() {
		downloadingZip = true;
		try {
			const res = await fetch(`/api/photos/${data.eventId}/download`);
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${displayName}-photos.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			// silent fail
		} finally {
			downloadingZip = false;
		}
	}

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
		hostKey = getHostKey(data.eventId);
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
		{#if manageUrl}
			<a
				href={manageUrl}
				class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.083 1.168-.142l.748-.56a1.14 1.14 0 0 1 1.56.137l.773.773c.4.4.46 1.02.137 1.56l-.56.748c-.225.324-.23.822-.142 1.168s.506.71.93.78l.894.15c.542.09.94.56.94 1.11v1.093c0 .55-.398 1.02-.94 1.11l-.894.149c-.424.07-.764.384-.93.78s-.083.844.142 1.168l.56.748a1.14 1.14 0 0 1-.137 1.56l-.773.773a1.14 1.14 0 0 1-1.56.137l-.748-.56c-.324-.225-.822-.23-1.168-.142s-.71.506-.78.93l-.15.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894a1.15 1.15 0 0 0-.78-.93c-.396-.166-.844-.083-1.168.142l-.748.56a1.14 1.14 0 0 1-1.56-.137l-.773-.773a1.14 1.14 0 0 1-.137-1.56l.56-.748c.225-.324.23-.822.142-1.168a1.15 1.15 0 0 0-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.11v-1.093c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78s.083-.844-.142-1.168l-.56-.748a1.14 1.14 0 0 1 .137-1.56l.773-.773a1.14 1.14 0 0 1 1.56-.137l.748.56c.324.225.822.23 1.168.142.396-.166.71-.506.78-.93l.15-.894Z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
				</svg>
				Manage Event
			</a>
		{/if}
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

			<SocialShare url={uploadUrl} text={`Upload photos to ${displayName}!`} />

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

			<SocialShare url={galleryUrl} text={`${displayName} - Photo Gallery`} />
		</div>

		<div>
			<h2 class="mb-4 text-lg font-semibold text-gray-700">
				Photos ({photos.length})
			</h2>
			{#if photos.length > 0}
				<button
					onclick={downloadAll}
					disabled={downloadingZip}
					class="mb-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
				>
					{#if downloadingZip}
						<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
						Preparing ZIP...
					{:else}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
						</svg>
						Download All
					{/if}
				</button>
			{/if}
			<PhotoGallery {photos} />
		</div>
	</div>
</div>
