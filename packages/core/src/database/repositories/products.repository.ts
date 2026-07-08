import { and, eq, isNull } from "drizzle-orm";
import type { ApiResponse, BaseQueryDto } from "../../http/response";
import type { DbClient } from "../client";
import type { ProductInsert, ProductSelect } from "../schema";
import { productsSchema } from "../schema";
import { BaseRepository } from "./base.repository";

export class ProductsRepository {
	constructor(private readonly db: DbClient) {}

	async findByBranch(branchId: string): Promise<ProductSelect[]> {
		return this.db
			.select()
			.from(productsSchema)
			.where(
				and(
					eq(productsSchema.branchId, branchId),
					isNull(productsSchema.deletedAt),
				),
			);
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<ProductSelect | null>> {
		return BaseRepository.findOne(this.db, productsSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<ProductSelect | null>>;
	}

	async create(
		data: ProductInsert,
	): Promise<ApiResponse<ProductSelect | null>> {
		return BaseRepository.create(this.db, productsSchema, data) as Promise<
			ApiResponse<ProductSelect | null>
		>;
	}

	async updateOne(
		id: string,
		data: Partial<ProductInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<ProductSelect | null>> {
		return BaseRepository.updateOne(this.db, productsSchema, id, data, query, [
			"id",
		]) as Promise<ApiResponse<ProductSelect | null>>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<ProductSelect | null>> {
		return BaseRepository.deleteOne(this.db, productsSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<ProductSelect | null>>;
	}
}
