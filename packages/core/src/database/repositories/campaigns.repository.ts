import { and, eq, isNull } from "drizzle-orm";
import type { ApiResponse } from "../../http/response";
import type { DbClient } from "../client";
import type { CampaignInsert, CampaignSelect } from "../schema";
import { campaignsSchema } from "../schema";
import { BaseRepository } from "./base.repository";

export class CampaignsRepository {
	constructor(private readonly db: DbClient) {}

	async findByBusiness(businessId: string): Promise<CampaignSelect[]> {
		return this.db
			.select()
			.from(campaignsSchema)
			.where(
				and(
					eq(campaignsSchema.businessId, businessId),
					isNull(campaignsSchema.deletedAt),
				),
			)
			.orderBy(campaignsSchema.createdAt);
	}

	async findOne(id: string): Promise<CampaignSelect | null> {
		const rows = await this.db
			.select()
			.from(campaignsSchema)
			.where(and(eq(campaignsSchema.id, id), isNull(campaignsSchema.deletedAt)))
			.limit(1);
		return rows[0] ?? null;
	}

	async create(
		data: CampaignInsert,
	): Promise<ApiResponse<CampaignSelect | null>> {
		return BaseRepository.create(this.db, campaignsSchema, data) as Promise<
			ApiResponse<CampaignSelect | null>
		>;
	}

	async updateOne(
		id: string,
		data: Partial<CampaignInsert>,
	): Promise<ApiResponse<CampaignSelect | null>> {
		return BaseRepository.updateOne(this.db, campaignsSchema, id, data, {}, [
			"id",
		]) as Promise<ApiResponse<CampaignSelect | null>>;
	}

	async deleteOne(id: string): Promise<ApiResponse<CampaignSelect | null>> {
		return BaseRepository.deleteOne(this.db, campaignsSchema, id, {}, [
			"id",
		]) as Promise<ApiResponse<CampaignSelect | null>>;
	}
}
