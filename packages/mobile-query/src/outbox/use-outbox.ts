import { useCallback, useEffect, useState } from "react";
import type { MobileAppId } from "../app-id";
import { hasPendingOutboxForBooking, loadOutbox } from "./storage";
import type { OutboxEntry, OutboxSnapshot } from "./types";

function snapshotFromEntries(entries: OutboxEntry[]): OutboxSnapshot {
	return {
		entries,
		pendingCount: entries.filter((e) => e.status === "pending").length,
		failedCount: entries.filter((e) => e.status === "failed").length,
	};
}

export function useOutbox(appId: MobileAppId) {
	const [snapshot, setSnapshot] = useState<OutboxSnapshot>(() =>
		snapshotFromEntries(loadOutbox(appId)),
	);

	const refresh = useCallback(() => {
		setSnapshot(snapshotFromEntries(loadOutbox(appId)));
	}, [appId]);

	useEffect(() => {
		refresh();
		const interval = setInterval(refresh, 2_000);
		return () => clearInterval(interval);
	}, [refresh]);

	const hasPendingForBooking = useCallback(
		(bookingId: string) => hasPendingOutboxForBooking(appId, bookingId),
		[appId],
	);

	return {
		...snapshot,
		refresh,
		hasPendingForBooking,
	};
}
