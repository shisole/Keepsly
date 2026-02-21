import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEventMeta, listEventPhotoKeys, getPhotoBuffer } from '$lib/server/r2';
import JSZip from 'jszip';

export const GET: RequestHandler = async ({ params }) => {
	const { eventId } = params;

	if (!eventId || eventId.length < 5) {
		throw error(400, 'Invalid event ID');
	}

	const [meta, photoKeys] = await Promise.all([
		getEventMeta(eventId),
		listEventPhotoKeys(eventId)
	]);

	if (photoKeys.length === 0) {
		throw error(404, 'No photos found for this event');
	}

	const zip = new JSZip();
	const eventName = meta?.name ?? eventId;

	for (let i = 0; i < photoKeys.length; i++) {
		const buffer = await getPhotoBuffer(eventId, photoKeys[i]);
		if (buffer) {
			zip.file(`photo-${i + 1}.jpg`, buffer);
		}
	}

	const zipBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });

	const safeName = eventName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || eventId;

	return new Response(zipBuffer, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${safeName}-photos.zip"`
		}
	});
};
