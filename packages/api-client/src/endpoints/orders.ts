import type { ApiClient } from "../client";
import type { Order, OrderStatus, OrderWithItems } from "../types";

export interface PlaceOrderBody {
	branchId: string;
	addressId: string;
	items: { productId: string; quantity: number }[];
}

export function createOrdersEndpoints(client: ApiClient) {
	return {
		create: (body: PlaceOrderBody) =>
			client.post<Order>("/api/v1/orders", body),
		listMine: () => client.get<Order[]>("/api/v1/orders"),
		cancel: (id: string) =>
			client.patch<void>(`/api/v1/orders/${id}/cancel`, {}),
		listByBranch: (branchId: string) =>
			client.get<Order[]>("/api/v1/orders/branch", { branchId }),
		get: (id: string) => client.get<OrderWithItems>(`/api/v1/orders/${id}`),
		updateStatus: (id: string, status: OrderStatus) =>
			client.patch<Order>(`/api/v1/orders/${id}/status`, { status }),
	};
}
