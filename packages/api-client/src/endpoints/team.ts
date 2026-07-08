import type { ApiClient } from "../client";
import type {
	PaginatedResponse,
	SingleResponse,
	TeamMember,
	TeamRole,
} from "../types";

export interface AddTeamMemberBody {
	userId: string;
	businessId: string;
	role: Exclude<TeamRole, "Owner">;
	title?: string;
	branchId?: string;
}

export function createTeamEndpoints(client: ApiClient) {
	return {
		list: (params: { businessId: string; page?: number; limit?: number }) =>
			client.get<PaginatedResponse<TeamMember>>("/api/v1/team", params),

		add: (body: AddTeamMemberBody) =>
			client.post<SingleResponse<TeamMember>>("/api/v1/team", body),

		update: (
			id: string,
			body: Partial<Pick<AddTeamMemberBody, "role" | "title" | "branchId">>,
		) => client.patch<SingleResponse<TeamMember>>(`/api/v1/team/${id}`, body),

		remove: (id: string) =>
			client.delete<SingleResponse<TeamMember>>(`/api/v1/team/${id}`),
	};
}
