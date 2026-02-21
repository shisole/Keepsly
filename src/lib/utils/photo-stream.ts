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
