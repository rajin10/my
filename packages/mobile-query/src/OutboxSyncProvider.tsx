import type { ReactNode } from "react";
import type { MobileAppId } from "./app-id";
import type { OutboxExecutorMap } from "./outbox/types";
import { useOutboxSync } from "./outbox/use-outbox-sync";

type OutboxSyncProviderProps = {
	appId: MobileAppId;
	executors: OutboxExecutorMap;
	enabled?: boolean;
	onConflict?: () => void;
	children: ReactNode;
};

export function OutboxSyncProvider({
	appId,
	executors,
	enabled = true,
	onConflict,
	children,
}: OutboxSyncProviderProps) {
	useOutboxSync(appId, executors, enabled, onConflict);
	return children;
}
