<script lang="ts">
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import { page } from '$app/stores';

	let eventIdInput = $state('');
	let eventId = $state($page.url.searchParams.get('event') ?? '');
	let photos = $state<string[]>([]);
	let loading = $state(false);
	let errorMessage = $state('');

	async function fetchPhotos(id: string) {
		loading = true;
		errorMessage = '';
		try {
			const res = await fetch(`/api/photos/${id}`);
			if (!res.ok) throw new Error('Event not found');
			const data = await res.json();
			photos = data.photos;
			if (photos.length === 0) {
				errorMessage = 'No photos found for this event.';
			}
		} catch {
			photos = [];
			errorMessage = 'Could not load photos. Check the event ID and try again.';
		} finally {
			loading = false;
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = eventIdInput.trim();
		if (trimmed.length < 5) return;
		eventId = trimmed;
		const url = new URL($page.url);
		url.searchParams.set('event', trimmed);
		history.replaceState({}, '', url);
		fetchPhotos(trimmed);
	}

	$effect(() => {
		if (eventId) {
			eventIdInput = eventId;
			fetchPhotos(eventId);
		}
	});
</script>

<svelte:head>
	<title>Gallery - Photoshoot</title>
	<meta name="description" content="View photos from a Photoshoot event." />
	<meta property="og:title" content="Photo Gallery - Photoshoot" />
	<meta property="og:description" content="View photos from a Photoshoot event." />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Photo Gallery - Photoshoot" />
	<meta name="twitter:description" content="View photos from a Photoshoot event." />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Gallery</h1>
		<p class="text-gray-500">Enter your event ID to view photos</p>
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

	{#if errorMessage && !loading}
		<p class="mb-6 text-center text-gray-400">{errorMessage}</p>
	{/if}

	{#if photos.length > 0}
		<div>
			<h2 class="mb-4 text-lg font-semibold text-gray-700">
				Photos ({photos.length})
			</h2>
			<PhotoGallery {photos} />
		</div>
	{/if}
</div>
