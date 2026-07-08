import type { getDB } from "@repo/core/src/database/client";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import type { KhataRepository } from "@repo/core/src/database/repositories/khata.repository";
import type { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import type { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import type { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import type { QueueProducer } from "@repo/core/src/queue/producer";
import type { Context } from "hono";
import type { AuthorizationService } from "../core/authorization";
import type { R2Storage } from "../core/storage/r2";
import type { AppEnv } from "../types";

export interface SharedDeps {
	db: ReturnType<typeof getDB>;
	queue: QueueProducer;
	storage: R2Storage;
	kv: KVNamespace | undefined;
	authz: AuthorizationService;
	env: CloudflareBindings;
	businessesRepo: BusinessesRepository;
	branchesRepo: BranchesRepository;
	productsRepo: ProductsRepository;
	ordersRepo: OrdersRepository;
	customerAddressesRepo: CustomerAddressesRepository;
	paymentsRepo: PaymentsRepository;
	khataRepo: KhataRepository;
}

export type ServiceInstaller = (c: Context<AppEnv>, deps: SharedDeps) => void;
