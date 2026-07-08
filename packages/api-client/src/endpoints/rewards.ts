import type { ApiClient } from "../client";
import type {
	PaginatedResponse,
	RewardBalance,
	RewardTransaction,
} from "../types";

export interface RedeemRewardsBody {
	points: number;
	description?: string;
}

export interface RedeemRewardsResponse {
	balance: number;
	transactionId: string;
}

export function createRewardsEndpoints(client: ApiClient) {
	return {
		balance: () => client.get<RewardBalance>("/api/v1/rewards/balance"),

		history: (params?: { page?: number; limit?: number }) =>
			client.get<PaginatedResponse<RewardTransaction>>(
				"/api/v1/rewards/history",
				params,
			),

		redeem: (body: RedeemRewardsBody) =>
			client.post<RedeemRewardsResponse>("/api/v1/rewards/redeem", body),
	};
}
