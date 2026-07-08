import type { ApiClient } from "../client";
import type { AppNotification } from "../types";

export function createNotificationsEndpoints(client: ApiClient) {
	return {
		list: (params?: { limit?: number }) =>
			client.get<AppNotification[]>("/api/v1/notifications", params),

		markRead: (id: string) =>
			client.patch<AppNotification>(`/api/v1/notifications/${id}/read`),

		markAllRead: () =>
			client.post<{ updated: number }>("/api/v1/notifications/read-all"),
	};
}
