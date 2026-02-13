import imageCompression from 'browser-image-compression';

const COMPRESSION_OPTIONS = {
	maxSizeMB: 1,
	maxWidthOrHeight: 1920,
	useWebWorker: true,
	fileType: 'image/jpeg' as const
};

export async function compressImage(file: File): Promise<File> {
	if (file.size <= 1024 * 1024 && file.type === 'image/jpeg') {
		return file;
	}

	const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
	return new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), {
		type: 'image/jpeg'
	});
}
