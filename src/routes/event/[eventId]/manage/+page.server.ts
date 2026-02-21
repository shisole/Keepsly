import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEventMeta, listEventPhotosPaginated } from '$lib/server/r2';

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

	const result = await listEventPhotosPaginated(eventId, 20);

	return {
		eventId,
		hostKey: key,
		eventName: meta.name,
		maxPhotos: meta.maxPhotos,
		uploadDeadline: meta.uploadDeadline,
		bannerUrl: meta.bannerUrl ?? null,
		initialPhotos: result.photos,
		initialNextCursor: result.nextCursor
	};
};
