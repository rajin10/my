import type { AddressBody, PlaceOrderBody } from "@repo/api-client";
import { useOnlineGuard } from "@repo/mobile-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "../components/Toast";
import { useApp } from "../context";
import { adaptCustomerAddress, adaptOrder } from "../lib/adapters";
import { api } from "../lib/api";

export function useBranchProducts(branchId: string | undefined) {
	return useQuery({
		queryKey: ["products", "branch", branchId],
		queryFn: () => api.products.list(branchId as string),
		enabled: !!branchId,
		staleTime: 60_000,
	});
}

export function useAddresses() {
	const { isAuthed } = useApp();
	return useQuery({
		queryKey: ["addresses", "list"],
		queryFn: async () =>
			(await api.customerAddresses.list()).map(adaptCustomerAddress),
		enabled: isAuthed,
		staleTime: 60_000,
	});
}

export function useSaveAddress() {
	const qc = useQueryClient();
	const ensureOnline = useOnlineGuard((message) =>
		toast.show({ message, tone: "info" }),
	);
	return useMutation({
		mutationFn: (body: AddressBody) => {
			if (!ensureOnline()) {
				return Promise.reject(new Error("offline"));
			}
			return api.customerAddresses.create(body);
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses", "list"] }),
	});
}

export function useMyOrders() {
	const { isAuthed } = useApp();
	return useQuery({
		queryKey: ["orders", "mine"],
		queryFn: async () =>
			(await api.orders.listMine()).map((o) => adaptOrder(o)),
		enabled: isAuthed,
		staleTime: 30_000,
	});
}

export function useOrder(
	id: string,
	resolveName?: (productId: string) => string | undefined,
) {
	return useQuery({
		queryKey: ["order", id],
		queryFn: async () => adaptOrder(await api.orders.get(id), resolveName),
		staleTime: 0,
		retry: false,
	});
}

export function useCreateOrder() {
	const qc = useQueryClient();
	const ensureOnline = useOnlineGuard((message) =>
		toast.show({ message, tone: "info" }),
	);
	return useMutation({
		mutationFn: (body: PlaceOrderBody) => {
			if (!ensureOnline()) {
				return Promise.reject(new Error("offline"));
			}
			return api.orders.create(body);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["orders", "mine"] });
		},
	});
}

export function useCancelOrder() {
	const qc = useQueryClient();
	const ensureOnline = useOnlineGuard((message) =>
		toast.show({ message, tone: "info" }),
	);
	return useMutation({
		mutationFn: (id: string) => {
			if (!ensureOnline()) {
				return Promise.reject(new Error("offline"));
			}
			return api.orders.cancel(id);
		},
		onSuccess: (_data, id) => {
			qc.invalidateQueries({ queryKey: ["orders", "mine"] });
			qc.invalidateQueries({ queryKey: ["order", id] });
		},
	});
}
