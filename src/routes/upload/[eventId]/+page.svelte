<script lang="ts">
	import CameraCapture from '$lib/components/CameraCapture.svelte';
	import PhotoPreview from '$lib/components/PhotoPreview.svelte';
	import UploadProgress from '$lib/components/UploadProgress.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { compressImage } from '$lib/utils/compress';
	import { uploadWithProgress } from '$lib/utils/upload';
	import { getUploadedCount, incrementUploadedCount } from '$lib/utils/upload-limit';

	let { data } = $props();
	const maxPhotos = data.maxPhotos;
	let expired = $derived(data.uploadDeadline ? new Date() > new Date(data.uploadDeadline) : false);

	let displayName = $derived(data.eventName ?? `Event ${data.eventId}`);

	let selectedFiles = $state<File[]>([]);
	let uploadedCount = $state(0);
	let isUploading = $state(false);
	let uploadCurrent = $state(0);
	let uploadTotal = $state(0);
	let uploadStatus = $state('');
	let filePercent = $state(0);
	let done = $state(false);
	let errorMessage = $state('');

	let remaining = $derived(maxPhotos - uploadedCount - selectedFiles.length);
	let canAddMore = $derived(remaining > 0 && !isUploading && !done && !expired);

	$effect(() => {
		uploadedCount = getUploadedCount(data.eventId);
		done = uploadedCount >= maxPhotos;
	});

	function handleFiles(files: File[]) {
		const imageFiles = files.filter((f) => f.type.startsWith('image/'));
		const toAdd = imageFiles.slice(0, remaining);
		selectedFiles = [...selectedFiles, ...toAdd];
	}

	function removeFile(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
	}

	async function upload() {
		if (selectedFiles.length === 0) return;

		isUploading = true;
		errorMessage = '';
		uploadTotal = selectedFiles.length;
		uploadCurrent = 0;

		try {
			for (const file of selectedFiles) {
				filePercent = 0;
				uploadStatus = `Compressing photo ${uploadCurrent + 1}...`;
				const compressed = await compressImage(file);

				uploadStatus = `Uploading photo ${uploadCurrent + 1}...`;
				await uploadWithProgress(
					`/api/photos/${data.eventId}`,
					compressed,
					(p) => (filePercent = p)
				);

				filePercent = 100;
				uploadCurrent++;
				incrementUploadedCount(data.eventId);
				uploadedCount = getUploadedCount(data.eventId);
			}

			selectedFiles = [];
			uploadStatus = 'All photos uploaded!';
			done = uploadedCount >= maxPhotos;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Upload failed';
			uploadStatus = '';
		} finally {
			isUploading = false;
		}
	}
</script>

<SEO
	title={`Upload Photos - ${displayName}`}
	description="Tap to take or upload photos for this event."
/>

<div class="mx-auto max-w-lg px-4 py-8">
	<div class="mb-6 text-center">
		<h1 class="mb-1 text-2xl font-bold text-gray-900">{displayName}</h1>
		<p class="text-sm text-gray-500">
			{#if expired}
				Uploads have closed for this event.
			{:else if done}
				You've uploaded all {maxPhotos} photos. Thank you!
			{:else}
				You can upload up to {maxPhotos} photos ({maxPhotos - uploadedCount} remaining)
			{/if}
		</p>
		{#if data.uploadDeadline && !expired}
			<p class="mt-1 text-xs text-gray-400">
				Deadline: {new Date(data.uploadDeadline).toLocaleString()}
			</p>
		{/if}
	</div>

	<div class="space-y-5">
		{#if !done && !expired}
			<CameraCapture onFiles={handleFiles} disabled={!canAddMore || isUploading} />
		{/if}

		<PhotoPreview files={selectedFiles} onRemove={removeFile} />

		<UploadProgress current={uploadCurrent} total={uploadTotal} status={uploadStatus} {filePercent} />

		{#if errorMessage}
			<p class="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{errorMessage}</p>
		{/if}

		{#if selectedFiles.length > 0 && !isUploading}
			<button
				onclick={upload}
				class="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
			>
				Upload {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''}
			</button>
		{/if}

		{#if expired}
			<div class="rounded-xl bg-gray-50 p-4 text-center">
				<p class="font-medium text-gray-600">Uploads have closed for this event.</p>
			</div>
		{:else if done}
			<div class="rounded-xl bg-green-50 p-4 text-center">
				<p class="font-medium text-green-700">All photos uploaded successfully!</p>
			</div>
		{/if}

		{#if isUploading}
			<span class="block text-center text-sm text-gray-400">View event gallery</span>
		{:else}
			<a
				href="/gallery?event={data.eventId}"
				class="block text-center text-sm font-medium text-primary hover:text-primary-dark"
			>
				View Event Gallery
			</a>
		{/if}
	</div>
</div>
