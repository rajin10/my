import { vi } from "vitest";
import type { AuthorizationService } from "../../core/authorization";
import { createApp } from "../../core/create-app";
import { corsMiddleware } from "../../middleware/cors";
import { errorHandler, notFoundHandler } from "../../middleware/exceptions";
import { queryParserMiddleware } from "../../middleware/query-parser";
import { customerAddressesApp } from "../../modules/customer-addresses";
import type { CustomerAddressesService } from "../../modules/customer-addresses/customer-addresses.service";
import { khataApp } from "../../modules/khata";
import type { KhataService } from "../../modules/khata/khata.service";
import { ordersApp } from "../../modules/orders";
import type { OrdersService } from "../../modules/orders/orders.service";
import { paymentsApp } from "../../modules/payments";
import type { PaymentsService } from "../../modules/payments/payments.service";
import { productsApp } from "../../modules/products";
import type { ProductsService } from "../../modules/products/products.service";
import { searchApp } from "../../modules/search";
import type { SearchService } from "../../modules/search/search.service";
import type { AuthUser } from "../../types";

export interface MockServices {
	productsService?: Partial<ProductsService>;
	ordersService?: Partial<OrdersService>;
	customerAddressesService?: Partial<CustomerAddressesService>;
	paymentsService?: Partial<PaymentsService>;
	khataService?: Partial<KhataService>;
	searchService?: Partial<SearchService>;
	authz?: Partial<AuthorizationService>;
}

export function createTestApp(services: MockServices = {}) {
	const app = createApp({ strict: false });

	app.use("*", corsMiddleware);
	app.use("*", queryParserMiddleware);

	const defaultAuthz = {
		assertBusinessOwner: vi.fn().mockResolvedValue({
			id: "business-1",
			ownerId: "owner-1",
		}),
		assertBranchAccess: vi.fn().mockResolvedValue(undefined),
		assertProductAccess: vi.fn().mockResolvedValue({
			id: "product-1",
			branchId: "branch-1",
		}),
		assertOrderAccess: vi.fn().mockResolvedValue({
			id: "order-1",
			branchId: "branch-1",
		}),
		assertCustomerOwnsOrder: vi.fn().mockResolvedValue({
			id: "order-1",
			userId: "test-user-id",
		}),
		assertCustomerOwnsAddress: vi.fn().mockResolvedValue({
			id: "addr-1",
			userId: "test-user-id",
		}),
	};

	app.use("*", async (c, next) => {
		// @ts-expect-error test-only AUTH_SERVICE stub
		c.env.AUTH_SERVICE ??= {
			fetch: async (_req: Request | string, init?: RequestInit) => {
				const bodyText =
					typeof init?.body === "string"
						? init.body
						: JSON.stringify(init?.body);
				const parsed = (bodyText ? JSON.parse(bodyText) : {}) as {
					branchScope?: boolean;
				};

				const authHeader =
					(init?.headers as Record<string, string> | undefined)
						?.Authorization ?? "";
				const token = authHeader.startsWith("Bearer ")
					? authHeader.slice(7)
					: "";
				const role = (() => {
					try {
						const [, payloadB64] = token.split(".");
						if (!payloadB64) return "manager";
						const payloadJson = Buffer.from(payloadB64, "base64url").toString(
							"utf8",
						);
						const payload = JSON.parse(payloadJson) as { role?: string };
						return payload.role ?? "manager";
					} catch {
						return "manager";
					}
				})();

				const scopedBranchIds =
					parsed.branchScope && role === "owner"
						? null
						: parsed.branchScope
							? ["branch-1"]
							: null;

				return new Response(JSON.stringify({ scopedBranchIds }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
		};

		c.set("authz", {
			...defaultAuthz,
			...services.authz,
		} as AuthorizationService);
		c.set("scopedBranchIds", null);
		for (const [key, value] of Object.entries(services)) {
			if (key === "authz") continue;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			c.set(key as any, value);
		}
		await next();
	});

	app.route("/api/v1/products", productsApp);
	app.route("/api/v1/orders", ordersApp);
	app.route("/api/v1/customer-addresses", customerAddressesApp);
	app.route("/api/v1/payments", paymentsApp);
	app.route("/api/v1/khata", khataApp);
	app.route("/api/v1/search", searchApp);

	app.notFound(notFoundHandler);
	app.onError(errorHandler);

	return app;
}
