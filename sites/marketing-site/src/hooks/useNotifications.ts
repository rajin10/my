"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useNotifications(enabled: boolean) {
	return useQuery({
		queryKey: ["notifications"],
		queryFn: () => api.notifications.list({ limit: 50 }),
		enabled,
		staleTime: 30_000,
	});
}

export function useMarkNotificationRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api.notifications.markRead(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});
}

export function useMarkAllNotificationsRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api.notifications.markAllRead(),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});
}
