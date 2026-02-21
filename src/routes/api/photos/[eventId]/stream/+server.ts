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
