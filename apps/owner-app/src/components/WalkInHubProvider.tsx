import type { WalkInSubmitBody } from "@repo/api-client";
import { useNetworkStatus } from "@repo/mobile-query";
import {
	enqueueWalkInSubmission,
	flushWalkInQueue,
	loadWalkInQueue,
	startWalkInHub,
	useWalkInQueue,
	type WalkInHubHandle,
	type WalkInQueueEntry,
} from "@repo/walk-in-sync";
import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useApp } from "../context";
import { api } from "../lib/api";
import { OWNER_APP_ID } from "../lib/query-client";
import { buildWalkInSnapshotFromCache } from "../lib/walk-in-snapshot";

type WalkInHubContextValue = {
	walkInModeActive: boolean;
	setWalkInModeActive: (active: boolean) => void;
	hubStatus: "inactive" | "starting" | "broadcasting" | "unavailable";
	pendingWalkIns: WalkInQueueEntry[];
	refreshQueue: () => void;
};

const WalkInHubContext = createContext<WalkInHubContextValue | null>(null);

export function WalkInHubProvider({ children }: { children: ReactNode }) {
	const qc = useQueryClient();
	const { isOnline } = useNetworkStatus();
	const {
		business,
		businessId,
		services,
		products,
		branch,
		apiBranches,
		flash,
	} = useApp();
	const [walkInModeActive, setWalkInModeActive] = useState(false);
	const [hubStatus, setHubStatus] =
		useState<WalkInHubContextValue["hubStatus"]>("inactive");
	const hubRef = useRef<WalkInHubHandle | null>(null);
	const wasOfflineRef = useRef(!isOnline);
	const { pendingEntries, refresh: refreshQueue } =
		useWalkInQueue(OWNER_APP_ID);

	const branchMeta = useMemo(() => {
		if (branch === "All branches") return null;
		const row = apiBranches.find((b) => b.name === branch);
		if (!row) return null;
		return { id: row.id, name: row.name };
	}, [apiBranches, branch]);

	const flushPending = useCallback(async () => {
		const result = await flushWalkInQueue(OWNER_APP_ID, api);
		if (Object.keys(result.synced).length > 0) {
			refreshQueue();
			void qc.invalidateQueries({ queryKey: ["bookings"] });
			void qc.invalidateQueries({ queryKey: ["branch-orders"] });
		}
	}, [qc, refreshQueue]);

	useEffect(() => {
		if (isOnline && wasOfflineRef.current) {
			void flushPending();
		}
		wasOfflineRef.current = !isOnline;
	}, [isOnline, flushPending]);

	useEffect(() => {
		const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
			if (state === "active" && isOnline) {
				void flushPending();
			}
		});
		return () => sub.remove();
	}, [isOnline, flushPending]);

	useEffect(() => {
		if (!walkInModeActive || !branchMeta || !businessId) {
			setHubStatus("inactive");
			void hubRef.current?.stop();
			hubRef.current = null;
			return;
		}

		let cancelled = false;

		const start = async () => {
			setHubStatus("starting");
			const handle = await startWalkInHub(
				{
					getContext: () =>
						buildWalkInSnapshotFromCache(qc, {
							branchId: branchMeta.id,
							branchName: branchMeta.name,
							businessId,
							businessName: business.name,
							vertical: business.vertical ?? "booking",
							services,
							products,
						}),
					onSubmit: async (submission: WalkInSubmitBody) => {
						enqueueWalkInSubmission(OWNER_APP_ID, submission);
						refreshQueue();
						return { localId: submission.localId };
					},
					onLookup: async (localId: string) =>
						loadWalkInQueue(OWNER_APP_ID).find((e) => e.localId === localId),
				},
				{
					publish: {
						name: `Talash-${branchMeta.id.slice(0, 8)}`,
						branchId: branchMeta.id,
						businessId,
						vertical: business.vertical ?? "booking",
					},
				},
			);

			if (cancelled) {
				await handle?.stop();
				return;
			}

			if (!handle) {
				setHubStatus("unavailable");
				flash("LAN hub needs a development build — online QR still works.");
				return;
			}

			hubRef.current = handle;
			setHubStatus("broadcasting");
		};

		void start();

		return () => {
			cancelled = true;
			void hubRef.current?.stop();
			hubRef.current = null;
		};
	}, [
		walkInModeActive,
		branchMeta,
		businessId,
		business,
		services,
		products,
		qc,
		flash,
		refreshQueue,
	]);

	const value = useMemo(
		() => ({
			walkInModeActive,
			setWalkInModeActive,
			hubStatus,
			pendingWalkIns: pendingEntries,
			refreshQueue,
		}),
		[walkInModeActive, hubStatus, pendingEntries, refreshQueue],
	);

	return (
		<WalkInHubContext.Provider value={value}>
			{children}
		</WalkInHubContext.Provider>
	);
}

export function useWalkInHub() {
	const ctx = useContext(WalkInHubContext);
	if (!ctx) {
		throw new Error("useWalkInHub must be used within WalkInHubProvider");
	}
	return ctx;
}
