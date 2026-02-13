import type { Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { saveEventMeta } from '$lib/server/r2';

export const actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const eventName = formData.get('eventName')?.toString().trim();

		if (!eventName) {
			return fail(400, { error: 'Event name is required' });
		}

		const eventId = nanoid(10);
		await saveEventMeta(eventId, { name: eventName });
		throw redirect(303, `/event/${eventId}`);
	}
} satisfies Actions;
