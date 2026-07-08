import type {
	CustomerDue,
	DeliveredOrderRow,
	KhataDueRow,
	KhataRepository,
} from "@repo/core/src/database/repositories/khata.repository";
import type { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import type { PaymentSelect } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";

export interface CustomerLedger extends CustomerDue {
	userId: string;
	name: string;
	deliveredOrders: DeliveredOrderRow[];
	payments: PaymentSelect[];
}

export class KhataService {
	constructor(
		private readonly khataRepo: KhataRepository,
		private readonly paymentsRepo: PaymentsRepository,
		private readonly authz: AuthorizationService,
	) {}

	async dues(actorId: string, businessId: string): Promise<KhataDueRow[]> {
		await this.authz.assertBusinessOwner(actorId, businessId);
		return this.khataRepo.businessDues(businessId);
	}

	async customerLedger(
		actorId: string,
		businessId: string,
		userId: string,
	): Promise<CustomerLedger> {
		await this.authz.assertBusinessOwner(actorId, businessId);
		const [
			{ due, totalDelivered, totalPaid },
			deliveredOrders,
			payments,
			rawName,
		] = await Promise.all([
			this.khataRepo.customerDue(businessId, userId),
			this.khataRepo.deliveredOrders(businessId, userId),
			this.paymentsRepo.findByBusinessCustomer(businessId, userId),
			this.khataRepo.customerName(userId),
		]);
		const name = rawName ?? "Unknown";
		return {
			userId,
			name,
			due,
			totalDelivered,
			totalPaid,
			deliveredOrders,
			payments,
		};
	}
}
