import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { bookingsSchema, branchesSchema, usersSchema } from "../schema";

export type CustomerTier = "VIP" | "Regular" | "New" | "AtRisk";

export interface CustomerSummary {
	userId: string;
	name: string;
	email: string | null;
	phone: string | null;
	totalVisits: number;
	totalSpend: number;
	avgSpend: number;
	lastVisit: string | null;
	firstVisit: string | null;
	tier: CustomerTier;
}

export interface CustomerVisit {
	id: string;
	slot: string;
	status: string;
	price: number;
	discount: number;
	serviceId: string;
}

function deriveTier(
	visits: number,
	spend: number,
	lastVisit: string | null,
	allSpends: number[],
): CustomerTier {
	if (!lastVisit) return "New";
	const daysSinceLast = Math.floor(
		(Date.now() - new Date(lastVisit).getTime()) / 86400000,
	);
	if (daysSinceLast > 60 && visits > 1) return "AtRisk";
	if (visits === 1) return "New";
	const sortedSpends = [...allSpends].sort((a, b) => b - a);
	const top20Index = Math.ceil(sortedSpends.length * 0.2);
	const top20Threshold = sortedSpends[top20Index - 1] ?? 0;
	if (visits >= 5 || spend >= top20Threshold) return "VIP";
	return "Regular";
}

export class CustomersRepository {
	constructor(private readonly db: DbClient) {}

	private async getBranchIds(businessId: string): Promise<string[]> {
		const branches = await this.db
			.select({ id: branchesSchema.id })
			.from(branchesSchema)
			.where(
				and(
					eq(branchesSchema.businessId, businessId),
					isNull(branchesSchema.deletedAt),
				),
			);
		return branches.map((b) => b.id);
	}

	async listByBusiness(businessId: string): Promise<CustomerSummary[]> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return [];

		const rows = await this.db
			.select({
				userId: bookingsSchema.userId,
				name: usersSchema.name,
				email: usersSchema.email,
				phone: usersSchema.phone,
				totalVisits: sql<number>`count(*)`,
				totalSpend: sql<number>`sum(${bookingsSchema.price} - ${bookingsSchema.discount})`,
				avgSpend: sql<number>`avg(${bookingsSchema.price} - ${bookingsSchema.discount})`,
				lastVisit: sql<string>`max(${bookingsSchema.slot})`,
				firstVisit: sql<string>`min(${bookingsSchema.slot})`,
			})
			.from(bookingsSchema)
			.leftJoin(usersSchema, eq(bookingsSchema.userId, usersSchema.id))
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					sql`${bookingsSchema.status} != 'Cancelled'`,
				),
			)
			.groupBy(bookingsSchema.userId)
			.orderBy(
				sql`sum(${bookingsSchema.price} - ${bookingsSchema.discount}) desc`,
			);

		const allSpends = rows.map((r) => Number(r.totalSpend) || 0);

		return rows.map((r) => {
			const visits = Number(r.totalVisits);
			const spend = Number(r.totalSpend) || 0;
			return {
				userId: r.userId,
				name: r.name ?? "Customer",
				email: r.email ?? null,
				phone: r.phone ?? null,
				totalVisits: visits,
				totalSpend: spend,
				avgSpend: Math.round(Number(r.avgSpend) || 0),
				lastVisit: r.lastVisit ?? null,
				firstVisit: r.firstVisit ?? null,
				tier: deriveTier(visits, spend, r.lastVisit ?? null, allSpends),
			};
		});
	}

	async getCustomerVisits(
		businessId: string,
		userId: string,
	): Promise<CustomerVisit[]> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return [];

		const rows = await this.db
			.select({
				id: bookingsSchema.id,
				slot: bookingsSchema.slot,
				status: bookingsSchema.status,
				price: bookingsSchema.price,
				discount: bookingsSchema.discount,
				serviceId: bookingsSchema.serviceId,
			})
			.from(bookingsSchema)
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					eq(bookingsSchema.userId, userId),
					isNull(bookingsSchema.deletedAt),
				),
			)
			.orderBy(sql`${bookingsSchema.slot} desc`);

		return rows;
	}
}
