# Downloads, Real-Time Updates & Event Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add photo downloads (individual + ZIP), replace polling with SSE for real-time gallery updates, and build a host dashboard with photo moderation.

**Architecture:** Secret hostKey stored in R2 meta.json authenticates hosts. SSE endpoint streams photo list changes. New manage route provides dashboard with delete capability. ZIP download streams from R2 through server.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Cloudflare R2, SSE (EventSource API), JSZip for ZIP generation, Vercel serverless adapter.

---

### Task 1: Add hostKey to EventMeta and event creation

**Files:**
- Modify: `src/lib/server/r2.ts` (EventMeta interface, line 16-21)
- Modify: `src/routes/create-event/+page.server.ts` (form action, line 14-37)

**Step 1: Update EventMeta interface in r2.ts**

In `src/lib/server/r2.ts`, update the interface:

```typescript
export interface EventMeta {
	name: string;
	maxPhotos: number;
	uploadDeadline: string;
	bannerUrl?: string;
	hostKey: string;
}
```

**Step 2: Generate hostKey in create-event action**

In `src/routes/create-event/+page.server.ts`, add a 20-char nanoid for hostKey and return it alongside eventId:

```typescript
const eventId = nanoid(10);
const hostKey = nanoid(20);
await saveEventMeta(eventId, { name: eventName, maxPhotos, uploadDeadline, hostKey });
return { eventId, hostKey };
```

**Step 3: Update create-event page redirect**

In `src/routes/create-event/+page.svelte`, change the redirect from `goto(\`/event/${eventId}\`)` to `goto(\`/event/${eventId}/created?key=${hostKey}\`)` where `hostKey` comes from `result.data.hostKey`:

```typescript
return async ({ result }) => {
    if (result.type === 'success' && result.data?.eventId) {
        const eventId = result.data.eventId as string;
        const hostKey = result.data.hostKey as string;
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
        await goto(`/event/${eventId}/created?key=${hostKey}`);
    } else {
        creating = false;
    }
};
```

**Step 4: Verify**

Run `pnpm check` to confirm no type errors.

**Step 5: Commit**

```bash
git add src/lib/server/r2.ts src/routes/create-event/+page.server.ts src/routes/create-event/+page.svelte
git commit -m "feat: add hostKey to EventMeta and event creation"
```

---

### Task 2: Host key localStorage utility

**Files:**
- Create: `src/lib/utils/host-keys.ts`

**Step 1: Create the utility**

```typescript
const STORAGE_KEY = 'keepsly_host_keys';

function getAll(): Record<string, string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

export function saveHostKey(eventId: string, hostKey: string): void {
	const keys = getAll();
	keys[eventId] = hostKey;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getHostKey(eventId: string): string | null {
	return getAll()[eventId] ?? null;
}
```

**Step 2: Commit**

```bash
git add src/lib/utils/host-keys.ts
git commit -m "feat: add host key localStorage utility"
```

---

### Task 3: Secret key reveal page (created route)

**Files:**
- Create: `src/routes/event/[eventId]/created/+page.svelte`

**Step 1: Create the page**

This page reads `?key` from the URL, displays the host key prominently, stores it in localStorage, and provides a continue button.

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { saveHostKey } from '$lib/utils/host-keys';
	import SEO from '$lib/components/SEO.svelte';

	const eventId = $page.params.eventId;
	const hostKey = $page.url.searchParams.get('key') ?? '';

	let copied = $state(false);

	const manageUrl = $derived(
		`${$page.url.origin}/event/${eventId}/manage?key=${hostKey}`
	);

	$effect(() => {
		if (hostKey) {
			saveHostKey(eventId, hostKey);
		}
	});

	async function copyKey() {
		await navigator.clipboard.writeText(hostKey);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	let copiedLink = $state(false);
	async function copyManageLink() {
		await navigator.clipboard.writeText(manageUrl);
		copiedLink = true;
		setTimeout(() => (copiedLink = false), 2000);
	}

	function proceed() {
		goto(`/event/${eventId}`);
	}
</script>

<SEO title="Event Created — Keepsly" description="Your event has been created. Save your host key." />

<div class="mx-auto max-w-lg px-4 py-12">
	<div class="mb-8 text-center">
		<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
			<svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>
		<h1 class="mb-2 text-3xl font-bold text-gray-900">Event Created!</h1>
		<p class="text-gray-500">Save your host key to manage this event later</p>
	</div>

	<div class="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
		<div class="mb-3 flex items-center gap-2 text-amber-800">
			<svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
			</svg>
			<span class="text-sm font-semibold">This will only be shown once</span>
		</div>

		<p class="mb-4 text-sm text-amber-700">
			This is your secret key to manage your event. Copy it and save it somewhere safe. You will not be able to see it again.
		</p>

		<div class="mb-4 flex items-center gap-2 rounded-xl bg-white p-3 ring-1 ring-amber-200">
			<code class="flex-1 break-all text-center text-lg font-bold tracking-wider text-gray-900">{hostKey}</code>
			<button
				onclick={copyKey}
				class="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
			>
				{copied ? 'Copied!' : 'Copy Key'}
			</button>
		</div>

		<button
			onclick={copyManageLink}
			class="w-full rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200"
		>
			{copiedLink ? 'Link Copied!' : 'Copy Manage Link'}
		</button>
	</div>

	<button
		onclick={proceed}
		class="w-full rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-primary-dark"
	>
		I've saved it — continue
	</button>
</div>
```

**Step 2: Verify**

Run `pnpm dev`, create an event, and confirm:
- Redirects to `/event/[eventId]/created?key=...`
- Host key is displayed in large monospace text
- Copy Key and Copy Manage Link buttons work
- "I've saved it" button navigates to `/event/[eventId]`

**Step 3: Commit**

```bash
git add src/routes/event/[eventId]/created/+page.svelte
git commit -m "feat: add one-time host key reveal page"
```

---

### Task 4: Add "Manage Event" button to event page

**Files:**
- Modify: `src/routes/event/[eventId]/+page.svelte`

**Step 1: Import host-keys utility and add manage button**

Add import at top of script:

```typescript
import { getHostKey } from '$lib/utils/host-keys';
```

Add state after existing state declarations:

```typescript
let hostKey = $state<string | null>(null);
let manageUrl = $derived(
    hostKey ? `${$page.url.origin}/event/${data.eventId}/manage?key=${hostKey}` : null
);
```

Inside the existing `$effect` (the one with `fetchPhotos` and the interval), add at the start:

```typescript
hostKey = getHostKey(data.eventId);
```

Add the manage button in the template, right after the `<h1>` and `<p>` in the header `mb-8 text-center` div, after the closing `</p>`:

```svelte
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
```

**Step 2: Verify**

Run `pnpm check`. In the browser, create an event, go through the created page, then confirm the "Manage Event" button appears on the event page.

**Step 3: Commit**

```bash
git add src/routes/event/[eventId]/+page.svelte
git commit -m "feat: show Manage Event button for hosts"
```

---

### Task 5: Add download button to PhotoGallery lightbox

**Files:**
- Modify: `src/lib/components/PhotoGallery.svelte`

**Step 1: Add download function and button**

Add a download function inside the script tag after the existing functions:

```typescript
let downloading = $state(false);

async function downloadPhoto() {
    if (!lightboxUrl || downloading) return;
    downloading = true;
    try {
        const res = await fetch(lightboxUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo-${(lightboxIndex ?? 0) + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch {
        // download failed silently
    } finally {
        downloading = false;
    }
}
```

Add the download button inside the lightbox overlay, right before the closing counter div (`<div class="absolute bottom-4 left-1/2 ...>`). Place it at `bottom-4 right-4`:

```svelte
<button
    onclick={(e) => { e.stopPropagation(); downloadPhoto(); }}
    disabled={downloading}
    aria-label="Download photo"
    class="absolute bottom-4 right-4 z-10 rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/40 disabled:opacity-50"
>
    {#if downloading}
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
    {:else}
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
    {/if}
</button>
```

**Step 2: Verify**

Run `pnpm check`. Open gallery, click a photo, confirm download button appears in bottom-right of lightbox and triggers a file save.

**Step 3: Commit**

```bash
git add src/lib/components/PhotoGallery.svelte
git commit -m "feat: add download button to photo lightbox"
```

---

### Task 6: Bulk ZIP download API endpoint

**Files:**
- Create: `src/routes/api/photos/[eventId]/download/+server.ts`
- Modify: `src/lib/server/r2.ts` (add `getPhotoBuffer` function)

**Step 1: Install jszip**

```bash
pnpm add jszip
```

**Step 2: Add getPhotoBuffer to r2.ts**

Add this function after `listEventPhotos` in `src/lib/server/r2.ts`:

```typescript
export async function getPhotoBuffer(eventId: string, photoKey: string): Promise<Uint8Array | null> {
	const client = getR2Client();
	try {
		const command = new GetObjectCommand({
			Bucket: env.R2_BUCKET_NAME,
			Key: photoKey
		});
		const response = await client.send(command);
		const bytes = await response.Body?.transformToByteArray();
		return bytes ?? null;
	} catch {
		return null;
	}
}
```

Also add a new function to list photo keys (not full URLs):

```typescript
export async function listEventPhotoKeys(eventId: string): Promise<string[]> {
	const client = getR2Client();
	const prefix = `events/${eventId}/`;

	const command = new ListObjectsV2Command({
		Bucket: env.R2_BUCKET_NAME,
		Prefix: prefix
	});

	const response = await client.send(command);

	if (!response.Contents) return [];

	return response.Contents
		.filter((obj) => obj.Key && obj.Key.endsWith('.jpg') && !obj.Key.endsWith('/banner.jpg'))
		.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
		.map((obj) => obj.Key!);
}
```

**Step 3: Create the download endpoint**

Create `src/routes/api/photos/[eventId]/download/+server.ts`:

```typescript
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventMeta, listEventPhotoKeys, getPhotoBuffer } from '$lib/server/r2';
import JSZip from 'jszip';

export const GET: RequestHandler = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const [meta, photoKeys] = await Promise.all([
		getEventMeta(eventId),
		listEventPhotoKeys(eventId)
	]);

	if (photoKeys.length === 0) {
		throw error(404, 'No photos found for this event');
	}

	const zip = new JSZip();
	const eventName = meta?.name ?? eventId;

	for (let i = 0; i < photoKeys.length; i++) {
		const buffer = await getPhotoBuffer(eventId, photoKeys[i]);
		if (buffer) {
			zip.file(`photo-${i + 1}.jpg`, buffer);
		}
	}

	const zipBuffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

	const safeName = eventName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || eventId;

	return new Response(zipBuffer, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${safeName}-photos.zip"`
		}
	});
};
```

**Step 4: Verify**

Run `pnpm check`. Test by visiting `/api/photos/[eventId]/download` for an event with photos — should trigger a ZIP download.

**Step 5: Commit**

```bash
git add src/lib/server/r2.ts src/routes/api/photos/[eventId]/download/+server.ts package.json pnpm-lock.yaml
git commit -m "feat: add bulk ZIP download API endpoint"
```

---

### Task 7: Add "Download All" button to gallery and event pages

**Files:**
- Modify: `src/routes/event/[eventId]/+page.svelte`
- Modify: `src/routes/gallery/+page.svelte`

**Step 1: Add download all button to event page**

In `src/routes/event/[eventId]/+page.svelte`, add state:

```typescript
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
```

Add the button right before the `<PhotoGallery>` component, inside the photos section:

```svelte
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
```

**Step 2: Add the same to gallery page**

In `src/routes/gallery/+page.svelte`, add the same `downloadingZip` state and `downloadAll` function (using `eventId` instead of `data.eventId`). Add the same button before `<PhotoGallery {photos} />` in the photos section at the bottom.

**Step 3: Verify**

Run `pnpm check`. Test both pages — button should appear when photos exist and trigger ZIP download.

**Step 4: Commit**

```bash
git add src/routes/event/[eventId]/+page.svelte src/routes/gallery/+page.svelte
git commit -m "feat: add Download All button to gallery and event pages"
```

---

### Task 8: SSE stream API endpoint

**Files:**
- Create: `src/routes/api/photos/[eventId]/stream/+server.ts`

**Step 1: Create SSE endpoint**

```typescript
import type { RequestHandler } from './$types';
import { listEventPhotos } from '$lib/server/r2';

export const GET: RequestHandler = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		return new Response('Invalid event ID', { status: 400 });
	}

	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let lastPhotos = '';
			let iterations = 0;
			const maxIterations = 60; // ~5 minutes at 5s intervals

			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			// Send retry interval
			controller.enqueue(encoder.encode('retry: 5000\n\n'));

			while (iterations < maxIterations) {
				try {
					const photos = await listEventPhotos(eventId);
					const photosJson = JSON.stringify(photos);

					if (photosJson !== lastPhotos) {
						lastPhotos = photosJson;
						send('photos', { photos, count: photos.length });
					}
				} catch {
					// R2 error, skip this tick
				}

				iterations++;
				await new Promise((resolve) => setTimeout(resolve, 5000));
			}

			// Close after max iterations; client will reconnect
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
```

**Step 2: Verify**

Run `pnpm check`. Test with `curl -N http://localhost:5173/api/photos/[eventId]/stream` — should see SSE events.

**Step 3: Commit**

```bash
git add src/routes/api/photos/[eventId]/stream/+server.ts
git commit -m "feat: add SSE stream endpoint for real-time photo updates"
```

---

### Task 9: Client-side SSE utility and integrate into pages

**Files:**
- Create: `src/lib/utils/photo-stream.ts`
- Modify: `src/routes/event/[eventId]/+page.svelte`
- Modify: `src/routes/gallery/+page.svelte`

**Step 1: Create photo-stream utility**

```typescript
export interface PhotoStreamCallbacks {
	onPhotos: (photos: string[], count: number) => void;
}

export function connectPhotoStream(
	eventId: string,
	callbacks: PhotoStreamCallbacks
): () => void {
	let eventSource: EventSource | null = null;
	let failCount = 0;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let destroyed = false;

	function startSSE() {
		if (destroyed) return;

		eventSource = new EventSource(`/api/photos/${eventId}/stream`);

		eventSource.addEventListener('photos', (e) => {
			failCount = 0;
			try {
				const data = JSON.parse(e.data);
				callbacks.onPhotos(data.photos, data.count);
			} catch {
				// bad data
			}
		});

		eventSource.onerror = () => {
			failCount++;
			eventSource?.close();
			eventSource = null;

			if (failCount >= 3) {
				// Fall back to polling
				startPolling();
			}
			// Otherwise EventSource reconnects automatically via retry
		};
	}

	async function poll() {
		try {
			const res = await fetch(`/api/photos/${eventId}`);
			if (res.ok) {
				const data = await res.json();
				callbacks.onPhotos(data.photos, data.photos.length);
			}
		} catch {
			// silent
		}
	}

	function startPolling() {
		if (destroyed || pollInterval) return;
		poll();
		pollInterval = setInterval(poll, 5000);
	}

	startSSE();

	return () => {
		destroyed = true;
		eventSource?.close();
		if (pollInterval) clearInterval(pollInterval);
	};
}
```

**Step 2: Replace polling in event page**

In `src/routes/event/[eventId]/+page.svelte`, replace the `fetchPhotos` function and the `$effect` that polls:

Remove the `fetchPhotos` function entirely.

Replace the `$effect` block:

```typescript
$effect(() => {
    hostKey = getHostKey(data.eventId);
    const disconnect = connectPhotoStream(data.eventId, {
        onPhotos: (p) => { photos = p; }
    });
    return disconnect;
});
```

Add the import:

```typescript
import { connectPhotoStream } from '$lib/utils/photo-stream';
```

**Step 3: Replace polling in gallery page**

In `src/routes/gallery/+page.svelte`, this is trickier because the eventId can change. Replace the existing `$effect` block at the bottom of the script. The gallery page also fetches event metadata, so keep the initial `fetchPhotos` call but replace the polling with SSE after load:

Keep the `fetchPhotos` function but remove the interval from it. Instead, after `fetchPhotos` succeeds and sets `eventLoaded = true`, connect SSE.

Replace the `$effect` at the bottom:

```typescript
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
                    onPhotos: (p) => { photos = p; }
                });
            }
        });
    }

    return () => {
        disconnectStream?.();
    };
});
```

Add the import:

```typescript
import { connectPhotoStream } from '$lib/utils/photo-stream';
```

**Step 4: Verify**

Run `pnpm check`. Open the event page — confirm photos appear and update in real-time when a new photo is uploaded from another tab.

**Step 5: Commit**

```bash
git add src/lib/utils/photo-stream.ts src/routes/event/[eventId]/+page.svelte src/routes/gallery/+page.svelte
git commit -m "feat: replace polling with SSE for real-time gallery updates"
```

---

### Task 10: Photo deletion — server function and API endpoint

**Files:**
- Modify: `src/lib/server/r2.ts` (add `deletePhoto`)
- Create: `src/routes/api/photos/[eventId]/[photoId]/+server.ts`

**Step 1: Add deletePhoto to r2.ts**

Add import for `DeleteObjectCommand` at the top of `src/lib/server/r2.ts`:

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
```

Add the function after `getPhotoBuffer`:

```typescript
export async function deletePhoto(eventId: string, photoId: string): Promise<void> {
	const client = getR2Client();
	const command = new DeleteObjectCommand({
		Bucket: env.R2_BUCKET_NAME,
		Key: `events/${eventId}/${photoId}.jpg`
	});
	await client.send(command);
}
```

**Step 2: Create DELETE endpoint**

Create `src/routes/api/photos/[eventId]/[photoId]/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventMeta, deletePhoto } from '$lib/server/r2';

export const DELETE: RequestHandler = async ({ params, url }) => {
	const { eventId, photoId } = params;
	const key = url.searchParams.get('key');

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	if (!photoId) {
		throw error(400, 'Invalid photo ID');
	}

	if (!key) {
		throw error(401, 'Host key required');
	}

	const meta = await getEventMeta(eventId);
	if (!meta || meta.hostKey !== key) {
		throw error(403, 'Invalid host key');
	}

	try {
		await deletePhoto(eventId, photoId);
		return json({ success: true });
	} catch (err) {
		console.error('DELETE /api/photos error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to delete photo');
	}
};
```

**Step 3: Verify**

Run `pnpm check`.

**Step 4: Commit**

```bash
git add src/lib/server/r2.ts src/routes/api/photos/[eventId]/[photoId]/+server.ts
git commit -m "feat: add photo deletion API endpoint with host key auth"
```

---

### Task 11: Event dashboard (manage page)

**Files:**
- Create: `src/routes/event/[eventId]/manage/+page.server.ts`
- Create: `src/routes/event/[eventId]/manage/+page.svelte`

**Step 1: Create server load function**

Create `src/routes/event/[eventId]/manage/+page.server.ts`:

```typescript
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEventMeta, listEventPhotos } from '$lib/server/r2';

export const load: PageServerLoad = async ({ params, url }) => {
	const { eventId } = params;
	const key = url.searchParams.get('key');

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	if (!key) {
		throw error(403, 'Host key required');
	}

	const meta = await getEventMeta(eventId);
	if (!meta || meta.hostKey !== key) {
		throw error(403, 'Invalid host key');
	}

	const photos = await listEventPhotos(eventId);

	return {
		eventId,
		hostKey: key,
		eventName: meta.name,
		maxPhotos: meta.maxPhotos,
		uploadDeadline: meta.uploadDeadline,
		bannerUrl: meta.bannerUrl ?? null,
		initialPhotos: photos
	};
};
```

**Step 2: Create the manage page**

Create `src/routes/event/[eventId]/manage/+page.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import PhotoGallery from '$lib/components/PhotoGallery.svelte';
	import QRCode from '$lib/components/QRCode.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import SocialShare from '$lib/components/SocialShare.svelte';
	import { connectPhotoStream } from '$lib/utils/photo-stream';

	let { data } = $props();

	let photos = $state<string[]>(data.initialPhotos);
	let uploadUrl = $derived(`${$page.url.origin}/upload/${data.eventId}`);
	let galleryUrl = $derived(`${$page.url.origin}/gallery?event=${data.eventId}`);

	let expired = $derived(new Date() > new Date(data.uploadDeadline));
	let timeRemaining = $state('');

	let copiedUpload = $state(false);
	let copiedGallery = $state(false);
	let downloadingZip = $state(false);

	// Photo deletion
	let deleteTarget = $state<string | null>(null);
	let deleting = $state(false);

	function updateTimeRemaining() {
		const deadline = new Date(data.uploadDeadline);
		const now = new Date();
		const diff = deadline.getTime() - now.getTime();
		if (diff <= 0) {
			timeRemaining = 'Expired';
			return;
		}
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		if (days > 0) {
			timeRemaining = `${days}d ${hours}h remaining`;
		} else {
			const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
			timeRemaining = `${hours}h ${minutes}m remaining`;
		}
	}

	async function copyText(text: string, type: 'upload' | 'gallery') {
		await navigator.clipboard.writeText(text);
		if (type === 'upload') {
			copiedUpload = true;
			setTimeout(() => (copiedUpload = false), 2000);
		} else {
			copiedGallery = true;
			setTimeout(() => (copiedGallery = false), 2000);
		}
	}

	async function downloadAll() {
		downloadingZip = true;
		try {
			const res = await fetch(`/api/photos/${data.eventId}/download`);
			if (!res.ok) throw new Error('Download failed');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${data.eventName}-photos.zip`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch {
			// silent
		} finally {
			downloadingZip = false;
		}
	}

	function getPhotoId(photoUrl: string): string {
		// URL format: https://pub-xxx.r2.dev/events/{eventId}/{photoId}.jpg
		const parts = photoUrl.split('/');
		const filename = parts[parts.length - 1];
		return filename.replace('.jpg', '');
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		const photoId = getPhotoId(deleteTarget);
		try {
			const res = await fetch(
				`/api/photos/${data.eventId}/${photoId}?key=${data.hostKey}`,
				{ method: 'DELETE' }
			);
			if (res.ok) {
				photos = photos.filter((p) => p !== deleteTarget);
			}
		} catch {
			// silent
		} finally {
			deleting = false;
			deleteTarget = null;
		}
	}

	$effect(() => {
		updateTimeRemaining();
		const timer = setInterval(updateTimeRemaining, 60000);
		const disconnect = connectPhotoStream(data.eventId, {
			onPhotos: (p) => { photos = p; }
		});
		return () => {
			clearInterval(timer);
			disconnect();
		};
	});
</script>

<SEO
	title={`Manage ${data.eventName} — Keepsly`}
	description={`Host dashboard for ${data.eventName}`}
/>

<div class="mx-auto max-w-4xl px-4 py-8">
	<a
		href="/event/{data.eventId}"
		class="mb-6 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
	>
		<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Event
	</a>

	<!-- Header -->
	<div class="mb-8 text-center">
		<h1 class="mb-2 text-3xl font-bold text-gray-900">{data.eventName}</h1>
		<p class="text-gray-500">Host Dashboard</p>
	</div>

	{#if data.bannerUrl}
		<div class="mb-8 overflow-hidden rounded-2xl shadow-sm ring-1 ring-gray-100">
			<img src={data.bannerUrl} alt="{data.eventName} banner" class="h-48 w-full object-cover" />
		</div>
	{/if}

	<!-- Stats Cards -->
	<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
		<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
			<p class="text-sm text-gray-500">Total Photos</p>
			<p class="text-3xl font-bold text-gray-900">{photos.length}</p>
			<p class="text-xs text-gray-400">of {data.maxPhotos} max per guest</p>
		</div>
		<div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
			<p class="text-sm text-gray-500">Upload Deadline</p>
			<p class="text-lg font-bold {expired ? 'text-red-600' : 'text-gray-900'}">{timeRemaining}</p>
			<p class="text-xs text-gray-400">{new Date(data.uploadDeadline).toLocaleDateString()}</p>
		</div>
		<div class="col-span-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:col-span-1">
			<p class="text-sm text-gray-500">Status</p>
			<p class="text-lg font-bold {expired ? 'text-red-600' : 'text-green-600'}">
				{expired ? 'Closed' : 'Active'}
			</p>
			<p class="text-xs text-gray-400">{expired ? 'Uploads closed' : 'Accepting uploads'}</p>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="mb-8 space-y-3">
		<h2 class="text-lg font-semibold text-gray-700">Share & Download</h2>

		<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
			<h3 class="mb-4 text-center text-sm font-medium text-gray-500">Scan to upload photos</h3>
			<QRCode url={uploadUrl} />
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
		</div>

		<SocialShare url={uploadUrl} text={`Upload photos to ${data.eventName}!`} />

		<div class="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
			<span class="text-xs font-medium text-gray-400">Gallery</span>
			<span class="flex-1 truncate text-sm text-gray-700">{galleryUrl}</span>
			<button
				onclick={() => copyText(galleryUrl, 'gallery')}
				class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100"
			>
				{copiedGallery ? 'Copied!' : 'Copy'}
			</button>
		</div>

		{#if photos.length > 0}
			<button
				onclick={downloadAll}
				disabled={downloadingZip}
				class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
			>
				{#if downloadingZip}
					<span class="inline-flex items-center gap-2">
						<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
						Preparing ZIP...
					</span>
				{:else}
					<span class="inline-flex items-center gap-2">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
						</svg>
						Download All Photos ({photos.length})
					</span>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Photo Grid with Moderation -->
	<div>
		<h2 class="mb-4 text-lg font-semibold text-gray-700">
			Photos ({photos.length})
		</h2>

		{#if photos.length === 0}
			<p class="py-12 text-center text-gray-400">No photos yet. Waiting for uploads...</p>
		{:else}
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
				{#each photos as photo}
					<div class="group relative aspect-square overflow-hidden rounded-lg">
						<div class="absolute inset-0 animate-pulse bg-gray-200"></div>
						<img
							src={photo}
							alt=""
							class="relative h-full w-full object-cover opacity-0 transition-opacity duration-300"
							loading="lazy"
							onload={(e) => { (e.currentTarget as HTMLImageElement).classList.remove('opacity-0'); }}
						/>
						<button
							onclick={() => { deleteTarget = photo; }}
							aria-label="Delete photo"
							class="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition-all hover:bg-red-600 group-hover:opacity-100"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Delete Confirmation Modal -->
{#if deleteTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={() => { if (!deleting) deleteTarget = null; }}
		onkeydown={() => {}}
	>
		<div
			class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
		>
			<h3 class="mb-2 text-lg font-semibold text-gray-900">Delete photo?</h3>
			<p class="mb-6 text-sm text-gray-500">This action cannot be undone. The photo will be permanently removed.</p>
			<div class="flex gap-3">
				<button
					onclick={() => { deleteTarget = null; }}
					disabled={deleting}
					class="flex-1 rounded-xl border border-gray-300 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					onclick={confirmDelete}
					disabled={deleting}
					class="flex-1 rounded-xl bg-red-600 py-2.5 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
				>
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
```

**Step 3: Verify**

Run `pnpm check`. Test the full flow:
1. Create event -> see host key reveal
2. Go to manage page via the manage link
3. Confirm stats display correctly
4. Confirm QR code and share links work
5. Upload a photo from another tab -> confirm it appears in real-time
6. Delete a photo -> confirm it's removed

**Step 4: Commit**

```bash
git add src/routes/event/[eventId]/manage/
git commit -m "feat: add host event dashboard with stats and photo moderation"
```

---

### Task 12: Final type check and cleanup

**Step 1: Run full type check**

```bash
pnpm check
```

Fix any type errors.

**Step 2: Manual smoke test**

1. Create event -> secret key reveal page appears
2. Copy host key, click continue
3. Manage Event button visible on event page
4. Upload photos from `/upload/[eventId]`
5. Photos appear in real-time on event page (SSE, no polling)
6. Open gallery, photos load via SSE
7. Click photo in lightbox -> download button works
8. Click "Download All" -> ZIP downloads
9. Open manage dashboard -> stats, QR, share links visible
10. Delete a photo from dashboard -> removed from grid

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: type fixes and cleanup"
```
