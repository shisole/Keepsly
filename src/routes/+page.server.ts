import type { Actions } from './$types';
import { nanoid } from 'nanoid';

export const actions = {
	create: async () => {
		const eventId = nanoid(10);
		return { eventId };
	}
} satisfies Actions;
