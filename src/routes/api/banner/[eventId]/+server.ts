import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadBanner, getEventMeta, saveEventMeta } from '$lib/server/r2';

export const POST: RequestHandler = async ({ params, request }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const meta = await getEventMeta(eventId);
	if (!meta) {
		throw error(404, 'Event not found');
	}

	const body = await request.arrayBuffer();
	if (body.byteLength === 0) {
		throw error(400, 'No file provided');
	}

	try {
		const bannerUrl = await uploadBanner(eventId, body);
		await saveEventMeta(eventId, { ...meta, bannerUrl });
		return json({ bannerUrl });
	} catch (err) {
		console.error('POST /api/banner error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to upload banner');
	}
};
