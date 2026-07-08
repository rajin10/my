import { ApiError } from "@repo/api-client";
import type { OutboxExecutorMap } from "@repo/mobile-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";

function isBookingConflict(error: unknown): boolean {
	return (
		error instanceof ApiError && (error.status === 409 || error.status === 422)
	);
}

async function runBookingAction(
	action: () => Promise<unknown>,
	qc: QueryClient,
): Promise<{ conflict?: boolean } | undefined> {
	try {
		await action();
		await qc.invalidateQueries({ queryKey: ["bookings"] });
	} catch (error) {
		if (isBookingConflict(error)) {
			await qc.invalidateQueries({ queryKey: ["bookings"] });
			return { conflict: true };
		}
		throw error;
	}
}

export function createOwnerOutboxExecutors(qc: QueryClient): OutboxExecutorMap {
	return {
		"bookings.confirm": async (payload) => {
			const { id } = payload as { id: string };
			return runBookingAction(() => api.bookings.confirm(id), qc);
		},
		"bookings.cancel": async (payload) => {
			const { id } = payload as { id: string };
			return runBookingAction(() => api.bookings.cancel(id), qc);
		},
		"bookings.complete": async (payload) => {
			const { id } = payload as { id: string };
			return runBookingAction(() => api.bookings.complete(id), qc);
		},
		"bookings.assign": async (payload) => {
			const { id, staffId } = payload as { id: string; staffId: string };
			return runBookingAction(() => api.bookings.assign(id, { staffId }), qc);
		},
		"notifications.markRead": async (payload) => {
			const { id } = payload as { id: string };
			await api.notifications.markRead(id);
			await qc.invalidateQueries({ queryKey: ["notifications"] });
		},
		"notifications.markAllRead": async () => {
			await api.notifications.markAllRead();
			await qc.invalidateQueries({ queryKey: ["notifications"] });
		},
	};
}
