import { and, desc, eq, isNull } from "drizzle-orm";
import type { ApiResponse, BaseQueryDto } from "../../http/response";
import type { DbClient } from "../client";
import type { ReviewInsert, ReviewSelect } from "../schema";
import {
	businessesSchema,
	reviewsSchema,
	servicesSchema,
	usersSchema,
} from "../schema";
import { BaseRepository } from "./base.repository";

export type ReviewWithUser = ReviewSelect & { userName: string };

export type ReviewWithBusinessService = ReviewSelect & {
	businessName: string;
	serviceName: string;
};

export class ReviewsRepository {
	constructor(private readonly db: DbClient) {}

	async findPublishedByBusiness(businessId: string): Promise<ReviewWithUser[]> {
		const rows = await this.db
			.select({
				id: reviewsSchema.id,
				userId: reviewsSchema.userId,
				businessId: reviewsSchema.businessId,
				serviceId: reviewsSchema.serviceId,
				bookingId: reviewsSchema.bookingId,
				rating: reviewsSchema.rating,
				text: reviewsSchema.text,
				status: reviewsSchema.status,
				createdAt: reviewsSchema.createdAt,
				updatedAt: reviewsSchema.updatedAt,
				deletedAt: reviewsSchema.deletedAt,
				userName: usersSchema.name,
			})
			.from(reviewsSchema)
			.leftJoin(usersSchema, eq(reviewsSchema.userId, usersSchema.id))
			.where(
				and(
					eq(reviewsSchema.businessId, businessId),
					eq(reviewsSchema.status, "Published"),
					isNull(reviewsSchema.deletedAt),
				),
			);
		return rows.map((r) => ({ ...r, userName: r.userName ?? "Guest" }));
	}

	async findPendingByBusiness(businessId: string): Promise<ReviewWithUser[]> {
		const rows = await this.db
			.select({
				id: reviewsSchema.id,
				userId: reviewsSchema.userId,
				businessId: reviewsSchema.businessId,
				serviceId: reviewsSchema.serviceId,
				bookingId: reviewsSchema.bookingId,
				rating: reviewsSchema.rating,
				text: reviewsSchema.text,
				status: reviewsSchema.status,
				createdAt: reviewsSchema.createdAt,
				updatedAt: reviewsSchema.updatedAt,
				deletedAt: reviewsSchema.deletedAt,
				userName: usersSchema.name,
			})
			.from(reviewsSchema)
			.leftJoin(usersSchema, eq(reviewsSchema.userId, usersSchema.id))
			.where(
				and(
					eq(reviewsSchema.businessId, businessId),
					eq(reviewsSchema.status, "Pending"),
					isNull(reviewsSchema.deletedAt),
				),
			);
		return rows.map((r) => ({ ...r, userName: r.userName ?? "Guest" }));
	}

	async findByUser(userId: string): Promise<ReviewWithBusinessService[]> {
		const rows = await this.db
			.select({
				id: reviewsSchema.id,
				userId: reviewsSchema.userId,
				businessId: reviewsSchema.businessId,
				serviceId: reviewsSchema.serviceId,
				bookingId: reviewsSchema.bookingId,
				rating: reviewsSchema.rating,
				text: reviewsSchema.text,
				status: reviewsSchema.status,
				createdAt: reviewsSchema.createdAt,
				updatedAt: reviewsSchema.updatedAt,
				deletedAt: reviewsSchema.deletedAt,
				businessName: businessesSchema.name,
				serviceName: servicesSchema.name,
			})
			.from(reviewsSchema)
			.leftJoin(
				businessesSchema,
				eq(reviewsSchema.businessId, businessesSchema.id),
			)
			.leftJoin(servicesSchema, eq(reviewsSchema.serviceId, servicesSchema.id))
			.where(
				and(eq(reviewsSchema.userId, userId), isNull(reviewsSchema.deletedAt)),
			)
			.orderBy(desc(reviewsSchema.createdAt));
		return rows.map((r) => ({
			...r,
			businessName: r.businessName ?? "Unknown business",
			serviceName: r.serviceName ?? "Unknown service",
		}));
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<ReviewSelect | null>> {
		return BaseRepository.findOne(this.db, reviewsSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<ReviewSelect | null>>;
	}

	async create(data: ReviewInsert): Promise<ApiResponse<ReviewSelect | null>> {
		return BaseRepository.create(this.db, reviewsSchema, data) as Promise<
			ApiResponse<ReviewSelect | null>
		>;
	}

	async updateStatus(
		id: string,
		status: "Pending" | "Published",
	): Promise<ApiResponse<ReviewSelect | null>> {
		return BaseRepository.updateOne(
			this.db,
			reviewsSchema,
			id,
			{ status } as Partial<ReviewInsert>,
			{},
			["id"],
		) as Promise<ApiResponse<ReviewSelect | null>>;
	}

	async softDelete(id: string): Promise<ApiResponse<ReviewSelect | null>> {
		return BaseRepository.deleteOne(this.db, reviewsSchema, id, {}, [
			"id",
		]) as Promise<ApiResponse<ReviewSelect | null>>;
	}
}
