import type { ApiClient } from "../client";
import type { Product, SingleResponse } from "../types";

export interface CreateProductBody {
	branchId: string;
	name: string;
	category?: string;
	price: number;
	stock?: number;
	description?: string;
	status?: "Active" | "Inactive";
}

export function createProductsEndpoints(client: ApiClient) {
	return {
		list: (branchId: string, params?: { page?: number; limit?: number }) =>
			client.get<Product[]>("/api/v1/products", {
				branchId,
				...params,
			}),

		get: (id: string) =>
			client.get<SingleResponse<Product>>(`/api/v1/products/${id}`),

		create: (body: CreateProductBody) => {
			const { branchId, ...rest } = body;
			return client.post<SingleResponse<Product>>(
				`/api/v1/products?branchId=${encodeURIComponent(branchId)}`,
				rest,
			);
		},

		update: (id: string, body: Partial<Omit<CreateProductBody, "branchId">>) =>
			client.patch<SingleResponse<Product>>(`/api/v1/products/${id}`, body),

		delete: (id: string) =>
			client.delete<SingleResponse<Product>>(`/api/v1/products/${id}`),

		uploadPhoto: (id: string, formData: FormData) =>
			client.post<{ url: string }>(`/api/v1/products/${id}/photo`, formData),

		deletePhoto: (id: string) =>
			client.delete<void>(`/api/v1/products/${id}/photo`),
	};
}
