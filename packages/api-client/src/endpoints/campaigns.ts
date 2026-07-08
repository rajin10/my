import type { ApiClient } from "../client";

export type CampaignSegment = "All" | "VIP" | "Regular" | "New" | "AtRisk";
export type CampaignStatus = "Draft" | "Sent";
export type CampaignChannel = "Email" | "SMS" | "Push";

export interface Campaign {
	id: string;
	businessId: string;
	name: string;
	segment: CampaignSegment;
	channels: string; // JSON-encoded string[]
	message: string;
	status: CampaignStatus;
	sentAt: string | null;
	recipientCount: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface CreateCampaignBody {
	businessId: string;
	name: string;
	segment?: CampaignSegment;
	channels?: CampaignChannel[];
	message?: string;
}

export interface UpdateCampaignBody {
	name?: string;
	segment?: CampaignSegment;
	channels?: CampaignChannel[];
	message?: string;
}

export function createCampaignsEndpoints(client: ApiClient) {
	return {
		list: (params: { businessId: string }) =>
			client.get<Campaign[]>("/api/v1/campaigns", params),

		create: (body: CreateCampaignBody) =>
			client.post<Campaign>("/api/v1/campaigns", body),

		update: (id: string, body: UpdateCampaignBody) =>
			client.patch<Campaign>(`/api/v1/campaigns/${id}`, body),

		send: (id: string, params: { businessId: string }) =>
			client.post<Campaign>(
				`/api/v1/campaigns/${id}/send?businessId=${params.businessId}`,
			),

		delete: (id: string) => client.delete<void>(`/api/v1/campaigns/${id}`),
	};
}
