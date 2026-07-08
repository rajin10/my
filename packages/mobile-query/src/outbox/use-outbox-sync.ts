import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { MobileAppId } from "../app-id";
import { useNetworkStatus } from "../use-network-status";
import { flushOutbox } from "./flush";
import type { OutboxExecutorMap } from "./types";

export function useOutboxSync(
	appId: MobileAppId,
	executors: OutboxExecutorMap,
	enabled = true,
	onConflict?: () => void,
) {
	const { isOnline } = useNetworkStatus();
	const flushing = useRef(false);
	const executorsRef = useRef(executors);
	const onConflictRef = useRef(onConflict);
	executorsRef.current = executors;
	onConflictRef.current = onConflict;

	const runFlush = () => {
		if (!enabled || !isOnline || flushing.current) return;
		flushing.current = true;
		void flushOutbox(appId, executorsRef.current)
			.then((result) => {
				if (result.conflicts > 0) onConflictRef.current?.();
			})
			.finally(() => {
				flushing.current = false;
			});
	};

	useEffect(() => {
		runFlush();
	}, [runFlush]);

	useEffect(() => {
		if (!enabled) return;

		const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
			if (state === "active") runFlush();
		});

		return () => sub.remove();
	}, [enabled, runFlush]);
}
