import type { ApiClient } from "../client";
import type {
	BrandPalette,
	Business,
	BusinessPhoto,
	BusinessStatus,
	BusinessVertical,
	PaginatedResponse,
	SingleResponse,
} from "../types";

export interface CreateBusinessBody {
	name: string;
	category: string;
	city: string;
	vertical: BusinessVertical;
	description?: string;
	status?: BusinessStatus;
	// Owner white-label palette; pass `null` via `update` to revert to Talash defaults.
	brandPalette?: BrandPalette | null;
}

export function createBusinessesEndpoints(client: ApiClient) {
	return {
		list: (params?: { page?: number; limit?: number; search?: string }) =>
			client.get<PaginatedResponse<Business>>("/api/v1/businesses", params),

		get: (id: string) =>
			client.get<SingleResponse<Business>>(`/api/v1/businesses/${id}`),

		create: (body: CreateBusinessBody) =>
			client.post<SingleResponse<Business>>("/api/v1/businesses", body),

		update: (id: string, body: Partial<CreateBusinessBody>) =>
			client.patch<SingleResponse<Business>>(`/api/v1/businesses/${id}`, body),

		delete: (id: string) =>
			client.delete<SingleResponse<Business>>(`/api/v1/businesses/${id}`),

		restore: (id: string) =>
			client.patch<SingleResponse<Business>>(
				`/api/v1/businesses/${id}/restore`,
			),

		listPhotos: (id: string) =>
			client.get<BusinessPhoto[]>(`/api/v1/businesses/${id}/photos`),

		uploadPhoto: (id: string, formData: FormData) =>
			client.post<{ url: string }>(`/api/v1/businesses/${id}/photos`, formData),

		deletePhoto: (businessId: string, photoId: string) =>
			client.delete<void>(`/api/v1/businesses/${businessId}/photos/${photoId}`),

		reorderPhotos: (
			businessId: string,
			orders: { id: string; order: number }[],
		) =>
			client.patch<BusinessPhoto[]>(
				`/api/v1/businesses/${businessId}/photos/order`,
				{
					orders,
				},
			),
	};
}
