import { and, eq, isNull } from "drizzle-orm";
import type { ApiResponse, BaseQueryDto } from "../../http/response";
import type { DbClient } from "../client";
import type { CustomerAddressInsert, CustomerAddressSelect } from "../schema";
import { customerAddressesSchema } from "../schema";
import { BaseRepository } from "./base.repository";

export class CustomerAddressesRepository {
	constructor(private readonly db: DbClient) {}

	async findByUser(userId: string): Promise<CustomerAddressSelect[]> {
		return this.db
			.select()
			.from(customerAddressesSchema)
			.where(
				and(
					eq(customerAddressesSchema.userId, userId),
					isNull(customerAddressesSchema.deletedAt),
				),
			);
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.findOne(this.db, customerAddressesSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	async create(
		data: CustomerAddressInsert,
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.create(
			this.db,
			customerAddressesSchema,
			data,
		) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	async updateOne(
		id: string,
		data: Partial<CustomerAddressInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.updateOne(
			this.db,
			customerAddressesSchema,
			id,
			data,
			query,
			["id"],
		) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CustomerAddressSelect | null>> {
		return BaseRepository.deleteOne(
			this.db,
			customerAddressesSchema,
			id,
			query,
			["id"],
		) as Promise<ApiResponse<CustomerAddressSelect | null>>;
	}

	/** Clears the default flag on all of a user's addresses (used before setting a new default). */
	async clearDefault(userId: string): Promise<void> {
		await this.db
			.update(customerAddressesSchema)
			.set({ isDefault: false })
			.where(eq(customerAddressesSchema.userId, userId));
	}
}
