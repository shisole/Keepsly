<script lang="ts">
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import CameraCapture from '$lib/components/CameraCapture.svelte';
	import PhotoPreview from '$lib/components/PhotoPreview.svelte';
	import UploadProgress from '$lib/components/UploadProgress.svelte';
	import QRCode from '$lib/components/QRCode.svelte';
	import { compressImage } from '$lib/utils/compress';
	import { uploadWithProgress } from '$lib/utils/upload';
	import { getUploadedCount, incrementUploadedCount } from '$lib/utils/upload-limit';
	import { page } from '$app/stores';
	import SEO from '$lib/components/SEO.svelte';
	import SocialShare from '$lib/components/SocialShare.svelte';
	import { connectPhotoStream } from '$lib/utils/photo-stream';

	let { data } = $props();

	let eventIdInput = $state('');
	let eventId = $state($page.url.searchParams.get('event') ?? '');
	let eventName = $state<string | null>(null);
	let bannerUrl = $state<string | null>(data.bannerUrl);
	let photos = $state<string[]>([]);
	let loading = $state(!!eventId);
	let eventLoaded = $state(false);
	let notFound = $state(false);
	let errorMessage = $state('');

	// Upload state
	let maxPhotos = $state(5);
	let uploadDeadline = $state<string | null>(null);
	let expired = $derived(uploadDeadline ? new Date() > new Date(uploadDeadline) : false);
	let selectedFiles = $state<File[]>([]);
	let uploadedCount = $state(0);
	let isUploading = $state(false);
	let uploadCurrent = $state(0);
	let uploadTotal = $state(0);
	let uploadStatus = $state('');
	let filePercent = $state(0);
	let uploadError = $state('');
	let done = $state(false);

	let remaining = $derived(maxPhotos - uploadedCount - selectedFiles.length);
	let canAddMore = $derived(remaining > 0 && !isUploading && !done && !expired);
	let copiedId = $state(false);
	let copiedLink = $state(false);
	let downloadingZip = $state(false);

	async function downloadAll() {
		downloadingZip = true;
		try {
			const res = await fetch(`/api/photos/${eventId}/download`);
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

	let displayName = $derived(eventName ?? (eventId ? `Event ${eventId}` : 'Gallery'));
	let uploadLink = $derived(eventId ? `${$page.url.origin}/upload/${eventId}` : '');
	let galleryLink = $derived(eventId ? `${$page.url.origin}/gallery?event=${eventId}` : '');

	// Recent searches
	interface RecentSearch {
		eventId: string;
		eventName: string | null;
		timestamp: number;
	}
	const RECENT_KEY = 'keepsly_recent_searches';
	const MAX_RECENT = 5;
	let recentSearches = $state<RecentSearch[]>([]);

	function loadRecentSearches() {
		try {
			const raw = localStorage.getItem(RECENT_KEY);
			recentSearches = raw ? JSON.parse(raw) : [];
		} catch {
			recentSearches = [];
		}
	}

	function saveRecentSearch(id: string, name: string | null) {
		const filtered = recentSearches.filter((r) => r.eventId !== id);
		const updated = [{ eventId: id, eventName: name, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
		recentSearches = updated;
		localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
	}

	function selectRecent(id: string) {
		eventIdInput = id;
		eventId = id;
		eventName = null;
		notFound = false;
		eventLoaded = false;
		loading = true;
		const url = new URL($page.url);
		url.searchParams.set('event', id);
		history.replaceState({}, '', url);
		fetchPhotos(id, true);
	}

	async function copyText(text: string, type: 'id' | 'link') {
		await navigator.clipboard.writeText(text);
		if (type === 'id') {
			copiedId = true;
			setTimeout(() => (copiedId = false), 2000);
		} else {
			copiedLink = true;
			setTimeout(() => (copiedLink = false), 2000);
		}
	}

	async function shareLink() {
		if (navigator.share) {
			await navigator.share({
				title: `Upload photos to ${displayName}!`,
				url: uploadLink
			});
		} else {
			copyText(uploadLink, 'link');
		}
	}

	async function fetchPhotos(id: string, isInitial = false) {
		if (isInitial) loading = true;
		errorMessage = '';
		notFound = false;
		try {
			const res = await fetch(`/api/photos/${id}`);
			if (!res.ok) throw new Error('Event not found');
			const data = await res.json();
			photos = data.photos;
			eventName = data.eventName ?? null;
			bannerUrl = data.bannerUrl ?? null;
			maxPhotos = data.maxPhotos ?? 5;
			uploadDeadline = data.uploadDeadline ?? null;
			if (!eventName && photos.length === 0) {
				notFound = true;
				eventLoaded = false;
			} else {
				eventLoaded = true;
				saveRecentSearch(id, data.eventName ?? null);
			}
		} catch {
			photos = [];
			eventName = null;
			notFound = true;
			eventLoaded = false;
		} finally {
			loading = false;
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = eventIdInput.trim();
		if (trimmed.length < 5) return;
		eventId = trimmed;
		eventName = null;
		notFound = false;
		eventLoaded = false;
		loading = true;
		const url = new URL($page.url);
		url.searchParams.set('event', trimmed);
		history.replaceState({}, '', url);
		fetchPhotos(trimmed, true);
	}

	function handleFiles(files: File[]) {
		const imageFiles = files.filter((f) => f.type.startsWith('image/'));
		const toAdd = imageFiles.slice(0, remaining);
		selectedFiles = [...selectedFiles, ...toAdd];
	}

	function removeFile(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	async function upload() {
		if (selectedFiles.length === 0 || !eventId) return;

		isUploading = true;
		uploadError = '';
		uploadTotal = selectedFiles.length;
		uploadCurrent = 0;

		try {
			for (const file of selectedFiles) {
				filePercent = 0;
				uploadStatus = `Compressing photo ${uploadCurrent + 1}...`;
				const compressed = await compressImage(file);

				uploadStatus = `Uploading photo ${uploadCurrent + 1}...`;
				await uploadWithProgress(
					`/api/photos/${eventId}`,
					compressed,
					(p) => (filePercent = p)
				);

				filePercent = 100;
				uploadCurrent++;
				incrementUploadedCount(eventId);
				uploadedCount = getUploadedCount(eventId);
			}

			selectedFiles = [];
			uploadStatus = 'All photos uploaded!';
			done = uploadedCount >= maxPhotos;
			fetchPhotos(eventId, false);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
			uploadStatus = '';
		} finally {
			isUploading = false;
		}
	}

	let disconnectStream: (() => void) | null = null;

	$effect(() => {
		loadRecentSearches();
		// Clean up previous stream
		disconnectStream?.();
		disconnectStream = null;

		if (eventId) {
			eventIdInput = eventId;
			uploadedCount = getUploadedCount(eventId);
			done = uploadedCount >= maxPhotos;
			fetchPhotos(eventId, true).then(() => {
				if (eventLoaded && !notFound) {
					disconnectStream = connectPhotoStream(eventId, {
						onPhotos: (p) => {
							photos = p;
						}
					});
				}
			});
		}

		return () => {
			disconnectStream?.();
		};
	});
</script>

<SEO
	title={`${eventId ? `${displayName} - Gallery` : 'Gallery'} - Keepsly`}
	description={`View photos from ${eventId ? displayName : 'a Keepsly event'}.`}
	image={bannerUrl ?? data.bannerUrl}
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
		<h1 class="mb-2 text-3xl font-bold text-gray-900">{eventId ? displayName : 'Gallery'}</h1>
		<p class="text-gray-500">{eventId ? 'View and Upload Photos' : 'Enter your event ID to view and upload photos'}</p>
	</div>

	{#if bannerUrl && eventLoaded}
		<div class="mx-auto mb-8 max-w-lg overflow-hidden rounded-2xl shadow-sm ring-1 ring-gray-100">
			<img src={bannerUrl} alt="{displayName} banner" class="h-48 w-full object-cover" />
		</div>
	{/if}

	<form onsubmit={handleSubmit} class="mx-auto mb-8 flex max-w-md gap-2">
		<input
			type="text"
			bind:value={eventIdInput}
			placeholder="Event ID"
			class="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-center text-lg tracking-wide focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
		/>
		<button
			type="submit"
			disabled={eventIdInput.trim().length < 5 || loading}
			class="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if loading}
				<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
				</svg>
			{:else}
				View
			{/if}
		</button>
	</form>

	{#if recentSearches.length > 0 && !eventLoaded && !loading}
		<div class="mx-auto mb-8 max-w-md">
			<p class="mb-3 text-xs font-medium text-gray-400">Recent searches</p>
			<div class="flex flex-col gap-2">
				{#each recentSearches as recent}
					<button
						onclick={() => selectRecent(recent.eventId)}
						class="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-gray-100 transition-all hover:bg-gray-50 hover:shadow-md"
					>
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-gray-800">{recent.eventName ?? 'Unnamed Event'}</p>
							<p class="truncate font-mono text-xs text-gray-400">{recent.eventId}</p>
						</div>
						<svg class="h-4 w-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="flex flex-col items-center gap-3 py-12">
			<svg class="h-8 w-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			<p class="text-sm text-gray-400">Loading event...</p>
		</div>
	{/if}

	{#if notFound && !loading}
		<div class="mx-auto max-w-sm rounded-2xl bg-gray-50 p-8 text-center">
			<p class="mb-2 text-lg font-semibold text-gray-700">No event found</p>
			<p class="mb-5 text-sm text-gray-500">We couldn't find an event with that ID. Want to start a new one?</p>
			<a
				href="/"
				class="inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
			>
				Create an Event
			</a>
		</div>
	{/if}

	{#if eventId && eventLoaded && !notFound}
		<div class="mx-auto mb-8 max-w-lg space-y-3">
			<div class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
				<span class="text-xs font-medium text-gray-400">Event ID</span>
				<span class="flex-1 truncate font-mono text-sm text-gray-700">{eventId}</span>
				<button
					onclick={() => copyText(eventId, 'id')}
					class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
				>
					{copiedId ? 'Copied!' : 'Copy'}
				</button>
			</div>

			<div class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
				<span class="text-xs font-medium text-gray-400">Link</span>
				<span class="flex-1 truncate text-sm text-gray-700">{uploadLink}</span>
				<button
					onclick={() => copyText(uploadLink, 'link')}
					class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
				>
					{copiedLink ? 'Copied!' : 'Copy'}
				</button>
				<button
					onclick={shareLink}
					class="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark"
				>
					Share
				</button>
			</div>

			<SocialShare url={uploadLink} text={`Upload photos to ${displayName}!`} />
		</div>

		<div class="mx-auto mb-8 max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
			<h2 class="mb-4 text-center text-lg font-semibold text-gray-700">Scan to view gallery</h2>
			<QRCode url={galleryLink} />
		</div>

		<div class="mx-auto mb-8 max-w-lg space-y-4">
			{#if expired}
				<div class="rounded-xl bg-gray-50 p-4 text-center">
					<p class="font-medium text-gray-600">Uploads have closed for this event.</p>
				</div>
			{:else if !done}
				<p class="text-center text-sm text-gray-500">
					You can upload up to {maxPhotos} photos ({maxPhotos - uploadedCount} remaining)
				</p>
				{#if uploadDeadline}
					<p class="text-center text-xs text-gray-400">
						Deadline: {new Date(uploadDeadline).toLocaleString()}
					</p>
				{/if}
				<CameraCapture onFiles={handleFiles} disabled={!canAddMore || isUploading} />
			{:else}
				<div class="rounded-xl bg-green-50 p-4 text-center">
					<p class="font-medium text-green-700">You've uploaded all {maxPhotos} photos. Thank you!</p>
				</div>
			{/if}

			<PhotoPreview files={selectedFiles} onRemove={removeFile} />

			<UploadProgress current={uploadCurrent} total={uploadTotal} status={uploadStatus} filePercent={filePercent} />

			{#if uploadError}
				<p class="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{uploadError}</p>
			{/if}

			{#if selectedFiles.length > 0 && !isUploading}
				<button
					onclick={upload}
					class="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
				>
					Upload {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''}
				</button>
			{/if}
		</div>
	{/if}

	{#if photos.length > 0 && !notFound}
		<div>
			<h2 class="mb-4 text-lg font-semibold text-gray-700">
				Photos ({photos.length})
			</h2>
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
			<PhotoGallery {photos} />
		</div>
	{/if}
</div>
