import type { ApiClient } from "../client";
import type { Payment } from "../types";

export interface RecordPaymentBody {
	businessId: string;
	userId: string;
	amount: number;
	note?: string;
	orderId?: string;
}

export function createPaymentsEndpoints(client: ApiClient) {
	return {
		record: (body: RecordPaymentBody) =>
			client.post<Payment>("/api/v1/payments", body),
		void: (id: string) => client.delete<void>(`/api/v1/payments/${id}`),
	};
}
