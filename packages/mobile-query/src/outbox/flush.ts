import type { MobileAppId } from "../app-id";
import { loadOutbox, removeOutboxEntry, updateOutboxEntry } from "./storage";
import type {
	FlushOutboxResult,
	OutboxExecutorMap,
	OutboxExecutorResult,
} from "./types";

const MAX_RETRIES = 5;

function isConflictResult(result: OutboxExecutorResult | undefined): boolean {
	return result?.conflict === true;
}

function isAuthError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		(error as { status?: number }).status === 401
	);
}

export async function flushOutbox(
	appId: MobileAppId,
	executors: OutboxExecutorMap,
): Promise<FlushOutboxResult> {
	const entries = loadOutbox(appId).filter(
		(entry) => entry.status === "pending",
	);
	let processed = 0;
	let failed = 0;
	let conflicts = 0;

	for (const entry of entries) {
		const executor = executors[entry.mutationType];
		if (!executor) {
			updateOutboxEntry(appId, entry.id, { status: "failed" });
			failed += 1;
			continue;
		}

		try {
			const result = await executor(entry.payload);
			if (isConflictResult(result)) {
				removeOutboxEntry(appId, entry.id);
				conflicts += 1;
				processed += 1;
				continue;
			}
			removeOutboxEntry(appId, entry.id);
			processed += 1;
		} catch (error) {
			if (isAuthError(error)) {
				return { processed, failed, conflicts, paused: true };
			}

			const nextRetry = entry.retryCount + 1;
			if (nextRetry >= MAX_RETRIES) {
				updateOutboxEntry(appId, entry.id, {
					retryCount: nextRetry,
					status: "failed",
				});
				failed += 1;
				continue;
			}

			updateOutboxEntry(appId, entry.id, { retryCount: nextRetry });
			return { processed, failed, conflicts, paused: true };
		}
	}

	return { processed, failed, conflicts, paused: false };
}
