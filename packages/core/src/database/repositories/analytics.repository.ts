import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	bookingsSchema,
	branchesSchema,
	couponsSchema,
	reviewsSchema,
	servicesSchema,
	teamMembersSchema,
	usersSchema,
} from "../schema";

export interface AnalyticsRange {
	startDate: string; // ISO date "2026-01-01"
	endDate: string; // ISO date "2026-12-31"
}

export interface RevenuePoint {
	date: string;
	revenue: number;
	bookings: number;
}

export interface ServiceStat {
	serviceId: string;
	name: string;
	count: number;
	revenue: number;
}

export interface PeakSlot {
	day: string; // 0=Sun..6=Sat
	hour: string; // 0..23
	count: number;
}

export interface EarningsBreakdownRow {
	revenue: number;
	bookings: number;
}

export interface Earnings {
	total: number;
	byStaff: (EarningsBreakdownRow & {
		teamMemberId: string | null;
		name: string;
	})[];
	byService: (EarningsBreakdownRow & { serviceId: string; name: string })[];
	byBranch: (EarningsBreakdownRow & { branchId: string; name: string })[];
	overTime: (EarningsBreakdownRow & { date: string })[];
}

export interface AnalyticsOverview {
	totalRevenue: number;
	totalBookings: number;
	avgBookingValue: number;
	completedBookings: number;
	pendingBookings: number;
	cancelledBookings: number;
	newCustomers: number;
	returningCustomers: number;
}

export class AnalyticsRepository {
	constructor(private readonly db: DbClient) {}

	private async getBranchIds(businessId: string): Promise<string[]> {
		const branches = await this.db
			.select({ id: branchesSchema.id })
			.from(branchesSchema)
			.where(
				and(
					eq(branchesSchema.businessId, businessId),
					isNull(branchesSchema.deletedAt),
				),
			);
		return branches.map((b) => b.id);
	}

	async getOverview(
		businessId: string,
		range: AnalyticsRange,
	): Promise<AnalyticsOverview> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) {
			return {
				totalRevenue: 0,
				totalBookings: 0,
				avgBookingValue: 0,
				completedBookings: 0,
				pendingBookings: 0,
				cancelledBookings: 0,
				newCustomers: 0,
				returningCustomers: 0,
			};
		}

		const rows = await this.db
			.select({
				status: bookingsSchema.status,
				count: sql<number>`count(*)`,
				revenue: sql<number>`sum(${bookingsSchema.price} - ${bookingsSchema.discount})`,
			})
			.from(bookingsSchema)
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					gte(bookingsSchema.createdAt, range.startDate),
					sql`${bookingsSchema.createdAt} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(bookingsSchema.status);

		let totalRevenue = 0;
		let totalBookings = 0;
		let completedBookings = 0;
		let pendingBookings = 0;
		let cancelledBookings = 0;

		for (const row of rows) {
			totalBookings += Number(row.count);
			if (row.status === "Completed") {
				completedBookings = Number(row.count);
				totalRevenue = Number(row.revenue) || 0;
			} else if (row.status === "Pending") {
				pendingBookings = Number(row.count);
			} else if (row.status === "Cancelled") {
				cancelledBookings = Number(row.count);
			}
		}

		const avgBookingValue =
			completedBookings > 0 ? Math.round(totalRevenue / completedBookings) : 0;

		// New vs returning — new = first booking ever; returning = had a prior booking
		const customerRows = await this.db
			.select({ userId: bookingsSchema.userId })
			.from(bookingsSchema)
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					gte(bookingsSchema.createdAt, range.startDate),
					sql`${bookingsSchema.createdAt} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(bookingsSchema.userId);

		const uniqueUserIds = customerRows.map((r) => r.userId);
		let newCustomers = 0;
		let returningCustomers = 0;

		if (uniqueUserIds.length > 0) {
			const priorBookings = await this.db
				.select({ userId: bookingsSchema.userId })
				.from(bookingsSchema)
				.where(
					and(
						inArray(bookingsSchema.userId, uniqueUserIds),
						isNull(bookingsSchema.deletedAt),
						sql`${bookingsSchema.createdAt} < ${range.startDate}`,
					),
				)
				.groupBy(bookingsSchema.userId);
			const returningSet = new Set(priorBookings.map((r) => r.userId));
			newCustomers = uniqueUserIds.filter((id) => !returningSet.has(id)).length;
			returningCustomers = uniqueUserIds.filter((id) =>
				returningSet.has(id),
			).length;
		}

		return {
			totalRevenue,
			totalBookings,
			avgBookingValue,
			completedBookings,
			pendingBookings,
			cancelledBookings,
			newCustomers,
			returningCustomers,
		};
	}

	async getRevenueByDate(
		businessId: string,
		range: AnalyticsRange,
	): Promise<RevenuePoint[]> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return [];

		const rows = await this.db
			.select({
				date: sql<string>`substr(${bookingsSchema.slot}, 1, 10)`,
				revenue: sql<number>`sum(${bookingsSchema.price} - ${bookingsSchema.discount})`,
				bookings: sql<number>`count(*)`,
			})
			.from(bookingsSchema)
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					eq(bookingsSchema.status, "Completed"),
					gte(bookingsSchema.slot, range.startDate),
					sql`${bookingsSchema.slot} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(sql`substr(${bookingsSchema.slot}, 1, 10)`)
			.orderBy(sql`substr(${bookingsSchema.slot}, 1, 10)`);

		return rows.map((r) => ({
			date: r.date,
			revenue: Number(r.revenue) || 0,
			bookings: Number(r.bookings),
		}));
	}

	async getTopServices(
		businessId: string,
		range: AnalyticsRange,
	): Promise<ServiceStat[]> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return [];

		const rows = await this.db
			.select({
				serviceId: bookingsSchema.serviceId,
				name: servicesSchema.name,
				count: sql<number>`count(*)`,
				revenue: sql<number>`sum(${bookingsSchema.price} - ${bookingsSchema.discount})`,
			})
			.from(bookingsSchema)
			.leftJoin(servicesSchema, eq(bookingsSchema.serviceId, servicesSchema.id))
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					gte(bookingsSchema.createdAt, range.startDate),
					sql`${bookingsSchema.createdAt} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(bookingsSchema.serviceId)
			.orderBy(sql`count(*) desc`)
			.limit(10);

		return rows.map((r) => ({
			serviceId: r.serviceId,
			name: r.name ?? r.serviceId,
			count: Number(r.count),
			revenue: Number(r.revenue) || 0,
		}));
	}

	async getReviewStats(
		businessId: string,
		range: AnalyticsRange,
	): Promise<{
		avgRating: number;
		totalReviews: number;
		ratingDistribution: { rating: number; count: number }[];
	}> {
		const rows = await this.db
			.select({
				rating: reviewsSchema.rating,
				count: sql<number>`count(*)`,
			})
			.from(reviewsSchema)
			.where(
				and(
					eq(reviewsSchema.businessId, businessId),
					eq(reviewsSchema.status, "Published"),
					gte(reviewsSchema.createdAt, range.startDate),
					sql`${reviewsSchema.createdAt} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(reviewsSchema.rating);

		const dist = rows.map((r) => ({
			rating: r.rating,
			count: Number(r.count),
		}));
		const totalReviews = dist.reduce((s, r) => s + r.count, 0);
		const avgRating =
			totalReviews > 0
				? dist.reduce((s, r) => s + r.rating * r.count, 0) / totalReviews
				: 0;

		return {
			avgRating: Math.round(avgRating * 10) / 10,
			totalReviews,
			ratingDistribution: dist,
		};
	}

	async getCouponStats(
		businessId: string,
		range: AnalyticsRange,
	): Promise<{
		coupons: {
			couponId: string;
			code: string;
			redemptions: number;
			totalDiscount: number;
		}[];
	}> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return { coupons: [] };

		const rows = await this.db
			.select({
				couponCode: bookingsSchema.couponCode,
				redemptions: sql<number>`count(*)`,
				totalDiscount: sql<number>`sum(${bookingsSchema.discount})`,
			})
			.from(bookingsSchema)
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					sql`${bookingsSchema.couponCode} IS NOT NULL`,
					gte(bookingsSchema.createdAt, range.startDate),
					sql`${bookingsSchema.createdAt} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(bookingsSchema.couponCode);

		const couponDetails = await this.db
			.select({ id: couponsSchema.id, code: couponsSchema.code })
			.from(couponsSchema)
			.where(eq(couponsSchema.businessId, businessId));

		const codeToId = Object.fromEntries(
			couponDetails.map((c) => [c.code, c.id]),
		);

		return {
			coupons: rows
				.filter((r) => r.couponCode)
				.map((r) => ({
					// biome-ignore lint/style/noNonNullAssertion: filtered by r.couponCode truthy check above
					couponId: codeToId[r.couponCode!] ?? r.couponCode!,
					// biome-ignore lint/style/noNonNullAssertion: filtered by r.couponCode truthy check above
					code: r.couponCode!,
					redemptions: Number(r.redemptions),
					totalDiscount: Number(r.totalDiscount) || 0,
				})),
		};
	}

	async getStaffStats(
		businessId: string,
		range: AnalyticsRange,
	): Promise<{
		staff: {
			teamMemberId: string;
			name: string;
			bookings: number;
			revenue: number;
		}[];
	}> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return { staff: [] };

		const rows = await this.db
			.select({
				staffId: bookingsSchema.staffId,
				bookings: sql<number>`count(*)`,
				revenue: sql<number>`sum(${bookingsSchema.price} - ${bookingsSchema.discount})`,
			})
			.from(bookingsSchema)
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					eq(bookingsSchema.status, "Completed"),
					sql`${bookingsSchema.staffId} IS NOT NULL`,
					gte(bookingsSchema.createdAt, range.startDate),
					sql`${bookingsSchema.createdAt} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(bookingsSchema.staffId);

		// biome-ignore lint/style/noNonNullAssertion: staffId is non-null for rows selected via WHERE staffId IS NOT NULL
		const staffIds = rows.map((r) => r.staffId!).filter(Boolean);
		if (staffIds.length === 0) return { staff: [] };

		const members = await this.db
			.select({ id: teamMembersSchema.id, name: usersSchema.name })
			.from(teamMembersSchema)
			.innerJoin(usersSchema, eq(teamMembersSchema.userId, usersSchema.id))
			.where(inArray(teamMembersSchema.id, staffIds));

		const idToName = Object.fromEntries(members.map((m) => [m.id, m.name]));

		return {
			staff: rows.map((r) => ({
				// biome-ignore lint/style/noNonNullAssertion: staffId is non-null (filtered above)
				teamMemberId: r.staffId!,
				// biome-ignore lint/style/noNonNullAssertion: staffId is non-null (filtered above)
				name: idToName[r.staffId!] ?? r.staffId!,
				bookings: Number(r.bookings),
				revenue: Number(r.revenue) || 0,
			})),
		};
	}

	async getEarnings(
		businessId: string,
		range: AnalyticsRange,
	): Promise<Earnings> {
		const empty: Earnings = {
			total: 0,
			byStaff: [],
			byService: [],
			byBranch: [],
			overTime: [],
		};
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return empty;

		// Shared filter: Completed, not soft-deleted, slot within range.
		const where = and(
			inArray(bookingsSchema.branchId, branchIds),
			isNull(bookingsSchema.deletedAt),
			eq(bookingsSchema.status, "Completed"),
			gte(bookingsSchema.slot, range.startDate),
			sql`${bookingsSchema.slot} <= ${`${range.endDate}T23:59:59`}`,
		);
		const net = sql<number>`sum(${bookingsSchema.price} - ${bookingsSchema.discount})`;
		const cnt = sql<number>`count(*)`;

		// total
		const [totalRow] = await this.db
			.select({ revenue: net })
			.from(bookingsSchema)
			.where(where);
		const total = Number(totalRow?.revenue) || 0;

		// by branch
		const branchRows = await this.db
			.select({
				branchId: bookingsSchema.branchId,
				name: branchesSchema.name,
				revenue: net,
				bookings: cnt,
			})
			.from(bookingsSchema)
			.leftJoin(branchesSchema, eq(bookingsSchema.branchId, branchesSchema.id))
			.where(where)
			.groupBy(bookingsSchema.branchId)
			.orderBy(sql`${net} desc`);

		// by service
		const serviceRows = await this.db
			.select({
				serviceId: bookingsSchema.serviceId,
				name: servicesSchema.name,
				revenue: net,
				bookings: cnt,
			})
			.from(bookingsSchema)
			.leftJoin(servicesSchema, eq(bookingsSchema.serviceId, servicesSchema.id))
			.where(where)
			.groupBy(bookingsSchema.serviceId)
			.orderBy(sql`${net} desc`);

		// by staff — keep null staffId rows; resolve to an "Unassigned" bucket
		const staffRows = await this.db
			.select({
				staffId: bookingsSchema.staffId,
				revenue: net,
				bookings: cnt,
			})
			.from(bookingsSchema)
			.where(where)
			.groupBy(bookingsSchema.staffId)
			.orderBy(sql`${net} desc`);

		const assignedIds = staffRows
			.map((r) => r.staffId)
			.filter((id): id is string => id !== null);
		const members =
			assignedIds.length > 0
				? await this.db
						.select({ id: teamMembersSchema.id, name: usersSchema.name })
						.from(teamMembersSchema)
						.innerJoin(
							usersSchema,
							eq(teamMembersSchema.userId, usersSchema.id),
						)
						.where(inArray(teamMembersSchema.id, assignedIds))
				: [];
		const idToName = Object.fromEntries(members.map((m) => [m.id, m.name]));

		const byStaff = staffRows.map((r) => ({
			teamMemberId: r.staffId,
			name:
				r.staffId === null ? "Unassigned" : (idToName[r.staffId] ?? r.staffId),
			revenue: Number(r.revenue) || 0,
			bookings: Number(r.bookings),
		}));

		// over time — group by slot date (YYYY-MM-DD)
		const overTimeRows = await this.db
			.select({
				date: sql<string>`substr(${bookingsSchema.slot}, 1, 10)`,
				revenue: net,
				bookings: cnt,
			})
			.from(bookingsSchema)
			.where(where)
			.groupBy(sql`substr(${bookingsSchema.slot}, 1, 10)`)
			.orderBy(sql`substr(${bookingsSchema.slot}, 1, 10)`);

		return {
			total,
			byBranch: branchRows.map((r) => ({
				branchId: r.branchId,
				name: r.name ?? r.branchId,
				revenue: Number(r.revenue) || 0,
				bookings: Number(r.bookings),
			})),
			byService: serviceRows.map((r) => ({
				serviceId: r.serviceId,
				name: r.name ?? r.serviceId,
				revenue: Number(r.revenue) || 0,
				bookings: Number(r.bookings),
			})),
			byStaff,
			overTime: overTimeRows.map((r) => ({
				date: r.date,
				revenue: Number(r.revenue) || 0,
				bookings: Number(r.bookings),
			})),
		};
	}

	async getPeakHours(
		businessId: string,
		range: AnalyticsRange,
	): Promise<PeakSlot[]> {
		const branchIds = await this.getBranchIds(businessId);
		if (branchIds.length === 0) return [];

		// SQLite: strftime('%w', slot) = day-of-week (0=Sun), '%H' = hour
		const rows = await this.db
			.select({
				day: sql<string>`strftime('%w', ${bookingsSchema.slot})`,
				hour: sql<string>`strftime('%H', ${bookingsSchema.slot})`,
				count: sql<number>`count(*)`,
			})
			.from(bookingsSchema)
			.where(
				and(
					inArray(bookingsSchema.branchId, branchIds),
					isNull(bookingsSchema.deletedAt),
					gte(bookingsSchema.slot, range.startDate),
					sql`${bookingsSchema.slot} <= ${`${range.endDate}T23:59:59`}`,
				),
			)
			.groupBy(
				sql`strftime('%w', ${bookingsSchema.slot})`,
				sql`strftime('%H', ${bookingsSchema.slot})`,
			);

		return rows.map((r) => ({
			day: r.day,
			hour: r.hour,
			count: Number(r.count),
		}));
	}
}
