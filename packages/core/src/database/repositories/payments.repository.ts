import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../client";
import type { PaymentInsert, PaymentSelect } from "../schema";
import { paymentsSchema } from "../schema";

export class PaymentsRepository {
	constructor(private readonly db: DbClient) {}

	async create(input: PaymentInsert): Promise<PaymentSelect> {
		const [row] = await this.db
			.insert(paymentsSchema)
			.values(input)
			.returning();
		return row;
	}

	/** Live (non-voided) payment by id. */
	async findOne(id: string): Promise<PaymentSelect | null> {
		const [row] = await this.db
			.select()
			.from(paymentsSchema)
			.where(and(eq(paymentsSchema.id, id), isNull(paymentsSchema.deletedAt)));
		return row ?? null;
	}

	/** Void = soft-delete; the derived balance self-corrects. */
	async voidPayment(id: string, deletedAt: string): Promise<void> {
		await this.db
			.update(paymentsSchema)
			.set({ deletedAt })
			.where(eq(paymentsSchema.id, id));
	}

	/** A customer's live payment history for one business, newest first. */
	async findByBusinessCustomer(
		businessId: string,
		userId: string,
	): Promise<PaymentSelect[]> {
		return this.db
			.select()
			.from(paymentsSchema)
			.where(
				and(
					eq(paymentsSchema.businessId, businessId),
					eq(paymentsSchema.userId, userId),
					isNull(paymentsSchema.deletedAt),
				),
			)
			.orderBy(desc(paymentsSchema.createdAt));
	}
}
