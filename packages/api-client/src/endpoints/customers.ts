import type { ApiClient } from "../client";

export type CustomerTier = "VIP" | "Regular" | "New" | "AtRisk";

export interface CustomerSummary {
	userId: string;
	name: string;
	email: string | null;
	phone: string | null;
	totalVisits: number;
	totalSpend: number;
	avgSpend: number;
	lastVisit: string | null;
	firstVisit: string | null;
	tier: CustomerTier;
}

export interface CustomerVisit {
	id: string;
	slot: string;
	status: string;
	price: number;
	discount: number;
	serviceId: string;
}

export function createCustomersEndpoints(client: ApiClient) {
	return {
		list: (params: { businessId: string }) =>
			client.get<CustomerSummary[]>("/api/v1/customers", params),

		visits: (userId: string, params: { businessId: string }) =>
			client.get<CustomerVisit[]>(`/api/v1/customers/${userId}/visits`, params),
	};
}
