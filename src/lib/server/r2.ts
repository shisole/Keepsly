import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '$env/dynamic/private';

function getR2Client() {
	return new S3Client({
		region: 'auto',
		endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID!,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY!
		}
	});
}

export async function getPresignedUploadUrl(eventId: string, photoId: string): Promise<string> {
	const client = getR2Client();
	const key = `events/${eventId}/${photoId}.jpg`;

	const command = new PutObjectCommand({
		Bucket: env.R2_BUCKET_NAME,
		Key: key,
		ContentType: 'image/jpeg'
	});

	return getSignedUrl(client, command, { expiresIn: 600 });
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
		.filter((obj) => obj.Key && obj.Key.endsWith('.jpg'))
		.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
		.map((obj) => `${env.R2_PUBLIC_URL}/${obj.Key}`);
}
