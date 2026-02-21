import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadPhoto, listEventPhotos, listEventPhotosPaginated, getEventMeta } from '$lib/server/r2';
import { nanoid } from 'nanoid';

export const GET: RequestHandler = async ({ params, url }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const limitParam = url.searchParams.get('limit');
	const cursor = url.searchParams.get('cursor') ?? undefined;
	const offsetParam = url.searchParams.get('offset');
	const pageParam = url.searchParams.get('page');

	try {
		const meta = await getEventMeta(eventId);
		const baseMeta = {
			eventName: meta?.name ?? null,
			maxPhotos: meta?.maxPhotos ?? 5,
			uploadDeadline: meta?.uploadDeadline ?? null,
			bannerUrl: meta?.bannerUrl ?? null
		};

		if (limitParam) {
			const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 20));

			// Resolve offset from cursor, offset, or page param (priority: cursor > offset > page)
			let resolvedCursor = cursor;
			if (!resolvedCursor && offsetParam) {
				resolvedCursor = String(Math.max(0, parseInt(offsetParam, 10) || 0));
			} else if (!resolvedCursor && pageParam) {
				const page = Math.max(1, parseInt(pageParam, 10) || 1);
				resolvedCursor = String((page - 1) * limit);
			}

			const result = await listEventPhotosPaginated(eventId, limit, resolvedCursor);
			return json({
				...baseMeta,
				photos: result.photos,
				nextCursor: result.nextCursor,
				total: result.total
			});
		}

		const photos = await listEventPhotos(eventId);
		return json({ ...baseMeta, photos });
	} catch (err) {
		console.error('GET /api/photos error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to list photos');
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const [meta, existingPhotos] = await Promise.all([
		getEventMeta(eventId),
		listEventPhotos(eventId)
	]);

	if (meta?.uploadDeadline && new Date() > new Date(meta.uploadDeadline)) {
		throw error(403, 'Upload deadline has passed');
	}

	const maxPhotos = meta?.maxPhotos ?? 5;
	if (existingPhotos.length >= maxPhotos) {
		throw error(403, 'Photo limit reached for this event');
	}

	const body = await request.arrayBuffer();
	if (body.byteLength === 0) {
		throw error(400, 'No file provided');
	}

	try {
		const photoId = nanoid(10);
		await uploadPhoto(eventId, photoId, body);
		return json({ photoId });
	} catch (err) {
		console.error('POST /api/photos error:', err);
		throw error(500, err instanceof Error ? err.message : 'Failed to upload photo');
	}
};
