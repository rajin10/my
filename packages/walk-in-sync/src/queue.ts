import type { WalkInSubmitBody } from "@repo/api-client";
import type { WalkInAppId } from "./app-id";
import { getWalkInMmkv } from "./mmkv-storage";
import type { WalkInQueueEntry, WalkInQueueStatus } from "./types";

function storageKey(appId: WalkInAppId): string {
	return `walk-in-queue-${appId}`;
}

function readRaw(appId: WalkInAppId): WalkInQueueEntry[] {
	const raw = getWalkInMmkv(appId).getString(storageKey(appId));
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as WalkInQueueEntry[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeRaw(appId: WalkInAppId, entries: WalkInQueueEntry[]): void {
	const storage = getWalkInMmkv(appId);
	if (entries.length === 0) {
		storage.delete(storageKey(appId));
		return;
	}
	storage.set(storageKey(appId), JSON.stringify(entries));
}

export function loadWalkInQueue(appId: WalkInAppId): WalkInQueueEntry[] {
	return readRaw(appId);
}

export function enqueueWalkInSubmission(
	appId: WalkInAppId,
	submission: WalkInSubmitBody,
): WalkInQueueEntry {
	const entries = readRaw(appId);
	const existing = entries.find((e) => e.localId === submission.localId);
	if (existing) return existing;

	const entry: WalkInQueueEntry = {
		localId: submission.localId,
		submission,
		status: "pending",
		createdAt: Date.now(),
	};
	entries.push(entry);
	writeRaw(appId, entries);
	return entry;
}

export function updateWalkInQueueEntry(
	appId: WalkInAppId,
	localId: string,
	patch: Partial<Pick<WalkInQueueEntry, "status" | "serverId">>,
): void {
	writeRaw(
		appId,
		readRaw(appId).map((entry) =>
			entry.localId === localId ? { ...entry, ...patch } : entry,
		),
	);
}

export function removeWalkInQueueEntry(
	appId: WalkInAppId,
	localId: string,
): void {
	writeRaw(
		appId,
		readRaw(appId).filter((entry) => entry.localId !== localId),
	);
}

export function clearWalkInQueue(appId: WalkInAppId): void {
	writeRaw(appId, []);
}

export function pendingWalkInCount(appId: WalkInAppId): number {
	return readRaw(appId).filter((e) => e.status === "pending").length;
}

export function listWalkInByStatus(
	appId: WalkInAppId,
	status: WalkInQueueStatus,
): WalkInQueueEntry[] {
	return readRaw(appId).filter((e) => e.status === status);
}
