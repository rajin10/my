import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../client";
import type { BranchHoursInsert, BranchHoursSelect } from "../schema";
import { branchHoursSchema } from "../schema";

export class BranchHoursRepository {
	constructor(private readonly db: DbClient) {}

	async findByBranch(branchId: string): Promise<BranchHoursSelect[]> {
		return this.db
			.select()
			.from(branchHoursSchema)
			.where(
				and(
					eq(branchHoursSchema.branchId, branchId),
					isNull(branchHoursSchema.deletedAt),
				),
			)
			.orderBy(branchHoursSchema.dayOfWeek);
	}

	async upsertDay(data: BranchHoursInsert): Promise<BranchHoursSelect> {
		const now = new Date().toISOString();
		const existing = await this.db
			.select()
			.from(branchHoursSchema)
			.where(
				and(
					eq(branchHoursSchema.branchId, data.branchId),
					eq(branchHoursSchema.dayOfWeek, data.dayOfWeek),
					isNull(branchHoursSchema.deletedAt),
				),
			)
			.get();

		if (existing) {
			const [updated] = await this.db
				.update(branchHoursSchema)
				.set({
					openTime: data.openTime,
					closeTime: data.closeTime,
					isClosed: data.isClosed,
					updatedAt: now,
				})
				.where(eq(branchHoursSchema.id, existing.id))
				.returning();
			return updated;
		}

		const id = crypto.randomUUID();
		const [created] = await this.db
			.insert(branchHoursSchema)
			.values({ ...data, id, createdAt: now })
			.returning();
		return created;
	}

	async findForSlot(
		branchId: string,
		dayOfWeek: number,
	): Promise<BranchHoursSelect | undefined> {
		return this.db
			.select()
			.from(branchHoursSchema)
			.where(
				and(
					eq(branchHoursSchema.branchId, branchId),
					eq(branchHoursSchema.dayOfWeek, dayOfWeek),
					isNull(branchHoursSchema.deletedAt),
				),
			)
			.get();
	}
}
