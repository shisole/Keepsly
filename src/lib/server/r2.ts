import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

function getR2Client() {
	return new S3Client({
		region: 'auto',
		endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		forcePathStyle: true,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID!,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY!
		}
	});
}

export interface EventMeta {
	name: string;
	maxPhotos: number;
	uploadDeadline: string; // ISO 8601 datetime string
	bannerUrl?: string;
	hostKey: string;
}

export async function saveEventMeta(eventId: string, meta: EventMeta): Promise<void> {
	const client = getR2Client();
	const command = new PutObjectCommand({
		Bucket: env.R2_BUCKET_NAME,
		Key: `events/${eventId}/meta.json`,
		Body: JSON.stringify(meta),
		ContentType: 'application/json'
	});
	await client.send(command);
}

export async function getEventMeta(eventId: string): Promise<EventMeta | null> {
	const client = getR2Client();
	try {
		const command = new GetObjectCommand({
			Bucket: env.R2_BUCKET_NAME,
			Key: `events/${eventId}/meta.json`
		});
		const response = await client.send(command);
		const body = await response.Body?.transformToString();
		return body ? JSON.parse(body) : null;
	} catch {
		return null;
	}
}

export async function uploadPhoto(eventId: string, photoId: string, body: ArrayBuffer): Promise<void> {
	const client = getR2Client();
	const key = `events/${eventId}/${photoId}.jpg`;

	const command = new PutObjectCommand({
		Bucket: env.R2_BUCKET_NAME,
		Key: key,
		Body: new Uint8Array(body),
		ContentType: 'image/jpeg'
	});

	await client.send(command);
}

export async function uploadBanner(eventId: string, body: ArrayBuffer): Promise<string> {
	const client = getR2Client();
	const key = `events/${eventId}/banner.jpg`;

	const command = new PutObjectCommand({
		Bucket: env.R2_BUCKET_NAME,
		Key: key,
		Body: new Uint8Array(body),
		ContentType: 'image/jpeg'
	});

	await client.send(command);
	return `${env.R2_PUBLIC_URL}/${key}`;
}

export async function listEventPhotos(eventId: string): Promise<string[]> {
	const client = getR2Client();
	const prefix = `events/${eventId}/`;

	const command = new ListObjectsV2Command({
		Bucket: env.R2_BUCKET_NAME,
		Prefix: prefix
	});

	const response = await client.send(command);

	if (!response.Contents) return [];

	return response.Contents
		.filter((obj) => obj.Key && obj.Key.endsWith('.jpg') && !obj.Key.endsWith('/banner.jpg'))
		.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
		.map((obj) => `${env.R2_PUBLIC_URL}/${obj.Key}`);
}

export async function getPhotoBuffer(eventId: string, photoKey: string): Promise<Uint8Array | null> {
	const client = getR2Client();
	try {
		const command = new GetObjectCommand({
			Bucket: env.R2_BUCKET_NAME,
			Key: photoKey
		});
		const response = await client.send(command);
		const bytes = await response.Body?.transformToByteArray();
		return bytes ?? null;
	} catch {
		return null;
	}
}

export async function listEventPhotoKeys(eventId: string): Promise<string[]> {
	const client = getR2Client();
	const prefix = `events/${eventId}/`;

	const command = new ListObjectsV2Command({
		Bucket: env.R2_BUCKET_NAME,
		Prefix: prefix
	});

	const response = await client.send(command);

	if (!response.Contents) return [];

	return response.Contents
		.filter((obj) => obj.Key && obj.Key.endsWith('.jpg') && !obj.Key.endsWith('/banner.jpg'))
		.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
		.map((obj) => obj.Key!);
}

export async function listEventPhotosPaginated(
	eventId: string,
	limit: number,
	cursor?: string
): Promise<{ photos: string[]; nextCursor: string | null; total: number }> {
	const client = getR2Client();
	const prefix = `events/${eventId}/`;

	const command = new ListObjectsV2Command({
		Bucket: env.R2_BUCKET_NAME,
		Prefix: prefix
	});

	const response = await client.send(command);

	if (!response.Contents) return { photos: [], nextCursor: null, total: 0 };

	const sorted = response.Contents
		.filter((obj) => obj.Key && obj.Key.endsWith('.jpg') && !obj.Key.endsWith('/banner.jpg'))
		.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0));

	const offset = cursor ? parseInt(cursor, 10) : 0;
	const page = sorted.slice(offset, offset + limit);
	const hasMore = offset + limit < sorted.length;

	return {
		photos: page.map((obj) => `${env.R2_PUBLIC_URL}/${obj.Key}`),
		nextCursor: hasMore ? String(offset + limit) : null,
		total: sorted.length
	};
}

export async function deletePhoto(eventId: string, photoId: string): Promise<void> {
	const client = getR2Client();
	const command = new DeleteObjectCommand({
		Bucket: env.R2_BUCKET_NAME,
		Key: `events/${eventId}/${photoId}.jpg`
	});
	await client.send(command);
}
