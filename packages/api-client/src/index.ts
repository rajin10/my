export {
	type AuthInitialState,
	type CookieReader,
	clearAuthCookies,
	DISPLAY_USER_COOKIE,
	readAuthInitialState,
	SESSION_HINT_COOKIE,
	setSessionHintCookie,
	syncAuthDisplayCookie,
} from "./auth-cookies";
export {
	type AuthLoginErrorCode,
	authCallbackErrorParam,
	authFormErrorMessage,
	authLoginErrorMessage,
	authSignInStartErrorMessage,
} from "./auth-errors";
export type { ApiClientConfig } from "./client";
export { ApiClient, ApiError } from "./client";
export type { AuthEvents, TokenStore } from "./token-store";
export {
	ACCESS_TOKEN_KEY,
	createAuthEvents,
	REFRESH_TOKEN_KEY,
	webTokenStore,
} from "./token-store";

/** Factory for the `tryRefresh` option on `createApi`. Pass your app's token store. */
export function createRefreshFn(
	baseUrl: string,
	store: {
		getRefreshToken(): string | null;
		setTokens(accessToken: string, refreshToken: string): Promise<void>;
	},
): () => Promise<string | null> {
	return async () => {
		const refreshToken = store.getRefreshToken();
		if (!refreshToken) return null;
		try {
			const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken }),
			});
			if (!res.ok) return null;
			const data = (await res.json()) as {
				accessToken: string;
				refreshToken: string;
			};
			await store.setTokens(data.accessToken, data.refreshToken);
			return data.accessToken;
		} catch {
			return null;
		}
	};
}
export type {
	AnalyticsOverview,
	AnalyticsRange,
	CouponStat,
	Earnings,
	EarningsBreakdownRow,
	PeakSlot,
	RevenuePoint,
	ReviewStats,
	ServiceStat,
	StaffStat,
} from "./endpoints/analytics";
export type { SessionInfo } from "./endpoints/auth";
export type {
	AssignStaffBody,
	CalendarBooking,
	CreateBookingBody,
} from "./endpoints/bookings";
export type {
	CreateBranchBody,
	UpsertBranchHoursBody,
} from "./endpoints/branches";
export type { CreateBusinessBody } from "./endpoints/businesses";
export type {
	Campaign,
	CampaignChannel,
	CampaignSegment,
	CampaignStatus,
	CreateCampaignBody,
	UpdateCampaignBody,
} from "./endpoints/campaigns";
export type {
	CreateCouponBody,
	ValidateCouponResponse,
} from "./endpoints/coupons";
export type { AddressBody } from "./endpoints/customer-addresses";
export type {
	CustomerSummary,
	CustomerTier,
	CustomerVisit,
} from "./endpoints/customers";
export type {
	CreateDemoRequestBody,
	DemoRequest,
} from "./endpoints/demo-requests";
export type { Favourite } from "./endpoints/favourites";
export type { PlaceOrderBody } from "./endpoints/orders";
export type { RecordPaymentBody } from "./endpoints/payments";
export type { CreateProductBody } from "./endpoints/products";
export type { CreateReviewBody } from "./endpoints/reviews";
export type {
	RedeemRewardsBody,
	RedeemRewardsResponse,
} from "./endpoints/rewards";
export type { EnrichedSearchResult, SearchSortBy } from "./endpoints/search";
export type { CreateServiceBody } from "./endpoints/services";
export type {
	StaffAvailabilitySlot,
	UpsertStaffAvailabilityBody,
} from "./endpoints/staff-availability";
export type { AddTeamMemberBody } from "./endpoints/team";
export type {
	WalkInContext,
	WalkInSubmitBody,
	WalkInSubmitResponse,
} from "./endpoints/walk-in";
export type { AppNotification, AppNotificationType } from "./types";
export * from "./types";

import type { ApiClientConfig } from "./client";
import { ApiClient } from "./client";
import { createAnalyticsEndpoints } from "./endpoints/analytics";
import { createAuthEndpoints } from "./endpoints/auth";
import { createBookingsEndpoints } from "./endpoints/bookings";
import { createBranchesEndpoints } from "./endpoints/branches";
import { createBusinessesEndpoints } from "./endpoints/businesses";
import { createCampaignsEndpoints } from "./endpoints/campaigns";
import { createCouponsEndpoints } from "./endpoints/coupons";
import { createCustomerAddressesEndpoints } from "./endpoints/customer-addresses";
import { createCustomersEndpoints } from "./endpoints/customers";
import { createDemoRequestsEndpoints } from "./endpoints/demo-requests";
import { createFavouritesEndpoints } from "./endpoints/favourites";
import { createKhataEndpoints } from "./endpoints/khata";
import { createNotificationsEndpoints } from "./endpoints/notifications";
import { createOrdersEndpoints } from "./endpoints/orders";
import { createPaymentsEndpoints } from "./endpoints/payments";
import { createProductsEndpoints } from "./endpoints/products";
import { createReviewsEndpoints } from "./endpoints/reviews";
import { createRewardsEndpoints } from "./endpoints/rewards";
import { createSearchEndpoints } from "./endpoints/search";
import { createServicesEndpoints } from "./endpoints/services";
import { createStaffAvailabilityEndpoints } from "./endpoints/staff-availability";
import { createTeamEndpoints } from "./endpoints/team";
import { createUsersEndpoints } from "./endpoints/users";
import { createWalkInEndpoints } from "./endpoints/walk-in";

export function createApi(config: ApiClientConfig) {
	const client = new ApiClient(config);
	return {
		auth: createAuthEndpoints(client),
		users: createUsersEndpoints(client),
		businesses: createBusinessesEndpoints(client),
		branches: createBranchesEndpoints(client),
		services: createServicesEndpoints(client),
		products: createProductsEndpoints(client),
		bookings: createBookingsEndpoints(client),
		reviews: createReviewsEndpoints(client),
		coupons: createCouponsEndpoints(client),
		team: createTeamEndpoints(client),
		rewards: createRewardsEndpoints(client),
		search: createSearchEndpoints(client),
		analytics: createAnalyticsEndpoints(client),
		customers: createCustomersEndpoints(client),
		campaigns: createCampaignsEndpoints(client),
		notifications: createNotificationsEndpoints(client),
		favourites: createFavouritesEndpoints(client),
		staffAvailability: createStaffAvailabilityEndpoints(client),
		demoRequests: createDemoRequestsEndpoints(client),
		orders: createOrdersEndpoints(client),
		customerAddresses: createCustomerAddressesEndpoints(client),
		payments: createPaymentsEndpoints(client),
		khata: createKhataEndpoints(client),
		walkIn: createWalkInEndpoints(client),
	};
}

export type TalashApi = ReturnType<typeof createApi>;
