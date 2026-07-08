import type { ApiClient } from "../client";

export interface Favourite {
	id: string;
	userId: string;
	businessId: string;
	createdAt: string;
}

export function createFavouritesEndpoints(client: ApiClient) {
	return {
		list: () => client.get<Favourite[]>("/api/v1/favourites"),

		check: (businessId: string) =>
			client.get<{ isFavourited: boolean }>(`/api/v1/favourites/${businessId}`),

		add: (businessId: string) =>
			client.post<Favourite>(`/api/v1/favourites/${businessId}`),

		remove: (businessId: string) =>
			client.delete<void>(`/api/v1/favourites/${businessId}`),
	};
}
