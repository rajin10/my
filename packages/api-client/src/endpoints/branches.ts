import type { ApiClient } from "../client";
import type {
	Branch,
	BranchHours,
	PaginatedResponse,
	SingleResponse,
} from "../types";

export interface UpsertBranchHoursBody {
	hours: Array<{
		dayOfWeek: number;
		isClosed: boolean;
		openTime: string | null;
		closeTime: string | null;
	}>;
}

export interface CreateBranchBody {
	businessId: string;
	name: string;
	address: string;
	city: string;
}

export function createBranchesEndpoints(client: ApiClient) {
	return {
		list: (businessId: string, params?: { page?: number; limit?: number }) =>
			client.get<PaginatedResponse<Branch>>("/api/v1/branches", {
				businessId,
				...params,
			}),

		get: (id: string) =>
			client.get<SingleResponse<Branch>>(`/api/v1/branches/${id}`),

		create: (body: CreateBranchBody) => {
			const { businessId, ...rest } = body;
			return client.post<SingleResponse<Branch>>(
				`/api/v1/branches?businessId=${encodeURIComponent(businessId)}`,
				rest,
			);
		},

		update: (id: string, body: Partial<Omit<CreateBranchBody, "businessId">>) =>
			client.patch<SingleResponse<Branch>>(`/api/v1/branches/${id}`, body),

		delete: (id: string) =>
			client.delete<SingleResponse<Branch>>(`/api/v1/branches/${id}`),

		getHours: (id: string) =>
			client.get<BranchHours[]>(`/api/v1/branches/${id}/hours`),

		getAvailability: (
			id: string,
			params: { date: string; serviceId: string },
		) =>
			client.get<{
				date: string;
				serviceId: string;
				isClosed: boolean;
				slots: string[];
			}>(`/api/v1/branches/${id}/availability`, params),

		upsertHours: (id: string, body: UpsertBranchHoursBody) =>
			client.put<BranchHours[]>(`/api/v1/branches/${id}/hours`, body),
	};
}
