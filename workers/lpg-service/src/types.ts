import type { RequestIdVariables } from "hono/request-id";
import type { AuthorizationService } from "./core/authorization";
import type { CustomerAddressesService } from "./modules/customer-addresses/customer-addresses.service";
import type { KhataService } from "./modules/khata/khata.service";
import type { OrdersService } from "./modules/orders/orders.service";
import type { PaymentsService } from "./modules/payments/payments.service";
import type { ProductsService } from "./modules/products/products.service";
import type { SearchService } from "./modules/search/search.service";
import type { WalkInService } from "./modules/walk-in/walk-in.service";

export interface AuthUser {
	id: string;
	email: string | null;
	name: string;
	role: string;
}

export type AppContext = {
	Bindings: CloudflareBindings;

	Variables: RequestIdVariables & {
		parsedQuery: Record<string, unknown>;
		user?: AuthUser;
		scopedBranchIds: string[] | null;
		authz: AuthorizationService;
		productsService: ProductsService;
		ordersService: OrdersService;
		customerAddressesService: CustomerAddressesService;
		paymentsService: PaymentsService;
		khataService: KhataService;
		searchService: SearchService;
		walkInService: WalkInService;
	};
};

export type AppEnv = AppContext;
