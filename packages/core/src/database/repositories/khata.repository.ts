import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { ordersSchema, paymentsSchema, usersSchema } from "../schema";

export interface KhataDueRow {
	userId: string;
	name: string;
	due: number;
}

export interface CustomerDue {
	due: number;
	totalDelivered: number;
	totalPaid: number;
}

export interface DeliveredOrderRow {
	id: string;
	total: number;
	deliveredAt: string | null;
}

export class KhataRepository {
	constructor(private readonly db: DbClient) {}

	/** Σ delivered-order totals − Σ payments, for one (business, customer). */
	async customerDue(businessId: string, userId: string): Promise<CustomerDue> {
		const [orders] = await this.db
			.select({
				total: sql<number>`coalesce(sum(${ordersSchema.total}), 0)`,
			})
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.businessId, businessId),
					eq(ordersSchema.userId, userId),
					eq(ordersSchema.status, "Delivered"),
					isNull(ordersSchema.deletedAt),
				),
			);
		const [pay] = await this.db
			.select({
				total: sql<number>`coalesce(sum(${paymentsSchema.amount}), 0)`,
			})
			.from(paymentsSchema)
			.where(
				and(
					eq(paymentsSchema.businessId, businessId),
					eq(paymentsSchema.userId, userId),
					isNull(paymentsSchema.deletedAt),
				),
			);
		const totalDelivered = Number(orders?.total ?? 0);
		const totalPaid = Number(pay?.total ?? 0);
		return { due: totalDelivered - totalPaid, totalDelivered, totalPaid };
	}

	/** Customers with due > 0 for a business, with names, highest due first. */
	async businessDues(businessId: string): Promise<KhataDueRow[]> {
		const delivered = await this.db
			.select({
				userId: ordersSchema.userId,
				total: sql<number>`coalesce(sum(${ordersSchema.total}), 0)`,
			})
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.businessId, businessId),
					eq(ordersSchema.status, "Delivered"),
					isNull(ordersSchema.deletedAt),
				),
			)
			.groupBy(ordersSchema.userId);

		const paid = await this.db
			.select({
				userId: paymentsSchema.userId,
				total: sql<number>`coalesce(sum(${paymentsSchema.amount}), 0)`,
			})
			.from(paymentsSchema)
			.where(
				and(
					eq(paymentsSchema.businessId, businessId),
					isNull(paymentsSchema.deletedAt),
				),
			)
			.groupBy(paymentsSchema.userId);

		const paidMap = new Map(paid.map((p) => [p.userId, Number(p.total)]));
		const dues = delivered
			.map((d) => ({
				userId: d.userId,
				due: Number(d.total) - (paidMap.get(d.userId) ?? 0),
			}))
			.filter((d) => d.due > 0);
		if (dues.length === 0) return [];

		const ids = dues.map((d) => d.userId);
		const users = await this.db
			.select({ id: usersSchema.id, name: usersSchema.name })
			.from(usersSchema)
			.where(inArray(usersSchema.id, ids));
		const nameMap = new Map(users.map((u) => [u.id, u.name]));

		return dues
			.map((d) => ({
				userId: d.userId,
				name: nameMap.get(d.userId) ?? "Unknown",
				due: d.due,
			}))
			.sort((a, b) => b.due - a.due);
	}

	/** Delivered orders (the debits) for the per-customer ledger. */
	async deliveredOrders(
		businessId: string,
		userId: string,
	): Promise<DeliveredOrderRow[]> {
		return this.db
			.select({
				id: ordersSchema.id,
				total: ordersSchema.total,
				deliveredAt: ordersSchema.deliveredAt,
			})
			.from(ordersSchema)
			.where(
				and(
					eq(ordersSchema.businessId, businessId),
					eq(ordersSchema.userId, userId),
					eq(ordersSchema.status, "Delivered"),
					isNull(ordersSchema.deletedAt),
				),
			);
	}

	/** Customer display name for the ledger header. */
	async customerName(userId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ name: usersSchema.name })
			.from(usersSchema)
			.where(eq(usersSchema.id, userId));
		return row?.name ?? null;
	}
}
