import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../client";
import type { FavouriteInsert, FavouriteSelect } from "../schema";
import { favouritesSchema } from "../schema";

export class FavouritesRepository {
	constructor(private readonly db: DbClient) {}

	async findByUser(userId: string): Promise<FavouriteSelect[]> {
		return this.db
			.select()
			.from(favouritesSchema)
			.where(
				and(
					eq(favouritesSchema.userId, userId),
					isNull(favouritesSchema.deletedAt),
				),
			);
	}

	async findOne(
		userId: string,
		businessId: string,
	): Promise<FavouriteSelect | null> {
		const rows = await this.db
			.select()
			.from(favouritesSchema)
			.where(
				and(
					eq(favouritesSchema.userId, userId),
					eq(favouritesSchema.businessId, businessId),
					isNull(favouritesSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async add(data: FavouriteInsert): Promise<FavouriteSelect> {
		const rows = await this.db
			.insert(favouritesSchema)
			.values(data)
			.returning();
		return rows[0];
	}

	async remove(userId: string, businessId: string): Promise<void> {
		await this.db
			.delete(favouritesSchema)
			.where(
				and(
					eq(favouritesSchema.userId, userId),
					eq(favouritesSchema.businessId, businessId),
				),
			);
	}
}
