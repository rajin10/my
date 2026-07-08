import { and, asc, eq, isNull } from "drizzle-orm";
import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";
import type {
	BusinessInsert,
	BusinessPhotoSelect,
	BusinessSelect,
} from "../schema";
import { businessPhotosSchema, businessesSchema } from "../schema";
import { BaseRepository, type QueryAllowlist } from "./base.repository";

export class BusinessesRepository {
	constructor(private readonly db: DbClient) {}

	private static readonly queryAllowlist: QueryAllowlist = {
		filterable: ["status", "city", "category", "vertical"],
		searchable: ["name", "description", "city"],
		sortable: ["createdAt", "name", "status"],
	};

	async findAll(
		query: PaginatedQueryDto,
	): Promise<PaginatedResponse<BusinessSelect>> {
		const result = await BaseRepository.findAll(
			this.db,
			businessesSchema,
			query,
			BusinessesRepository.queryAllowlist,
		);
		return result as PaginatedResponse<BusinessSelect>;
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BusinessSelect | null>> {
		const result = await BaseRepository.findOne(
			this.db,
			businessesSchema,
			id,
			query,
			["id"],
		);
		return result as ApiResponse<BusinessSelect | null>;
	}

	async findByOwner(ownerId: string): Promise<BusinessSelect[]> {
		const rows = await this.db
			.select()
			.from(businessesSchema)
			.where(
				and(
					eq(businessesSchema.ownerId, ownerId),
					isNull(businessesSchema.deletedAt),
				),
			);
		return rows;
	}

	async create(
		data: BusinessInsert,
	): Promise<ApiResponse<BusinessSelect | null>> {
		const result = await BaseRepository.create(
			this.db,
			businessesSchema,
			data,
		);
		return result as ApiResponse<BusinessSelect | null>;
	}

	async updateOne(
		id: string,
		data: Partial<BusinessInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BusinessSelect | null>> {
		const result = await BaseRepository.updateOne(
			this.db,
			businessesSchema,
			id,
			data,
			query,
			["id"],
		);
		return result as ApiResponse<BusinessSelect | null>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BusinessSelect | null>> {
		const result = await BaseRepository.deleteOne(
			this.db,
			businessesSchema,
			id,
			query,
			["id"],
		);
		return result as ApiResponse<BusinessSelect | null>;
	}

	async addPhoto(businessId: string, url: string): Promise<void> {
		await this.db.insert(businessPhotosSchema).values({ businessId, url });
	}

	async listPhotos(businessId: string): Promise<BusinessPhotoSelect[]> {
		return this.db
			.select()
			.from(businessPhotosSchema)
			.where(
				and(
					eq(businessPhotosSchema.businessId, businessId),
					isNull(businessPhotosSchema.deletedAt),
				),
			)
			.orderBy(
				asc(businessPhotosSchema.displayOrder),
				asc(businessPhotosSchema.createdAt),
			);
	}

	async findPhoto(photoId: string): Promise<BusinessPhotoSelect | null> {
		const rows = await this.db
			.select()
			.from(businessPhotosSchema)
			.where(
				and(
					eq(businessPhotosSchema.id, photoId),
					isNull(businessPhotosSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async deletePhoto(photoId: string): Promise<void> {
		await this.db
			.delete(businessPhotosSchema)
			.where(eq(businessPhotosSchema.id, photoId));
	}

	async reorderPhotos(orders: { id: string; order: number }[]): Promise<void> {
		for (const { id, order } of orders) {
			await this.db
				.update(businessPhotosSchema)
				.set({ displayOrder: order })
				.where(eq(businessPhotosSchema.id, id));
		}
	}

	async restoreOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BusinessSelect | null>> {
		const result = await BaseRepository.restoreOne(
			this.db,
			businessesSchema,
			id,
			query,
			["id"],
		);
		return result as ApiResponse<BusinessSelect | null>;
	}
}
