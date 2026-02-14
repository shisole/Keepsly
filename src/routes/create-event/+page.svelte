<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { compressImage } from '$lib/utils/compress';
	import SEO from '$lib/components/SEO.svelte';

	let creating = $state(false);
	let bannerFile = $state<File | null>(null);
	let bannerPreview = $state<string | null>(null);

	function handleBannerChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		bannerFile = file;
		bannerPreview = URL.createObjectURL(file);
	}

	function removeBanner() {
		if (bannerPreview) URL.revokeObjectURL(bannerPreview);
		bannerFile = null;
		bannerPreview = null;
	}
</script>

<SEO
	title="Create Event — Keepsly"
	description="Create a new event and let guests share photos via QR code."
/>

<div class="mx-auto max-w-4xl px-4 py-8">
	<a href="/" class="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark">
		<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
		Back
	</a>

	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Create Event</h1>
		<p class="text-gray-500">Set up your event and share the QR code with your guests</p>
	</div>

	<form method="POST" action="?/create" use:enhance={() => {
		creating = true;
		return async ({ result }) => {
			if (result.type === 'success' && result.data?.eventId) {
				const eventId = result.data.eventId as string;
				if (bannerFile) {
					try {
						const compressed = await compressImage(bannerFile);
						const body = await compressed.arrayBuffer();
						await fetch(`/api/banner/${eventId}`, {
							method: 'POST',
							headers: { 'Content-Type': 'image/jpeg' },
							body
						});
					} catch {
						// Banner upload failed, continue anyway
					}
				}
				await goto(`/event/${eventId}`);
			} else {
				creating = false;
			}
		};
	}} class="mx-auto flex w-full max-w-sm flex-col gap-4">
		<div>
			<label for="eventName" class="mb-1 block text-xs font-medium text-gray-500">Event name <span class="text-red-500">*</span></label>
			<input
				type="text"
				id="eventName"
				name="eventName"
				placeholder="e.g. Sarah's Birthday"
				required
				disabled={creating}
				class="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
			/>
		</div>

		<div>
			<label for="maxPhotos" class="mb-1 block text-xs font-medium text-gray-500">Max photos per guest <span class="text-red-500">*</span></label>
			<input
				type="number"
				id="maxPhotos"
				name="maxPhotos"
				value="5"
				min="5"
				max="15"
				required
				disabled={creating}
				class="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
			/>
		</div>

		<div>
			<label for="duration" class="mb-1 block text-xs font-medium text-gray-500">Upload deadline <span class="text-red-500">*</span></label>
			<select
				id="duration"
				name="duration"
				required
				disabled={creating}
				class="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
			>
				<option value="" disabled selected>Select duration</option>
				<option value="1d">1 day</option>
				<option value="3d">3 days</option>
				<option value="7d">1 week</option>
			</select>
		</div>

		<div>
			<span class="mb-1 block text-xs font-medium text-gray-500">Hero banner (optional)</span>
			{#if bannerPreview}
				<div class="relative overflow-hidden rounded-xl border border-gray-200">
					<img src={bannerPreview} alt="Banner preview" class="h-40 w-full object-cover" />
					<button
						type="button"
						onclick={removeBanner}
						disabled={creating}
						aria-label="Remove banner"
						class="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70 disabled:opacity-50"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{:else}
				<label
					class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-gray-400 transition-colors hover:border-primary/40 hover:text-primary/60 {creating ? 'pointer-events-none opacity-50' : ''}"
				>
					<svg class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
					</svg>
					<span class="text-sm">Add a banner image</span>
					<input
						type="file"
						accept="image/*"
						onchange={handleBannerChange}
						disabled={creating}
						class="hidden"
					/>
				</label>
			{/if}
		</div>

		<button
			type="submit"
			disabled={creating}
			class="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if creating}
				<span class="inline-flex items-center gap-2">
					<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
					Creating...
				</span>
			{:else}
				Publish Event
			{/if}
		</button>
	</form>
</div>
