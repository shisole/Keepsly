<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';
</script>

<SEO
	title="Keepsly"
	description="A digital album — create an event and let guests share photos via QR code. Memories for keeps."
/>

<div class="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col items-center justify-center px-4">
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Keepsly</h1>
		<p class="text-gray-500">Memories for keeps — create an event and share the QR code with your guests</p>
	</div>

	<div class="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
		<a
			href="/create-event"
			class="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
		>
			Create Event
		</a>
		<span class="text-sm text-gray-400">or</span>
		<a
			href="/gallery"
			class="rounded-xl border border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 shadow-md transition-colors hover:bg-gray-50"
		>
			View a Gallery
		</a>
	</div>
</div>
