import type { WalkInSubmitBody } from "@repo/api-client";

export type WalkInQueueStatus = "pending" | "synced" | "failed";

export type WalkInQueueEntry = {
	localId: string;
	submission: WalkInSubmitBody;
	status: WalkInQueueStatus;
	createdAt: number;
	serverId?: string;
};

export type DiscoveredHub = {
	host: string;
	port: number;
	branchId: string;
	businessId: string;
	vertical: string;
};

export type WalkInHubStatus =
	| "inactive"
	| "starting"
	| "broadcasting"
	| "unavailable";

export type WalkInLanStatus = "idle" | "searching" | "connected" | "not_found";
