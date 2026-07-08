import type { ApiClient } from "../client";
import type { CustomerAddress } from "../types";

export interface AddressBody {
	label?: string;
	line: string;
	area?: string;
	city?: string;
	lat?: number;
	lng?: number;
	isDefault?: boolean;
}

export function createCustomerAddressesEndpoints(client: ApiClient) {
	return {
		list: () => client.get<CustomerAddress[]>("/api/v1/customer-addresses"),
		create: (body: AddressBody) =>
			client.post<CustomerAddress>("/api/v1/customer-addresses", body),
		update: (id: string, body: Partial<AddressBody>) =>
			client.patch<CustomerAddress>(`/api/v1/customer-addresses/${id}`, body),
		remove: (id: string) =>
			client.delete<CustomerAddress>(`/api/v1/customer-addresses/${id}`),
	};
}
