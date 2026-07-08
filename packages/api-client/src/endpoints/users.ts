import type { ApiClient } from "../client";
import type {
	DeleteAccountProof,
	PaginatedResponse,
	SingleResponse,
	User,
} from "../types";

export interface ListUsersParams {
	page?: number;
	limit?: number;
	search?: string;
	sort?: string;
	sortBy?: "asc" | "desc";
}

export interface CreateUserBody {
	name: string;
	role: string;
	email?: string;
	phone?: string;
}

export function createUsersEndpoints(client: ApiClient) {
	return {
		list: (params?: ListUsersParams) =>
			client.get<PaginatedResponse<User>>(
				"/api/v1/users",
				params as
					| Record<string, string | number | boolean | undefined>
					| undefined,
			),

		get: (id: string) =>
			client.get<SingleResponse<User>>(`/api/v1/users/${id}`),

		create: (body: CreateUserBody) =>
			client.post<SingleResponse<User>>("/api/v1/users", body),

		update: (id: string, body: Partial<CreateUserBody>) =>
			client.patch<SingleResponse<User>>(`/api/v1/users/${id}`, body),

		delete: (id: string, proof: DeleteAccountProof) =>
			client.delete<SingleResponse<User>>(`/api/v1/users/${id}`, proof),

		uploadPhoto: (id: string, formData: FormData) =>
			client.post<{ url: string }>(`/api/v1/users/${id}/photo`, formData),
	};
}
