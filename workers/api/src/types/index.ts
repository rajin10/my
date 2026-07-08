import type { RequestIdVariables } from "hono/request-id";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { AuthorizationService } from "../core/authorization";
import type { AuthService } from "../modules/auth/auth.service";
import type { BranchesService } from "../modules/branches/branches.service";
import type { BusinessesService } from "../modules/businesses/businesses.service";
import type { CustomerAddressesService } from "../modules/customer-addresses/customer-addresses.service";
import type { DemoRequestsService } from "../modules/demo-requests/demo-requests.service";
import type { FavouritesService } from "../modules/favourites/favourites.service";
import type { KhataService } from "../modules/khata/khata.service";
import type { NotificationsService } from "../modules/notifications/notifications.service";
import type { OrdersService } from "../modules/orders/orders.service";
import type { PaymentsService } from "../modules/payments/payments.service";
import type { ProductsService } from "../modules/products/products.service";
import type { UsersService } from "../modules/users/users.service";

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
		permissions: string[];
		// null = unrestricted (owner); string[] = allowed branch IDs (manager/staff)
		scopedBranchIds: string[] | null;
		// Authorization service — populated by injectServices middleware
		authz: AuthorizationService;
		branchesRepo: BranchesRepository;
		businessesRepo: BusinessesRepository;
		// Services — populated by injectServices middleware
		authService: AuthService;
		usersService: UsersService;
		businessesService: BusinessesService;
		branchesService: BranchesService;
		productsService: ProductsService;
		ordersService: OrdersService;
		customerAddressesService: CustomerAddressesService;
		notificationsService: NotificationsService;
		paymentsService: PaymentsService;
		khataService: KhataService;
		favouritesService: FavouritesService;
		demoRequestsService: DemoRequestsService;
	};
};

export type AppEnv = AppContext;
