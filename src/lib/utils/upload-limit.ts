const STORAGE_KEY = 'keepsly-uploads';

function getStore(): Record<string, number> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
	} catch {
		return {};
	}
}

export function getUploadedCount(eventId: string): number {
	return getStore()[eventId] ?? 0;
}

export function incrementUploadedCount(eventId: string): void {
	const store = getStore();
	store[eventId] = (store[eventId] ?? 0) + 1;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
