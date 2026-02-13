import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getEventMeta, listEventPhotos } from '$lib/server/r2';

export const load: PageServerLoad = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const [meta, photos] = await Promise.all([
		getEventMeta(eventId),
		listEventPhotos(eventId)
	]);

	return {
		eventId,
		eventName: meta?.name ?? null,
		firstPhoto: photos[0] ?? null
	};
};
