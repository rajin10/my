import { getDB } from "@repo/core/src/database/client";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { CustomerAddressesRepository } from "@repo/core/src/database/repositories/customer-addresses.repository";
import { KhataRepository } from "@repo/core/src/database/repositories/khata.repository";
import { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import { ProductsRepository } from "@repo/core/src/database/repositories/products.repository";
import { QueueProducer } from "@repo/core/src/queue/producer";
import { createMiddleware } from "hono/factory";
import { AuthorizationService } from "../core/authorization";
import { R2Storage } from "../core/storage/r2";
import type { AppEnv } from "../types";
import type { ServiceInstaller, SharedDeps } from "./shared-deps";

export type { ServiceInstaller, SharedDeps };

export function injectServices(installers: readonly ServiceInstaller[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const db = getDB();

		const businessesRepo = new BusinessesRepository(db);
		const branchesRepo = new BranchesRepository(db);
		const productsRepo = new ProductsRepository(db);
		const ordersRepo = new OrdersRepository(db);
		const customerAddressesRepo = new CustomerAddressesRepository(db);
		const paymentsRepo = new PaymentsRepository(db);
		const khataRepo = new KhataRepository(db);

		const deps: SharedDeps = {
			db,
			queue: new QueueProducer(c.env.TALASH_QUEUE!),
			storage: new R2Storage(
				c.env.TALASH_STORAGE!,
				c.env.PUBLIC_R2_URL ?? "storage.mahannankhan.info",
			),
			kv: c.env.TALASH_KV,
			authz: new AuthorizationService(
				businessesRepo,
				branchesRepo,
				productsRepo,
				ordersRepo,
				customerAddressesRepo,
			),
			env: c.env,
			businessesRepo,
			branchesRepo,
			productsRepo,
			ordersRepo,
			customerAddressesRepo,
			paymentsRepo,
			khataRepo,
		};

		c.set("authz", deps.authz);
		c.set("scopedBranchIds", null);

		for (const install of installers) {
			install(c, deps);
		}

		await next();
	});
}
