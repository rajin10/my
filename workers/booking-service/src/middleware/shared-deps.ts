import type { getDB } from "@repo/core/src/database/client";
import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import type { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
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
	servicesRepo: ServicesRepository;
	couponsRepo: CouponsRepository;
	bookingsRepo: BookingsRepository;
	teamRepo: TeamRepository;
	reviewsRepo: ReviewsRepository;
}

export type ServiceInstaller = (c: Context<AppEnv>, deps: SharedDeps) => void;
