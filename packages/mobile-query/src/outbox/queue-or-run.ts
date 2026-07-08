import type { MobileAppId } from "../app-id";
import { useNetworkStatus } from "../use-network-status";
import { type QueueOrRunArgs, queueOrRunSync } from "./queue-or-run-sync";

export type { QueueOrRunArgs } from "./queue-or-run-sync";
export { queueOrRunSync } from "./queue-or-run-sync";

export function useQueueOrRun(appId: MobileAppId) {
	const { isOnline } = useNetworkStatus();

	return (args: Omit<QueueOrRunArgs, "appId">) =>
		queueOrRunSync({ ...args, appId, isOnline });
}
