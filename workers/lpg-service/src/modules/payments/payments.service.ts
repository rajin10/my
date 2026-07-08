import type { PaymentsRepository } from "@repo/core/src/database/repositories/payments.repository";
import type { PaymentSelect } from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import { NotFoundError, ValidationError } from "../../core/errors";

export interface RecordPaymentInput {
	businessId: string;
	userId: string;
	amount: number;
	note?: string;
	orderId?: string;
}

export class PaymentsService {
	constructor(
		private readonly repo: PaymentsRepository,
		private readonly authz: AuthorizationService,
	) {}

	async record(
		actorId: string,
		input: RecordPaymentInput,
	): Promise<PaymentSelect> {
		if (!Number.isInteger(input.amount) || input.amount <= 0)
			throw new ValidationError("amount must be a positive integer");
		await this.authz.assertBusinessOwner(actorId, input.businessId);
		// `orderId` is an optional audit tag (never used in the khata derivation),
		// but when supplied it must reference a real order of THIS business and
		// customer — a dangling or foreign id would make the tag misleading.
		if (input.orderId) {
			const order = await this.authz.assertOrderAccess(
				actorId,
				input.orderId,
				null,
			);
			if (
				order.businessId !== input.businessId ||
				order.userId !== input.userId
			)
				throw new ValidationError(
					"orderId does not reference an order for this customer and business",
				);
		}
		return this.repo.create({
			businessId: input.businessId,
			userId: input.userId,
			amount: input.amount,
			note: input.note ?? null,
			recordedBy: actorId,
			orderId: input.orderId ?? null,
		});
	}

	async void(actorId: string, paymentId: string): Promise<void> {
		const payment = await this.repo.findOne(paymentId);
		if (!payment) throw new NotFoundError("Payment not found");
		await this.authz.assertBusinessOwner(actorId, payment.businessId);
		await this.repo.voidPayment(paymentId, new Date().toISOString());
	}
}
