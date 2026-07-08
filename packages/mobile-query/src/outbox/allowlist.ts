import type { MobileAppId } from "../app-id";
import type { OutboxMutationType } from "./types";

const OWNER_QUEUEABLE: OutboxMutationType[] = [
	"bookings.confirm",
	"bookings.cancel",
	"bookings.complete",
	"bookings.assign",
	"notifications.markRead",
	"notifications.markAllRead",
];

const CUSTOMER_QUEUEABLE: OutboxMutationType[] = [
	"favourites.add",
	"favourites.remove",
	"bookings.cancel",
	"notifications.markRead",
	"notifications.markAllRead",
];

const BY_APP: Record<MobileAppId, readonly OutboxMutationType[]> = {
	"owner-app": OWNER_QUEUEABLE,
	"mobile-app": CUSTOMER_QUEUEABLE,
};

export function isQueueableMutation(
	mutationType: OutboxMutationType,
	appId: MobileAppId,
): boolean {
	return BY_APP[appId].includes(mutationType);
}

export function queueableMutationsForApp(
	appId: MobileAppId,
): readonly OutboxMutationType[] {
	return BY_APP[appId];
}
