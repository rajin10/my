import { getDB } from "@repo/core/src/database/client";
import { AuthRepository } from "@repo/core/src/database/repositories/auth.repository";
import { CouponsRepository } from "@repo/core/src/database/repositories/coupons.repository";
import { RewardsRepository } from "@repo/core/src/database/repositories/rewards.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { logger } from "@repo/core/src/logger";
import { QueueProducer } from "@repo/core/src/queue/producer";

const WORKER = "scheduled";

type CronHandler = (
	env: CloudflareBindings,
	scheduledTime: number,
) => Promise<void>;

const CRON_HANDLERS: Record<string, CronHandler> = {
	"0 0 * * *": expireOldCoupons,
	"0 2 * * *": pruneExpiredRefreshTokens,
	"0 4 * * 0": reconcileRewardBalances,
};

export async function handleScheduled(
	controller: ScheduledController,
	env: CloudflareBindings,
): Promise<void> {
	const handler = CRON_HANDLERS[controller.cron];
	if (!handler) {
		logger.warn(WORKER, "No handler for cron expression", {
			cron: controller.cron,
		});
		return;
	}
	try {
		await handler(env, controller.scheduledTime);
	} catch (err) {
		logger.error(WORKER, "Cron handler threw", {
			cron: controller.cron,
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

async function expireOldCoupons(
	env: CloudflareBindings,
	scheduledTime: number,
): Promise<void> {
	const now = new Date(scheduledTime).toISOString();
	const db = getDB();
	const expired = await new CouponsRepository(db).expireOld(now);
	logger.info(WORKER, "Expired old coupons", { count: expired.length, now });

	if (expired.length === 0) return;

	// Enqueue push notifications to each unique business owner
	const businessesRepo = new BusinessesRepository(db);
	const queue = new QueueProducer(env.TALASH_QUEUE);

	const seenBusinesses = new Set<string>();
	for (const coupon of expired) {
		if (seenBusinesses.has(coupon.businessId)) continue;

		const business = await businessesRepo.findOne(coupon.businessId);
		const ownerId = business.data?.ownerId;
		if (!ownerId) continue;

		// Mark seen only after a successful owner lookup so that a missing owner
		// on one coupon does not suppress notifications for later coupons from the
		// same business (e.g. after the business is re-assigned).
		seenBusinesses.add(coupon.businessId);

		await queue.send({
			type: "notification.coupon_expired",
			ownerId,
			businessId: coupon.businessId,
		});
		logger.info(WORKER, "Queued expired coupon notification", {
			ownerId,
			businessId: coupon.businessId,
		});
	}
}

async function pruneExpiredRefreshTokens(
	_env: CloudflareBindings,
	scheduledTime: number,
): Promise<void> {
	const now = new Date(scheduledTime).toISOString();
	const count = await new AuthRepository(getDB()).deleteExpiredRefreshTokens(
		now,
	);
	logger.info(WORKER, "Pruned expired refresh tokens", { count, now });
}

async function reconcileRewardBalances(
	_env: CloudflareBindings,
	scheduledTime: number,
): Promise<void> {
	const now = new Date(scheduledTime).toISOString();
	const repo = new RewardsRepository(getDB());
	const drifts = await repo.findDriftingBalances();
	if (drifts.length === 0) {
		logger.info(WORKER, "Reward balance reconciliation: no drift found", {
			now,
		});
		return;
	}
	for (const row of drifts) {
		logger.warn(WORKER, "Reward balance drift detected", {
			userId: row.userId,
			stored: row.balance,
			computed: row.computed,
			diff: row.computed - row.balance,
		});
		await repo.setBalance(row.userId, row.computed);
	}
	logger.info(WORKER, "Reward balance reconciliation complete", {
		fixed: drifts.length,
		now,
	});
}
