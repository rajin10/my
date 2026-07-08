import type { ApiClient } from "../client";

export interface AnalyticsOverview {
	totalRevenue: number;
	totalBookings: number;
	avgBookingValue: number;
	completedBookings: number;
	pendingBookings: number;
	cancelledBookings: number;
	newCustomers: number;
	returningCustomers: number;
}

export interface RevenuePoint {
	date: string;
	revenue: number;
	bookings: number;
}

export interface ServiceStat {
	serviceId: string;
	name: string;
	count: number;
	revenue: number;
}

export interface PeakSlot {
	day: string;
	hour: string;
	count: number;
}

export type AnalyticsRange = "7" | "30" | "90";

export interface ReviewStats {
	avgRating: number;
	totalReviews: number;
	ratingDistribution: { rating: number; count: number }[];
}

export interface CouponStat {
	couponId: string;
	code: string;
	redemptions: number;
	totalDiscount: number;
}

export interface StaffStat {
	teamMemberId: string;
	name: string;
	bookings: number;
	revenue: number;
}

export interface EarningsBreakdownRow {
	revenue: number;
	bookings: number;
}

export interface Earnings {
	total: number;
	byStaff: (EarningsBreakdownRow & {
		teamMemberId: string | null;
		name: string;
	})[];
	byService: (EarningsBreakdownRow & { serviceId: string; name: string })[];
	byBranch: (EarningsBreakdownRow & { branchId: string; name: string })[];
	overTime: (EarningsBreakdownRow & { date: string })[];
}

export function createAnalyticsEndpoints(client: ApiClient) {
	return {
		overview: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<AnalyticsOverview>("/api/v1/analytics/overview", params),

		revenue: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<RevenuePoint[]>("/api/v1/analytics/revenue", params),

		services: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<ServiceStat[]>("/api/v1/analytics/services", params),

		peak: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<PeakSlot[]>("/api/v1/analytics/peak", params),

		reviews: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<ReviewStats>("/api/v1/analytics/reviews", params),

		coupons: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<{ coupons: CouponStat[] }>(
				"/api/v1/analytics/coupons",
				params,
			),

		staff: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<{ staff: StaffStat[] }>("/api/v1/analytics/staff", params),

		earnings: (params: { businessId: string; range?: AnalyticsRange }) =>
			client.get<Earnings>("/api/v1/analytics/earnings", params),
	};
}
