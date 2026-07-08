import type { ApiClient } from "../client";
import type { KhataCustomer, KhataDue } from "../types";

export function createKhataEndpoints(client: ApiClient) {
	return {
		dues: (businessId: string) =>
			client.get<KhataDue[]>("/api/v1/khata/dues", { businessId }),
		customerLedger: (userId: string, businessId: string) =>
			client.get<KhataCustomer>(`/api/v1/khata/customers/${userId}`, {
				businessId,
			}),
	};
}
