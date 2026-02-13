import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPresignedUploadUrl, listEventPhotos } from '$lib/server/r2';
import { nanoid } from 'nanoid';

export const GET: RequestHandler = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const photos = await listEventPhotos(eventId);
	return json({ photos });
};

export const POST: RequestHandler = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const photoId = nanoid(10);
	const uploadUrl = await getPresignedUploadUrl(eventId, photoId);

	return json({ uploadUrl, photoId });
};
