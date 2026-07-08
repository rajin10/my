import type { ApiClient } from "../client";
import type {
	Coupon,
	CouponType,
	PaginatedResponse,
	SingleResponse,
} from "../types";

export interface CreateCouponBody {
	businessId: string;
	code: string;
	type: CouponType;
	value: number;
	maxUses: number;
	expiresAt: string;
}

export interface ValidateCouponResponse {
	valid: boolean;
	coupon?: Coupon;
	discount?: number;
	message?: string;
}

export function createCouponsEndpoints(client: ApiClient) {
	return {
		list: (params: { businessId: string; page?: number; limit?: number }) =>
			client.get<PaginatedResponse<Coupon>>("/api/v1/coupons", params),

		get: (id: string) =>
			client.get<SingleResponse<Coupon>>(`/api/v1/coupons/${id}`),

		create: (body: CreateCouponBody) =>
			client.post<SingleResponse<Coupon>>("/api/v1/coupons", body),

		delete: (id: string) =>
			client.delete<SingleResponse<Coupon>>(`/api/v1/coupons/${id}`),

		validate: (body: { code: string; businessId: string }) =>
			client.post<ValidateCouponResponse>("/api/v1/coupons/validate", body),
	};
}
