import type { OrderStatusType } from "../database/schema";

export type BaseJob = { requestId?: string };

export type JobPayload =
	| (BaseJob & { type: "notification.booking_created"; bookingId: string })
	| (BaseJob & { type: "notification.booking_cancelled"; bookingId: string })
	| (BaseJob & {
			type: "notification.order_status_changed";
			orderId: string;
			status: OrderStatusType;
	  })
	| (BaseJob & { type: "notification.review_pending"; reviewId: string })
	| (BaseJob & { type: "rewards.credit"; userId: string; bookingId: string })
	| (BaseJob & { type: "campaign.send"; campaignId: string })
	| (BaseJob & {
			type: "notification.coupon_expired";
			ownerId: string;
			businessId: string;
	  });
