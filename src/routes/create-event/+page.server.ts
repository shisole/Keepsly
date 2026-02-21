import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import { saveEventMeta } from '$lib/server/r2';

const DURATION_MS: Record<string, number> = {
	'1d': 1 * 24 * 60 * 60 * 1000,
	'3d': 3 * 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000,
	'14d': 14 * 24 * 60 * 60 * 1000,
	'30d': 30 * 24 * 60 * 60 * 1000
};

export const actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const eventName = formData.get('eventName')?.toString().trim();

		if (!eventName) {
			return fail(400, { error: 'Event name is required' });
		}

		const maxPhotosRaw = parseInt(formData.get('maxPhotos')?.toString() ?? '5', 10);
		const maxPhotos = Math.max(5, Math.min(15, isNaN(maxPhotosRaw) ? 5 : maxPhotosRaw));

		const duration = formData.get('duration')?.toString() ?? '';
		const durationMs = DURATION_MS[duration];
		if (!durationMs) {
			return fail(400, { error: 'Please select a valid duration' });
		}

		const uploadDeadline = new Date(Date.now() + durationMs).toISOString();

		const eventId = nanoid(10);
		const hostKey = nanoid(20);
		await saveEventMeta(eventId, { name: eventName, maxPhotos, uploadDeadline, hostKey });
		return { eventId, hostKey };
	}
} satisfies Actions;
