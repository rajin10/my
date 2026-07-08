import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type {
	ApiResponse,
	BaseQueryDto,
	PaginatedQueryDto,
	PaginatedResponse,
} from "../../http/response";
import type { DbClient } from "../client";
import type { BookingInsert, BookingSelect } from "../schema";
import {
	bookingsSchema,
	branchesSchema,
	servicesSchema,
	usersSchema,
} from "../schema";
import { BaseRepository, type QueryAllowlist } from "./base.repository";

export class BookingsRepository {
	constructor(private readonly db: DbClient) {}

	private static readonly queryAllowlist: QueryAllowlist = {
		filterable: ["status", "branchId", "serviceId", "userId"],
		searchable: [],
		sortable: ["createdAt", "slot", "status"],
	};

	async findAll(
		query: PaginatedQueryDto,
	): Promise<PaginatedResponse<BookingSelect>> {
		return BaseRepository.findAll(
			this.db,
			bookingsSchema,
			query,
			BookingsRepository.queryAllowlist,
		) as Promise<PaginatedResponse<BookingSelect>>;
	}

	async findOne(
		id: string,
		query: BaseQueryDto = {},
	): Promise<ApiResponse<BookingSelect | null>> {
		return BaseRepository.findOne(this.db, bookingsSchema, id, query, [
			"id",
		]) as Promise<ApiResponse<BookingSelect | null>>;
	}

	async findByUser(
		userId: string,
	): Promise<(BookingSelect & { businessId: string })[]> {
		const rows = await this.db
			.select({
				id: bookingsSchema.id,
				userId: bookingsSchema.userId,
				serviceId: bookingsSchema.serviceId,
				branchId: bookingsSchema.branchId,
				slot: bookingsSchema.slot,
				status: bookingsSchema.status,
				price: bookingsSchema.price,
				discount: bookingsSchema.discount,
				couponCode: bookingsSchema.couponCode,
				staffId: bookingsSchema.staffId,
				source: bookingsSchema.source,
				guestName: bookingsSchema.guestName,
				guestPhone: bookingsSchema.guestPhone,
				walkInLocalId: bookingsSchema.walkInLocalId,
				createdAt: bookingsSchema.createdAt,
				updatedAt: bookingsSchema.updatedAt,
				deletedAt: bookingsSchema.deletedAt,
				businessId: branchesSchema.businessId,
			})
			.from(bookingsSchema)
			.innerJoin(branchesSchema, eq(bookingsSchema.branchId, branchesSchema.id))
			.where(
				and(
					eq(bookingsSchema.userId, userId),
					isNull(bookingsSchema.deletedAt),
				),
			);
		return rows;
	}

	async findByBranch(branchId: string): Promise<BookingSelect[]> {
		return this.db
			.select()
			.from(bookingsSchema)
			.where(
				and(
					eq(bookingsSchema.branchId, branchId),
					isNull(bookingsSchema.deletedAt),
				),
			);
	}

	async findByBranchInRange(
		branchId: string,
		startDate: string,
		endDate: string,
	): Promise<
		(BookingSelect & {
			customerName: string;
			serviceName: string;
			serviceDuration: number;
		})[]
	> {
		const rows = await this.db
			.select({
				id: bookingsSchema.id,
				userId: bookingsSchema.userId,
				serviceId: bookingsSchema.serviceId,
				branchId: bookingsSchema.branchId,
				slot: bookingsSchema.slot,
				status: bookingsSchema.status,
				price: bookingsSchema.price,
				discount: bookingsSchema.discount,
				couponCode: bookingsSchema.couponCode,
				createdAt: bookingsSchema.createdAt,
				updatedAt: bookingsSchema.updatedAt,
				deletedAt: bookingsSchema.deletedAt,
				customerName: sql<string>`coalesce(${usersSchema.name}, 'Customer')`,
				serviceName: sql<string>`coalesce(${servicesSchema.name}, '')`,
				serviceDuration: sql<number>`coalesce(${servicesSchema.duration}, 60)`,
			})
			.from(bookingsSchema)
			.leftJoin(usersSchema, eq(bookingsSchema.userId, usersSchema.id))
			.leftJoin(servicesSchema, eq(bookingsSchema.serviceId, servicesSchema.id))
			.where(
				and(
					eq(bookingsSchema.branchId, branchId),
					isNull(bookingsSchema.deletedAt),
					gte(bookingsSchema.slot, startDate),
					lte(bookingsSchema.slot, `${endDate}T23:59:59`),
				),
			)
			.orderBy(bookingsSchema.slot);
		return rows as (BookingSelect & {
			customerName: string;
			serviceName: string;
			serviceDuration: number;
		})[];
	}

	/** Returns an active (Pending or Confirmed) booking occupying the same slot. */
	async findByWalkInLocalId(
		walkInLocalId: string,
	): Promise<BookingSelect | null> {
		const rows = await this.db
			.select()
			.from(bookingsSchema)
			.where(
				and(
					eq(bookingsSchema.walkInLocalId, walkInLocalId),
					isNull(bookingsSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async findConflict(
		branchId: string,
		serviceId: string,
		slot: string,
	): Promise<BookingSelect | null> {
		const rows = await this.db
			.select()
			.from(bookingsSchema)
			.where(
				and(
					eq(bookingsSchema.branchId, branchId),
					eq(bookingsSchema.serviceId, serviceId),
					eq(bookingsSchema.slot, slot),
					inArray(bookingsSchema.status, ["Pending", "Confirmed"]),
					isNull(bookingsSchema.deletedAt),
				),
			)
			.limit(1);
		return rows[0] ?? null;
	}

	async create(
		data: BookingInsert,
	): Promise<ApiResponse<BookingSelect | null>> {
		return BaseRepository.create(this.db, bookingsSchema, data) as Promise<
			ApiResponse<BookingSelect | null>
		>;
	}

	async updateStatus(
		id: string,
		status: "Pending" | "Confirmed" | "Cancelled" | "Completed",
	): Promise<ApiResponse<BookingSelect | null>> {
		return BaseRepository.updateOne(
			this.db,
			bookingsSchema,
			id,
			{ status } as Partial<BookingInsert>,
			{},
			["id"],
		) as Promise<ApiResponse<BookingSelect | null>>;
	}

	async assignStaff(
		bookingId: string,
		staffId: string | null,
	): Promise<ApiResponse<BookingSelect | null>> {
		return BaseRepository.updateOne(
			this.db,
			bookingsSchema,
			bookingId,
			{ staffId } as Partial<BookingInsert>,
			{},
			["id"],
		) as Promise<ApiResponse<BookingSelect | null>>;
	}

	async findCustomersByBusiness(
		businessId: string,
	): Promise<{ userId: string; pushToken: string | null }[]> {
		const rows = await this.db
			.selectDistinct({
				userId: bookingsSchema.userId,
				pushToken: usersSchema.pushToken,
			})
			.from(bookingsSchema)
			.innerJoin(branchesSchema, eq(bookingsSchema.branchId, branchesSchema.id))
			.innerJoin(usersSchema, eq(bookingsSchema.userId, usersSchema.id))
			.where(
				and(
					eq(branchesSchema.businessId, businessId),
					inArray(bookingsSchema.status, ["Confirmed", "Completed"]),
					isNull(bookingsSchema.deletedAt),
				),
			);
		return rows;
	}

	async countOverlapping(
		branchId: string,
		slotStart: string,
		slotEnd: string,
	): Promise<number> {
		const rows = await this.db
			.select({ count: sql<number>`count(*)` })
			.from(bookingsSchema)
			.innerJoin(
				servicesSchema,
				eq(bookingsSchema.serviceId, servicesSchema.id),
			)
			.where(
				and(
					eq(bookingsSchema.branchId, branchId),
					inArray(bookingsSchema.status, ["Pending", "Confirmed"]),
					isNull(bookingsSchema.deletedAt),
					// booking overlaps if: booking.slot < slotEnd AND booking.slot + duration > slotStart
					// expressed as: booking.slot < slotEnd AND booking.slot >= slotStart OR (booking.slot < slotStart AND end > slotStart)
					// Full overlap: slot < slotEnd AND (slot + duration minutes) > slotStart
					sql`${bookingsSchema.slot} < ${slotEnd}`,
					sql`datetime(${bookingsSchema.slot}, '+' || ${servicesSchema.duration} || ' minutes') > ${slotStart}`,
				),
			);
		return Number(rows[0]?.count ?? 0);
	}
}
