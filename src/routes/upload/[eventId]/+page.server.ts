import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEventMeta } from '$lib/server/r2';

export const load: PageServerLoad = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(404, 'Invalid event');
	}

	const meta = await getEventMeta(eventId);

	return {
		eventId,
		eventName: meta?.name ?? null
	};
};
