import type { ApiClient } from "../client";
import type {
	MyReview,
	PaginatedResponse,
	Review,
	SingleResponse,
} from "../types";

export interface CreateReviewBody {
	businessId: string;
	serviceId: string;
	bookingId?: string;
	rating: number;
	text: string;
}

export function createReviewsEndpoints(client: ApiClient) {
	return {
		list: (params: { businessId: string; page?: number; limit?: number }) =>
			client.get<PaginatedResponse<Review>>("/api/v1/reviews", params),

		listMine: () => client.get<MyReview[]>("/api/v1/reviews/mine"),

		listPending: (params: {
			businessId: string;
			page?: number;
			limit?: number;
		}) => client.get<Review[]>("/api/v1/reviews/pending", params),

		create: (body: CreateReviewBody) =>
			client.post<SingleResponse<Review>>("/api/v1/reviews", body),

		approve: (id: string) =>
			client.patch<SingleResponse<Review>>(`/api/v1/reviews/${id}/approve`),

		reject: (id: string) =>
			client.patch<SingleResponse<Review>>(`/api/v1/reviews/${id}/reject`),
	};
}
