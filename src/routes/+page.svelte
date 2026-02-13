<script lang="ts">
	import { enhance } from '$app/forms';
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

	<div class="flex flex-col items-center gap-4">
		<form method="POST" action="?/create" use:enhance class="flex w-full max-w-sm flex-col gap-3">
			<input
				type="text"
				name="eventName"
				placeholder="Event name (e.g. Sarah's Birthday)"
				required
				class="rounded-xl border border-gray-300 px-4 py-3 text-center text-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
			/>
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
</div>
