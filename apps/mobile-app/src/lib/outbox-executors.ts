import { ApiError } from "@repo/api-client";
import type { OutboxExecutorMap } from "@repo/mobile-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api";

function isBookingConflict(error: unknown): boolean {
	return (
		error instanceof ApiError && (error.status === 409 || error.status === 422)
	);
}

export function createMobileOutboxExecutors(
	qc: QueryClient,
): OutboxExecutorMap {
	return {
		"favourites.add": async (payload) => {
			const { businessId } = payload as { businessId: string };
			await api.favourites.add(businessId);
			await qc.invalidateQueries({ queryKey: ["favourites", "list"] });
		},
		"favourites.remove": async (payload) => {
			const { businessId } = payload as { businessId: string };
			await api.favourites.remove(businessId);
			await qc.invalidateQueries({ queryKey: ["favourites", "list"] });
		},
		"bookings.cancel": async (payload) => {
			const { id } = payload as { id: string };
			try {
				await api.bookings.cancel(id);
				await qc.invalidateQueries({ queryKey: ["bookings", "my"] });
			} catch (error) {
				if (isBookingConflict(error)) {
					await qc.invalidateQueries({ queryKey: ["bookings", "my"] });
					return { conflict: true };
				}
				throw error;
			}
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
