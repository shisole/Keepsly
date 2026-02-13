import { readFileSync } from 'node:fs';
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

// Parse .env file manually (no dotenv dependency needed)
const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf-8');
const env = Object.fromEntries(
	envFile.split('\n').filter(l => l.includes('=')).map(l => {
		const [key, ...rest] = l.split('=');
		return [key.trim(), rest.join('=').trim()];
	})
);

const client = new S3Client({
	region: 'auto',
	endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY
	}
});

const command = new PutBucketCorsCommand({
	Bucket: env.R2_BUCKET_NAME,
	CORSConfiguration: {
		CORSRules: [
			{
				AllowedOrigins: ['*'],
				AllowedMethods: ['PUT'],
				AllowedHeaders: ['Content-Type'],
				MaxAgeSeconds: 3600
			}
		]
	}
});

try {
	await client.send(command);
	console.log('CORS configuration applied successfully to bucket:', env.R2_BUCKET_NAME);
} catch (err) {
	console.error('Failed to set CORS:', err.message);
	process.exit(1);
}
