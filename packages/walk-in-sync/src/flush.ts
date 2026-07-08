import type { TalashApi } from "@repo/api-client";
import type { WalkInAppId } from "./app-id";
import { WALK_IN_SYNC_BATCH_SIZE } from "./constants";
import { loadWalkInQueue, updateWalkInQueueEntry } from "./queue";

export type FlushWalkInResult = {
	synced: Record<string, string>;
	failed: string[];
};

export async function flushWalkInQueue(
	appId: WalkInAppId,
	api: TalashApi,
): Promise<FlushWalkInResult> {
	const pending = loadWalkInQueue(appId).filter((e) => e.status === "pending");
	if (pending.length === 0) {
		return { synced: {}, failed: [] };
	}

	const synced: Record<string, string> = {};
	const failed: string[] = [];

	for (let i = 0; i < pending.length; i += WALK_IN_SYNC_BATCH_SIZE) {
		const batch = pending.slice(i, i + WALK_IN_SYNC_BATCH_SIZE);
		try {
			const res = await api.walkIn.sync(batch.map((e) => e.submission));
			for (const [localId, serverId] of Object.entries(res.synced ?? {})) {
				synced[localId] = serverId;
				updateWalkInQueueEntry(appId, localId, {
					status: "synced",
					serverId,
				});
			}
		} catch {
			for (const entry of batch) {
				failed.push(entry.localId);
				updateWalkInQueueEntry(appId, entry.localId, { status: "failed" });
			}
		}
	}

	return { synced, failed };
}
