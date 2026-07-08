import type { MobileAppId } from "../app-id";

export const OUTBOX_MUTATION_TYPES = [
	"bookings.confirm",
	"bookings.cancel",
	"bookings.complete",
	"bookings.assign",
	"favourites.add",
	"favourites.remove",
	"notifications.markRead",
	"notifications.markAllRead",
] as const;

export type OutboxMutationType = (typeof OUTBOX_MUTATION_TYPES)[number];

export type OutboxEntryStatus = "pending" | "failed";

export type OutboxEntry = {
	id: string;
	mutationType: OutboxMutationType;
	payload: unknown;
	createdAt: number;
	retryCount: number;
	status: OutboxEntryStatus;
};

export type OutboxExecutorResult = {
	conflict?: boolean;
};

export type OutboxExecutor = (
	payload: unknown,
) => Promise<OutboxExecutorResult | undefined>;

export type OutboxExecutorMap = Partial<
	Record<OutboxMutationType, OutboxExecutor>
>;

export type FlushOutboxResult = {
	processed: number;
	failed: number;
	conflicts: number;
	paused: boolean;
};

export type OutboxSnapshot = {
	entries: OutboxEntry[];
	pendingCount: number;
	failedCount: number;
};

export type OutboxContext = {
	appId: MobileAppId;
};
