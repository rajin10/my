import type { ApiClient } from "../client";

export interface CreateDemoRequestBody {
	name: string;
	email: string;
	businessName: string;
	message?: string;
}

export interface DemoRequest {
	id: string;
	name: string;
	email: string;
	businessName: string;
	message: string | null;
	createdAt: string;
}

export function createDemoRequestsEndpoints(client: ApiClient) {
	return {
		create: (body: CreateDemoRequestBody) =>
			client.post<DemoRequest>("/api/v1/demo-requests", body),
	};
}
