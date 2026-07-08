import { useCallback, useEffect, useState } from "react";
import type { WalkInAppId } from "./app-id";
import { loadWalkInQueue, pendingWalkInCount } from "./queue";
import type { WalkInQueueEntry } from "./types";

export function useWalkInQueue(appId: WalkInAppId) {
	const [entries, setEntries] = useState<WalkInQueueEntry[]>(() =>
		loadWalkInQueue(appId),
	);

	const refresh = useCallback(() => {
		setEntries(loadWalkInQueue(appId));
	}, [appId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return {
		entries,
		pendingCount: pendingWalkInCount(appId),
		pendingEntries: entries.filter((e) => e.status === "pending"),
		refresh,
	};
}
