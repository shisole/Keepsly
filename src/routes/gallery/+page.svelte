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

	let eventIdInput = $state('');
	let eventId = $state($page.url.searchParams.get('event') ?? '');
	let eventName = $state<string | null>(null);
	let photos = $state<string[]>([]);
	let loading = $state(false);
	let initialLoad = $state(true);
	let notFound = $state(false);
	let errorMessage = $state('');

	// Upload state
	const MAX_PHOTOS = 5;
	let selectedFiles = $state<File[]>([]);
	let uploadedCount = $state(0);
	let isUploading = $state(false);
	let uploadCurrent = $state(0);
	let uploadTotal = $state(0);
	let uploadStatus = $state('');
	let filePercent = $state(0);
	let uploadError = $state('');
	let done = $state(false);

	let remaining = $derived(MAX_PHOTOS - uploadedCount - selectedFiles.length);
	let canAddMore = $derived(remaining > 0 && !isUploading && !done);
	let copiedId = $state(false);
	let copiedLink = $state(false);

	let displayName = $derived(eventName ?? (eventId ? `Event ${eventId}` : 'Gallery'));
	let uploadLink = $derived(eventId ? `${$page.url.origin}/upload/${eventId}` : '');
	let galleryLink = $derived(eventId ? `${$page.url.origin}/gallery?event=${eventId}` : '');

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

	async function fetchPhotos(id: string) {
		if (initialLoad) loading = true;
		errorMessage = '';
		notFound = false;
		try {
			const res = await fetch(`/api/photos/${id}`);
			if (!res.ok) throw new Error('Event not found');
			const data = await res.json();
			photos = data.photos;
			eventName = data.eventName ?? null;
			if (!eventName && photos.length === 0) {
				notFound = true;
			}
		} catch {
			photos = [];
			eventName = null;
			notFound = true;
		} finally {
			loading = false;
			initialLoad = false;
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = eventIdInput.trim();
		if (trimmed.length < 5) return;
		eventId = trimmed;
		eventName = null;
		notFound = false;
		initialLoad = true;
		const url = new URL($page.url);
		url.searchParams.set('event', trimmed);
		history.replaceState({}, '', url);
		fetchPhotos(trimmed);
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
			done = uploadedCount >= MAX_PHOTOS;
			fetchPhotos(eventId);
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
			uploadStatus = '';
		} finally {
			isUploading = false;
		}
	}

	$effect(() => {
		if (eventId) {
			eventIdInput = eventId;
			uploadedCount = getUploadedCount(eventId);
			done = uploadedCount >= MAX_PHOTOS;
			fetchPhotos(eventId);
		}
	});
</script>

<svelte:head>
	<title>{eventId ? `${displayName} - Gallery` : 'Gallery'} - Keepsly</title>
	<meta name="description" content="View photos from {eventId ? displayName : 'a Keepsly event'}." />
	<meta property="og:title" content="{eventId ? `${displayName} - Gallery` : 'Photo Gallery'} - Keepsly" />
	<meta property="og:description" content="View photos from {eventId ? displayName : 'a Keepsly event'}." />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="{eventId ? `${displayName} - Gallery` : 'Photo Gallery'} - Keepsly" />
	<meta name="twitter:description" content="View photos from {eventId ? displayName : 'a Keepsly event'}." />
</svelte:head>

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
		<p class="text-gray-500">{eventId ? 'View and upload photos' : 'Enter your event ID to view and upload photos'}</p>
	</div>

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
			class="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
		>
			{loading ? 'Loading...' : 'View'}
		</button>
	</form>

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

	{#if eventId && !loading && !notFound}
		<div class="mx-auto mb-8 max-w-lg space-y-3">
			<div class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
				<span class="text-xs font-medium text-gray-400">ID</span>
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
		</div>

		<div class="mx-auto mb-8 max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
			<h2 class="mb-4 text-center text-lg font-semibold text-gray-700">Scan to view gallery</h2>
			<QRCode url={galleryLink} />
		</div>

		<div class="mx-auto mb-8 max-w-lg space-y-4">
			{#if !done}
				<p class="text-center text-sm text-gray-500">
					You can upload up to {MAX_PHOTOS} photos ({MAX_PHOTOS - uploadedCount} remaining)
				</p>
				<CameraCapture onFiles={handleFiles} disabled={!canAddMore || isUploading} />
			{:else}
				<div class="rounded-xl bg-green-50 p-4 text-center">
					<p class="font-medium text-green-700">You've uploaded all {MAX_PHOTOS} photos. Thank you!</p>
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
			<PhotoGallery {photos} />
		</div>
	{/if}
</div>
