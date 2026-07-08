import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";
import type { CouponInsert, CouponSelect } from "../schema";
import { couponsSchema } from "../schema";
import { BaseRepository, type QueryAllowlist } from "./base.repository";

export class CouponsRepository {
	private static readonly queryAllowlist: QueryAllowlist = {
		filterable: ["businessId", "status", "type"],
		searchable: ["code"],
		sortable: ["createdAt", "code", "status", "expiresAt", "value"],
	};

	constructor(private readonly db: DbClient) {}

	async findAll(
		query: PaginatedQueryDto,
	): Promise<PaginatedResponse<CouponSelect>> {
		return BaseRepository.findAll(
			this.db,
			couponsSchema,
			query,
			CouponsRepository.queryAllowlist,
		) as Promise<PaginatedResponse<CouponSelect>>;
	}

	async findAllByBusiness(
		businessId: string,
		query: PaginatedQueryDto,
	): Promise<PaginatedResponse<CouponSelect>> {
		return BaseRepository.findAll(
			this.db,
			couponsSchema,
			{
				...query,
				filters: { ...query.filters, businessId },
			},
			CouponsRepository.queryAllowlist,
		) as Promise<PaginatedResponse<CouponSelect>>;
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CouponSelect | null>> {
		return BaseRepository.findOne(this.db, couponsSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<CouponSelect | null>>;
	}

	async findActiveByCode(
		code: string,
		businessId: string,
	): Promise<CouponSelect | null> {
		const rows = await this.db
			.select()
			.from(couponsSchema)
			.where(
				and(
					eq(couponsSchema.code, code.toUpperCase()),
					eq(couponsSchema.businessId, businessId),
					eq(couponsSchema.status, "Active"),
					isNull(couponsSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async findByCode(code: string): Promise<CouponSelect | null> {
		const rows = await this.db
			.select()
			.from(couponsSchema)
			.where(
				and(
					eq(couponsSchema.code, code.toUpperCase()),
					isNull(couponsSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async decrementUsage(couponId: string): Promise<void> {
		await this.db
			.update(couponsSchema)
			.set({
				usedCount: sql`CASE WHEN ${couponsSchema.usedCount} > 0 THEN ${couponsSchema.usedCount} - 1 ELSE 0 END`,
				// Only restore to Active if the coupon was expired by hitting maxUses — not if an admin disabled it
				status: sql`CASE WHEN ${couponsSchema.status} = 'Expired' AND ${couponsSchema.usedCount} >= ${couponsSchema.maxUses} THEN 'Active' ELSE ${couponsSchema.status} END`,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(couponsSchema.id, couponId));
	}

	async incrementUsage(couponId: string): Promise<boolean> {
		const result = await this.db
			.update(couponsSchema)
			.set({
				usedCount: sql`${couponsSchema.usedCount} + 1`,
				status: sql`CASE WHEN ${couponsSchema.usedCount} + 1 >= ${couponsSchema.maxUses} THEN 'Expired' ELSE 'Active' END`,
				updatedAt: new Date().toISOString(),
			})
			.where(
				and(
					eq(couponsSchema.id, couponId),
					eq(couponsSchema.status, "Active"),
					sql`${couponsSchema.usedCount} < ${couponsSchema.maxUses}`,
					isNull(couponsSchema.deletedAt),
				),
			)
			.returning({ id: couponsSchema.id });
		return result.length > 0;
	}

	async create(data: CouponInsert): Promise<ApiResponse<CouponSelect | null>> {
		return BaseRepository.create(this.db, couponsSchema, data) as Promise<
			ApiResponse<CouponSelect | null>
		>;
	}

	async updateOne(
		id: string,
		data: Partial<CouponInsert>,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CouponSelect | null>> {
		return BaseRepository.updateOne(this.db, couponsSchema, id, data, query, [
			"id",
		]) as Promise<ApiResponse<CouponSelect | null>>;
	}

	async deleteOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<CouponSelect | null>> {
		return BaseRepository.deleteOne(this.db, couponsSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<CouponSelect | null>>;
	}

	async expireOld(
		now: string,
	): Promise<Array<{ id: string; businessId: string; code: string }>> {
		return this.db
			.update(couponsSchema)
			.set({ status: "Expired", updatedAt: now })
			.where(
				and(
					eq(couponsSchema.status, "Active"),
					lt(couponsSchema.expiresAt, now),
					isNull(couponsSchema.deletedAt),
				),
			)
			.returning({
				id: couponsSchema.id,
				businessId: couponsSchema.businessId,
				code: couponsSchema.code,
			});
	}
}
