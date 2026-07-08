import type { ApiClient } from "../client";
import type { PaginatedResponse, Service, SingleResponse } from "../types";

export interface CreateServiceBody {
	branchId: string;
	name: string;
	category: string;
	duration: number;
	price: number;
	description?: string;
}

export function createServicesEndpoints(client: ApiClient) {
	return {
		list: (branchId: string, params?: { page?: number; limit?: number }) =>
			client.get<PaginatedResponse<Service>>("/api/v1/services", {
				branchId,
				...params,
			}),

		get: (id: string) =>
			client.get<SingleResponse<Service>>(`/api/v1/services/${id}`),

		create: (body: CreateServiceBody) => {
			const { branchId, ...rest } = body;
			return client.post<SingleResponse<Service>>(
				`/api/v1/services?branchId=${encodeURIComponent(branchId)}`,
				rest,
			);
		},

		update: (id: string, body: Partial<Omit<CreateServiceBody, "branchId">>) =>
			client.patch<SingleResponse<Service>>(`/api/v1/services/${id}`, body),

		delete: (id: string) =>
			client.delete<SingleResponse<Service>>(`/api/v1/services/${id}`),

		uploadPhoto: (id: string, formData: FormData) =>
			client.post<{ url: string }>(`/api/v1/services/${id}/photo`, formData),

		deletePhoto: (id: string) =>
			client.delete<void>(`/api/v1/services/${id}/photo`),
	};
}
