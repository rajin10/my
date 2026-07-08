import type { MobileAppId } from "../app-id";
import { isQueueableMutation } from "./allowlist";
import { createOutboxId, enqueueOutboxEntry } from "./storage";
import type { OutboxMutationType } from "./types";

export type QueueOrRunArgs = {
	appId: MobileAppId;
	mutationType: OutboxMutationType;
	payload: unknown;
	onOnline: () => void;
	onQueued?: () => void;
	onBlocked?: () => void;
};

/** Pure helper for tests and non-hook call sites. */
export function queueOrRunSync(
	args: QueueOrRunArgs & { isOnline: boolean },
): boolean {
	const {
		appId,
		mutationType,
		payload,
		isOnline,
		onOnline,
		onQueued,
		onBlocked,
	} = args;

	if (isOnline) {
		onOnline();
		return true;
	}

	if (!isQueueableMutation(mutationType, appId)) {
		onBlocked?.();
		return false;
	}

	enqueueOutboxEntry(appId, {
		id: createOutboxId(),
		mutationType,
		payload,
	});
	onQueued?.();
	return true;
}
