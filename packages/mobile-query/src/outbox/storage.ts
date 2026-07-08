import type { MobileAppId } from "../app-id";
import { getMmkvStorage } from "../mmkv-storage";
import type { OutboxEntry, OutboxMutationType } from "./types";

export function outboxStorageKey(appId: MobileAppId): string {
	return `talash-outbox-${appId}`;
}

function readRaw(appId: MobileAppId): OutboxEntry[] {
	const storage = getMmkvStorage(appId);
	const raw = storage.getString(outboxStorageKey(appId));
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as OutboxEntry[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeRaw(appId: MobileAppId, entries: OutboxEntry[]): void {
	const storage = getMmkvStorage(appId);
	if (entries.length === 0) {
		storage.delete(outboxStorageKey(appId));
		return;
	}
	storage.set(outboxStorageKey(appId), JSON.stringify(entries));
}

export function loadOutbox(appId: MobileAppId): OutboxEntry[] {
	return readRaw(appId);
}

export function enqueueOutboxEntry(
	appId: MobileAppId,
	entry: Omit<OutboxEntry, "createdAt" | "retryCount" | "status"> & {
		createdAt?: number;
		retryCount?: number;
		status?: OutboxEntry["status"];
	},
): OutboxEntry {
	const full: OutboxEntry = {
		...entry,
		createdAt: entry.createdAt ?? Date.now(),
		retryCount: entry.retryCount ?? 0,
		status: entry.status ?? "pending",
	};
	const entries = readRaw(appId);
	entries.push(full);
	writeRaw(appId, entries);
	return full;
}

export function updateOutboxEntry(
	appId: MobileAppId,
	id: string,
	patch: Partial<Pick<OutboxEntry, "retryCount" | "status">>,
): void {
	const entries = readRaw(appId).map((entry) =>
		entry.id === id ? { ...entry, ...patch } : entry,
	);
	writeRaw(appId, entries);
}

export function removeOutboxEntry(appId: MobileAppId, id: string): void {
	writeRaw(
		appId,
		readRaw(appId).filter((entry) => entry.id !== id),
	);
}

export function clearOutbox(appId: MobileAppId): void {
	writeRaw(appId, []);
}

export function hasPendingOutboxForBooking(
	appId: MobileAppId,
	bookingId: string,
): boolean {
	return readRaw(appId).some((entry) => {
		if (entry.status !== "pending") return false;
		if (!entry.mutationType.startsWith("bookings.")) return false;
		const payload = entry.payload as { id?: string } | string | null;
		if (typeof payload === "string") return payload === bookingId;
		return payload?.id === bookingId;
	});
}

export function createOutboxId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isOutboxMutationType(
	value: string,
): value is OutboxMutationType {
	return (
		value === "bookings.confirm" ||
		value === "bookings.cancel" ||
		value === "bookings.complete" ||
		value === "bookings.assign" ||
		value === "favourites.add" ||
		value === "favourites.remove" ||
		value === "notifications.markRead" ||
		value === "notifications.markAllRead"
	);
}
