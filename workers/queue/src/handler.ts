import { getDB } from "@repo/core/src/database/client";
import { AuthRepository } from "@repo/core/src/database/repositories/auth.repository";
import { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import { CampaignsRepository } from "@repo/core/src/database/repositories/campaigns.repository";
import { NotificationsRepository } from "@repo/core/src/database/repositories/notifications.repository";
import { OrdersRepository } from "@repo/core/src/database/repositories/orders.repository";
import { ReviewsRepository } from "@repo/core/src/database/repositories/reviews.repository";
import { RewardsRepository } from "@repo/core/src/database/repositories/rewards.repository";
import type {
	NotificationTypeValue,
	OrderStatusType,
} from "@repo/core/src/database/schema";
import { logger } from "@repo/core/src/logger";
import { RewardsService } from "@repo/core/src/modules/rewards/rewards.service";
import type { JobPayload } from "@repo/core/src/queue/jobs";

const WORKER = "queue";

interface Repos {
	auth: AuthRepository;
	bookings: BookingsRepository;
	branches: BranchesRepository;
	campaigns: CampaignsRepository;
	rewards: RewardsRepository;
	reviews: ReviewsRepository;
	businesses: BusinessesRepository;
	orders: OrdersRepository;
	notifications: NotificationsRepository;
}

export async function handleQueue(
	batch: MessageBatch<JobPayload>,
	env: CloudflareBindings,
): Promise<void> {
	// Create repository instances once per batch — not per message — to avoid
	// redundant getDB() calls and object allocation overhead.
	const db = getDB();
	const repos: Repos = {
		auth: new AuthRepository(db),
		bookings: new BookingsRepository(db),
		branches: new BranchesRepository(db),
		campaigns: new CampaignsRepository(db),
		rewards: new RewardsRepository(db),
		reviews: new ReviewsRepository(db),
		businesses: new BusinessesRepository(db),
		orders: new OrdersRepository(db),
		notifications: new NotificationsRepository(db),
	};

	for (const msg of batch.messages) {
		try {
			await dispatch(msg.body, env, repos);
			msg.ack();
		} catch (err) {
			logger.error(WORKER, "Job failed — will retry", {
				jobType: msg.body.type,
				error: err instanceof Error ? err.message : String(err),
			});
			msg.retry();
		}
	}
}

async function dispatch(
	job: JobPayload,
	_env: CloudflareBindings,
	repos: Repos,
): Promise<void> {
	switch (job.type) {
		case "rewards.credit":
			return handleRewardsCredit(job, repos);

		case "notification.booking_created":
			return handleBookingNotification(job.bookingId, "created", repos);
		case "notification.booking_cancelled":
			return handleBookingNotification(job.bookingId, "cancelled", repos);
		case "notification.review_pending":
			return handleReviewPending(job.reviewId, repos);
		case "notification.order_status_changed":
			return handleOrderStatusNotification(job.orderId, job.status, repos);

		case "campaign.send":
			return handleCampaignSend(job.campaignId, repos);
		case "notification.coupon_expired":
			return handleCouponExpiredNotification(
				job.ownerId,
				job.businessId,
				repos,
			);
	}
}

interface PushResult {
	delivered: boolean;
	/** True when Expo reports DeviceNotRegistered — caller should clear the token. */
	deviceNotRegistered: boolean;
}

async function sendExpoPush(
	token: string,
	title: string,
	body: string,
): Promise<PushResult> {
	const res = await fetch("https://exp.host/--/api/v2/push/send", {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ to: token, title, body, sound: "default" }),
	});

	if (!res.ok) {
		logger.error(WORKER, "Expo push HTTP error", { status: res.status });
		return { delivered: false, deviceNotRegistered: false };
	}

	const json = (await res.json()) as {
		data: Array<{ status: string; details?: { error?: string } }>;
	};
	let delivered = true;
	let deviceNotRegistered = false;

	for (const item of json.data ?? []) {
		if (item.status === "error") {
			delivered = false;
			if (item.details?.error === "DeviceNotRegistered") {
				deviceNotRegistered = true;
			}
			logger.error(WORKER, "Expo push delivery error", {
				error: item.details?.error,
			});
		}
	}

	return { delivered, deviceNotRegistered };
}

/**
 * Send a push and clear the stored token if Expo reports it as stale.
 *
 * Best-effort: a push is a secondary side-effect of a job whose durable result
 * is the already-recorded in-app notification row. `sendExpoPush` already
 * swallows Expo HTTP errors; this also swallows the remaining throw paths
 * (fetch network exception, `res.json()` parse failure, `clearPushToken` write)
 * so a transport failure is logged rather than propagated. Propagating would
 * retry the whole job and — because notifications have no dedup key — write a
 * duplicate in-app row. DB failures earlier in the handler still throw and
 * retry; only push delivery is downgraded to best-effort.
 */
async function pushAndCleanup(
	userId: string,
	token: string,
	title: string,
	body: string,
	authRepo: AuthRepository,
): Promise<void> {
	try {
		const result = await sendExpoPush(token, title, body);
		if (result.deviceNotRegistered) {
			await authRepo.clearPushToken(userId);
			logger.info(WORKER, "Cleared stale push token", { userId });
		}
	} catch (err) {
		logger.error(WORKER, "Push delivery failed — best-effort, not retried", {
			userId,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

async function recordInAppNotification(
	repo: NotificationsRepository,
	params: {
		userId: string;
		type: NotificationTypeValue;
		title: string;
		body: string;
		go?: "bookings" | "reviews" | "orders";
		businessId?: string;
		bookingId?: string;
		reviewId?: string;
		orderId?: string;
		/**
		 * Deterministic per-event idempotency key. A queue retry of the same event
		 * carries the same key, so the unique index makes the re-insert a no-op
		 * (no duplicate in-app row). Omit for one-off notifications.
		 */
		dedupeKey?: string;
	},
): Promise<void> {
	await repo.create({
		userId: params.userId,
		type: params.type,
		title: params.title,
		body: params.body,
		go: params.go ?? null,
		businessId: params.businessId ?? null,
		bookingId: params.bookingId ?? null,
		reviewId: params.reviewId ?? null,
		orderId: params.orderId ?? null,
		dedupeKey: params.dedupeKey ?? null,
		readAt: null,
	});
}

async function handleBookingNotification(
	bookingId: string,
	event: "created" | "cancelled",
	{ auth, bookings, branches, businesses, notifications }: Repos,
): Promise<void> {
	const bookingResult = await bookings.findOne(bookingId);
	const booking = bookingResult.data;
	if (!booking) {
		logger.warn(WORKER, "Booking not found for notification", {
			bookingId,
			event,
		});
		return;
	}

	const title = event === "created" ? "Booking received" : "Booking cancelled";
	const customerBody =
		event === "created"
			? "Your booking request has been received and is awaiting confirmation."
			: "Your booking has been cancelled.";

	const notifType: NotificationTypeValue =
		event === "created" ? "booking" : "cancel";

	// Notify the customer
	const customer = await auth.findUserById(booking.userId as string);
	if (customer) {
		await recordInAppNotification(notifications, {
			userId: customer.id,
			type: notifType,
			title,
			body: customerBody,
			bookingId,
			dedupeKey: `booking_${event}:${bookingId}:${customer.id}`,
		});
		if (customer.pushToken) {
			await pushAndCleanup(
				customer.id,
				customer.pushToken,
				title,
				customerBody,
				auth,
			);
			logger.info(WORKER, `Sent ${event} push to customer`, {
				userId: customer.id,
			});
		}
	}

	// Notify the business owner
	const branchResult = await branches.findOne(booking.branchId as string);
	const businessId = branchResult.data?.businessId;
	if (businessId) {
		const businessResult = await businesses.findOne(businessId as string);
		const ownerId = businessResult.data?.ownerId;
		if (ownerId) {
			const owner = await auth.findUserById(ownerId as string);
			if (owner) {
				const ownerTitle =
					event === "created" ? "New booking" : "Booking cancelled";
				const ownerBody =
					event === "created"
						? "A new booking has been placed for one of your services."
						: "A customer has cancelled their booking.";
				await recordInAppNotification(notifications, {
					userId: owner.id,
					type: notifType,
					title: ownerTitle,
					body: ownerBody,
					go: "bookings",
					businessId: businessId as string,
					bookingId,
					dedupeKey: `booking_${event}:${bookingId}:${owner.id}`,
				});
				if (owner.pushToken) {
					await pushAndCleanup(
						owner.id,
						owner.pushToken,
						ownerTitle,
						ownerBody,
						auth,
					);
					logger.info(WORKER, `Sent ${event} push to business owner`, {
						ownerId,
					});
				}
			}
		}
	}
}

async function handleReviewPending(
	reviewId: string,
	{ auth, reviews, businesses, notifications }: Repos,
): Promise<void> {
	const reviewResult = await reviews.findOne(reviewId);
	const review = reviewResult.data;
	if (!review) {
		logger.warn(WORKER, "Review not found for notification", { reviewId });
		return;
	}

	const businessResult = await businesses.findOne(review.businessId as string);
	const ownerId = businessResult.data?.ownerId;
	if (!ownerId) return;

	const owner = await auth.findUserById(ownerId as string);
	if (owner) {
		const title = "New review";
		const body = "A customer has left a review awaiting your moderation.";
		await recordInAppNotification(notifications, {
			userId: owner.id,
			type: "review",
			title,
			body,
			go: "reviews",
			businessId: review.businessId as string,
			reviewId,
			dedupeKey: `review_pending:${reviewId}:${owner.id}`,
		});
		if (owner.pushToken) {
			await pushAndCleanup(owner.id, owner.pushToken, title, body, auth);
			logger.info(WORKER, "Sent review_pending push to business owner", {
				ownerId,
				reviewId,
			});
		}
	}
}

async function handleOrderStatusNotification(
	orderId: string,
	status: OrderStatusType,
	{ auth, orders, notifications }: Repos,
): Promise<void> {
	const orderResult = await orders.findOne(orderId);
	const order = orderResult.data;
	if (!order) {
		logger.warn(WORKER, "Order not found for notification", {
			orderId,
			status,
		});
		return;
	}

	// Pending (order placement) is intentionally not notified — only owner-driven transitions are.
	const COPY: Partial<
		Record<OrderStatusType, { title: string; body: string }>
	> = {
		Confirmed: {
			title: "Order confirmed",
			body: "Your order has been confirmed and is being prepared.",
		},
		OutForDelivery: {
			title: "Out for delivery",
			body: "Your order is on its way.",
		},
		Delivered: {
			title: "Order delivered",
			body: "Your order has been delivered. Enjoy!",
		},
		Cancelled: {
			title: "Order cancelled",
			body: "Your order has been cancelled.",
		},
	};
	const copy = COPY[status];
	if (!copy) {
		logger.warn(WORKER, "No notification copy for order status — skipping", {
			orderId,
			status,
		});
		return;
	}

	const customer = await auth.findUserById(order.userId as string);
	if (!customer) {
		logger.warn(WORKER, "Customer not found for order notification", {
			orderId,
			userId: order.userId,
		});
		return;
	}

	// Order cancellations get their own type so the mobile client can render a
	// distinct icon — booking cancellations stay on "cancel" (handleBookingNotification).
	const notifType: NotificationTypeValue =
		status === "Cancelled" ? "order_cancelled" : "order";
	await recordInAppNotification(notifications, {
		userId: customer.id,
		type: notifType,
		title: copy.title,
		body: copy.body,
		go: "orders",
		businessId: order.businessId as string,
		orderId,
		// Status is forward-only + terminal cancel, so it never repeats for an
		// order — each transition keys a distinct notification; only retries dedup.
		dedupeKey: `order:${orderId}:${status}:${customer.id}`,
	});
	if (customer.pushToken) {
		await pushAndCleanup(
			customer.id,
			customer.pushToken,
			copy.title,
			copy.body,
			auth,
		);
		logger.info(WORKER, "Sent order status push to customer", {
			userId: customer.id,
			status,
		});
	}
}

async function handleCampaignSend(
	campaignId: string,
	{ auth, bookings, campaigns }: Repos,
): Promise<void> {
	const campaign = await campaigns.findOne(campaignId);
	if (!campaign) {
		logger.warn(WORKER, "Campaign not found — skipping", { campaignId });
		return;
	}
	if (campaign.status === "Sent") {
		logger.warn(WORKER, "Campaign already sent — skipping duplicate", {
			campaignId,
		});
		return;
	}

	// Mark Sent before fan-out so that any retry triggered by a mid-loop failure
	// hits the "already sent" guard above and does not re-deliver to all customers.
	await campaigns.updateOne(campaignId, {
		status: "Sent",
		sentAt: new Date().toISOString(),
	});

	// Fan out to all customers who have confirmed/completed bookings at this business
	const customers = await bookings.findCustomersByBusiness(
		campaign.businessId as string,
	);
	let sent = 0;
	for (const customer of customers) {
		if (!customer.pushToken) continue;
		// Best-effort per customer: the campaign is marked Sent before fan-out, so a
		// retry would only hit the "already sent" guard and silently drop everyone
		// after the failure point. Isolate each push so one customer's transport
		// failure (fetch reject, json parse, clearPushToken write) cannot abort the
		// loop or bubble up to msg.retry().
		try {
			const result = await sendExpoPush(
				customer.pushToken,
				campaign.name as string,
				campaign.message as string,
			);
			if (result.deviceNotRegistered) {
				await auth.clearPushToken(customer.userId);
			}
			if (result.delivered) sent++;
		} catch (err) {
			logger.error(WORKER, "Campaign push failed for customer — skipping", {
				campaignId,
				userId: customer.userId,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	logger.info(WORKER, "Campaign pushed to customers", {
		campaignId,
		businessId: campaign.businessId,
		totalCustomers: customers.length,
		sent,
	});
}

async function handleRewardsCredit(
	job: Extract<JobPayload, { type: "rewards.credit" }>,
	{ bookings, rewards }: Repos,
): Promise<void> {
	const bookingResult = await bookings.findOne(job.bookingId);
	const booking = bookingResult.data;
	if (!booking) {
		logger.warn(WORKER, "Booking not found for rewards credit — skipping", {
			bookingId: job.bookingId,
		});
		return;
	}

	const amountPaid = (booking.price as number) - (booking.discount as number);
	const rewardsService = new RewardsService(rewards);
	await rewardsService.creditForBooking(job.userId, job.bookingId, amountPaid);
	logger.info(WORKER, "Credited rewards for booking", {
		bookingId: job.bookingId,
		userId: job.userId,
	});
}

async function handleCouponExpiredNotification(
	ownerId: string,
	businessId: string,
	{ auth, notifications }: Repos,
): Promise<void> {
	const owner = await auth.findUserById(ownerId);
	if (!owner) return;

	const title = "Coupons expired";
	const body = "One or more of your coupons have expired.";

	await recordInAppNotification(notifications, {
		userId: owner.id,
		type: "system",
		title,
		body,
		businessId,
		// Day-bucketed: the cron may fire this on different days for the same
		// business, each a legitimately new notification; only same-day retries
		// dedup.
		dedupeKey: `coupon_expired:${businessId}:${owner.id}:${new Date().toISOString().slice(0, 10)}`,
	});

	if (owner.pushToken) {
		await pushAndCleanup(owner.id, owner.pushToken, title, body, auth);
		logger.info(WORKER, "Sent coupon_expired push to business owner", {
			ownerId,
			businessId,
		});
	}
}
