import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadPhoto, listEventPhotos } from '$lib/server/r2';
import { nanoid } from 'nanoid';

export const GET: RequestHandler = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const photos = await listEventPhotos(eventId);
	return json({ photos });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const body = await request.arrayBuffer();
	if (body.byteLength === 0) {
		throw error(400, 'No file provided');
	}

	const photoId = nanoid(10);
	await uploadPhoto(eventId, photoId, body);

	return json({ photoId });
};
