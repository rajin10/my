import { and, eq, isNull } from "drizzle-orm";
import type { ApiResponse, BaseQueryDto } from "../../http/response";
import type { DbClient } from "../client";
import type { ServiceInsert, ServiceSelect } from "../schema";
import { servicesSchema } from "../schema";
import { BaseRepository } from "./base.repository";

export class ServicesRepository {
	constructor(private readonly db: DbClient) {}

	async findByBranch(branchId: string): Promise<ServiceSelect[]> {
		return this.db
			.select()
			.from(servicesSchema)
			.where(
				and(
					eq(servicesSchema.branchId, branchId),
					isNull(servicesSchema.deletedAt),
				),
			);
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<ServiceSelect | null>> {
		return BaseRepository.findOne(this.db, servicesSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<ServiceSelect | null>>;
	}

	async create(
		data: ServiceInsert,
	): Promise<ApiResponse<ServiceSelect | null>> {
		return BaseRepository.create(this.db, servicesSchema, data) as Promise<
			ApiResponse<ServiceSelect | null>
		>;
	}

	async updateOne(
		id: string,
		data: Partial<ServiceInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<ServiceSelect | null>> {
		return BaseRepository.updateOne(this.db, servicesSchema, id, data, query, [
			"id",
		]) as Promise<ApiResponse<ServiceSelect | null>>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<ServiceSelect | null>> {
		return BaseRepository.deleteOne(this.db, servicesSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<ServiceSelect | null>>;
	}
}
