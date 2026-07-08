import { getDB } from "@repo/core/src/database/client";
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
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
		const servicesRepo = new ServicesRepository(db);
		const couponsRepo = new CouponsRepository(db);
		const bookingsRepo = new BookingsRepository(db);
		const teamRepo = new TeamRepository(db);
		const reviewsRepo = new ReviewsRepository(db);

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
				servicesRepo,
				couponsRepo,
				bookingsRepo,
				teamRepo,
				reviewsRepo,
			),
			env: c.env,
			businessesRepo,
			branchesRepo,
			servicesRepo,
			couponsRepo,
			bookingsRepo,
			teamRepo,
			reviewsRepo,
		};

		c.set("authz", deps.authz);
		c.set("scopedBranchIds", null);

		for (const install of installers) {
			install(c, deps);
		}

		await next();
	});
}
