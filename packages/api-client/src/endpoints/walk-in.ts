import type { ApiClient } from "../client";
import type { BrandPalette } from "../types";

export type WalkInVertical = "booking" | "commerce";

export type WalkInCustomerInput = {
	userId?: string;
	guestName?: string;
	guestPhone?: string;
};

export type WalkInSubmitBody = {
	localId: string;
	branchId: string;
	vertical: WalkInVertical;
	customer: WalkInCustomerInput;
	booking?: { serviceId: string; slot: string };
	order?: { items: { productId: string; qty: number }[] };
	total: number;
	submittedAt: number;
};

export type WalkInSubmitResponse = {
	localId: string;
	serverId: string;
	status: "accepted";
};

export type WalkInServiceItem = {
	id: string;
	name: string;
	price: number;
	duration: number;
	photoUrl: string | null;
	nextSlot: string | null;
};

export type WalkInProductItem = {
	id: string;
	name: string;
	price: number;
	stock: number;
	photoUrl: string | null;
};

export type WalkInBookingContext = {
	branchId: string;
	businessId: string;
	businessName: string;
	vertical: "booking";
	brandPalette: BrandPalette | null;
	services: WalkInServiceItem[];
	snapshotAt: string;
};

export type WalkInCommerceContext = {
	branchId: string;
	businessId: string;
	businessName: string;
	vertical: "commerce";
	brandPalette: BrandPalette | null;
	fulfillment: "counter";
	products: WalkInProductItem[];
	snapshotAt: string;
};

export type WalkInContext = WalkInBookingContext | WalkInCommerceContext;

export type WalkInBranchQrResponse = {
	branchId: string;
	businessId: string;
	vertical: WalkInVertical;
	signature: string;
	version: number;
	universalUrl: string;
	deepLink: string;
};

export type WalkInSessionResponse = {
	sessionToken: string;
	expiresAt: number;
	universalUrl: string;
	deepLink: string;
};

export type WalkInReceipt = {
	localId: string;
	serverId: string;
	vertical: WalkInVertical;
	createdAt: string;
};

export function createWalkInEndpoints(client: ApiClient) {
	return {
		getContext: (params: {
			branchId: string;
			session?: string;
			signature?: string;
		}) => client.get<WalkInContext>("/api/v1/walk-in/context", params),

		submit: (body: WalkInSubmitBody) =>
			client.post<WalkInSubmitResponse>("/api/v1/walk-in/submit", body),

		sync: (entries: WalkInSubmitBody[]) =>
			client.post<{ synced: Record<string, string> }>("/api/v1/walk-in/sync", {
				entries,
			}),

		regenerateBranchQr: (branchId: string) =>
			client.post<WalkInBranchQrResponse>("/api/v1/walk-in/branch-qr", {
				branchId,
			}),

		createSession: (branchId: string) =>
			client.post<WalkInSessionResponse>("/api/v1/walk-in/sessions", {
				branchId,
			}),

		listReceipts: () => client.get<WalkInReceipt[]>("/api/v1/walk-in/receipts"),
	};
}
