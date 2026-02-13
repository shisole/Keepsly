<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import QRCode from '$lib/components/QRCode.svelte';
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';

	let { form } = $props();

	let eventId = $derived(form?.eventId as string | undefined);
	let uploadUrl = $derived(
		eventId ? `${$page.url.origin}/upload/${eventId}` : ''
	);

	let photos = $state<string[]>([]);
	let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

	async function fetchPhotos(id: string) {
		try {
			const res = await fetch(`/api/photos/${id}`);
			if (res.ok) {
				const data = await res.json();
				photos = data.photos;
			}
		} catch {
			// silently retry on next poll
		}
	}

	$effect(() => {
		if (eventId) {
			fetchPhotos(eventId);
			const interval = setInterval(() => fetchPhotos(eventId!), 5000);
			pollInterval = interval;
			return () => clearInterval(interval);
		}
	});
</script>

<svelte:head>
	<title>Photoshoot</title>
	<meta name="description" content="Create a photo event and let guests share photos via QR code." />
	<meta property="og:title" content="Photoshoot" />
	<meta property="og:description" content="Create a photo event and let guests share photos via QR code." />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Photoshoot" />
	<meta name="twitter:description" content="Create a photo event and let guests share photos via QR code." />
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Photoshoot</h1>
		<p class="text-gray-500">Create an event and share the QR code with your guests</p>
	</div>

	{#if !eventId}
		<div class="flex flex-col items-center gap-4">
			<form method="POST" action="?/create" use:enhance>
				<button
					type="submit"
					class="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
				>
					Create Event
				</button>
			</form>
			<a
				href="/gallery"
				class="text-sm font-medium text-primary hover:text-primary-dark"
			>
				View an existing event's gallery
			</a>
		</div>
	{:else}
		<div class="space-y-8">
			<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
				<h2 class="mb-4 text-center text-lg font-semibold text-gray-700">
					Scan to upload photos
				</h2>
				<QRCode url={uploadUrl} />
			</div>

			<div>
				<h2 class="mb-4 text-lg font-semibold text-gray-700">
					Photos ({photos.length})
				</h2>
				<PhotoGallery {photos} />
			</div>
		</div>
	{/if}
</div>
