import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { TeamRepository } from "@repo/core/src/database/repositories/team.repository";
import type { BookingSelect } from "@repo/core/src/database/schema";
import type { QueueProducer } from "@repo/core/src/queue/producer";
import type { AuthorizationService } from "../../core/authorization";
import {
	ConflictError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";
import type { CouponsService } from "../coupons/coupons.service";

export interface CreateBookingInput {
	serviceId: string;
	branchId: string;
	slot: string; // ISO local datetime: "2026-06-01T11:00:00"
	couponCode?: string;
	requestId?: string;
}

export class BookingsService {
	constructor(
		private readonly repo: BookingsRepository,
		private readonly servicesRepo: ServicesRepository,
		private readonly branchesRepo: BranchesRepository,
		private readonly couponsService: CouponsService,
		private readonly queue: QueueProducer,
		private readonly authz: AuthorizationService,
		private readonly teamRepo?: TeamRepository,
	) {}

	listByUser(userId: string) {
		return this.repo.findByUser(userId);
	}

	async listByBranch(
		branchId: string,
		scopedBranchIds: string[] | null,
		actorId: string,
	) {
		await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds);
		return this.repo.findByBranch(branchId);
	}

	async get(userId: string, bookingId: string) {
		const booking = await this.authz.assertCustomerOwnsBooking(
			userId,
			bookingId,
		);
		return booking;
	}

	async create(userId: string, input: CreateBookingInput) {
		const svcResult = await this.servicesRepo.findOne(input.serviceId);
		if (!svcResult.data) throw new NotFoundError("Service not found");
		if (svcResult.data.branchId !== input.branchId) {
			throw new ValidationError("Service does not belong to this branch");
		}

		if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input.slot)) {
			throw new ValidationError(
				"Slot must be an ISO local datetime, e.g. 2026-06-01T11:00:00",
			);
		}

		const conflict = await this.repo.findConflict(
			input.branchId,
			input.serviceId,
			input.slot,
		);
		if (conflict) throw new ConflictError("This slot is no longer available");

		const slotStart = input.slot;
		const slotEnd = this.addMinutes(input.slot, svcResult.data.duration);
		// Duration-aware overlap: reject if any active booking at this branch overlaps the requested window
		const overlapCount = await this.repo.countOverlapping(
			input.branchId,
			slotStart,
			slotEnd,
		);
		if (overlapCount > 0)
			throw new ConflictError(
				"The requested time window overlaps with an existing booking",
			);

		const branchResult = await this.branchesRepo.findOne(input.branchId);
		if (!branchResult.data) throw new NotFoundError("Branch not found");
		const businessId = branchResult.data.businessId;

		// Working-hours check: use noon to derive day-of-week (matches booking-slots.ts convention and avoids any midnight/DST edge cases).
		const slotDateStr = input.slot.slice(0, 10);
		const dayOfWeek = new Date(`${slotDateStr}T12:00:00`).getDay();
		const hours = await this.branchesRepo.findHoursForSlot(
			input.branchId,
			dayOfWeek,
		);
		if (hours) {
			if (hours.isClosed)
				throw new ValidationError("The branch is closed on the requested day");
			if (hours.openTime && hours.closeTime) {
				const toMins = (hhmm: string) => {
					const [h, m] = hhmm.split(":").map(Number);
					return h * 60 + (m ?? 0);
				};
				const slotMins = toMins(input.slot.slice(11, 16));
				const endMins = slotMins + svcResult.data.duration;
				const openMins = toMins(hours.openTime);
				const closeMins = toMins(hours.closeTime);
				if (slotMins < openMins || endMins > closeMins) {
					throw new ValidationError(
						`Slot must be within branch hours: ${hours.openTime}–${hours.closeTime}`,
					);
				}
			}
		}

		let discount = 0;
		let couponId: string | undefined;
		if (input.couponCode) {
			const validated = await this.couponsService.validate(
				input.couponCode,
				businessId,
				svcResult.data.price,
			);
			discount = validated.discount;
			couponId = validated.couponId;
			// Atomic guard: throws ConflictError if the coupon just hit its limit
			await this.couponsService.applyUsage(couponId);
		}

		let booking: BookingSelect;
		try {
			const result = await this.repo.create({
				userId,
				serviceId: input.serviceId,
				branchId: input.branchId,
				slot: input.slot,
				status: "Pending",
				price: svcResult.data.price,
				discount,
				couponCode: input.couponCode ?? null,
			});
			// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
			booking = result.data!;
		} catch (err) {
			if (couponId) await this.couponsService.revertUsage(couponId);
			// SQLite unique constraint on (branch, service, slot) → slot race
			if (
				err instanceof Error &&
				err.message.includes("UNIQUE constraint failed")
			) {
				throw new ConflictError("This slot is no longer available");
			}
			throw err;
		}

		await this.queue.send({
			type: "notification.booking_created",
			bookingId: booking.id,
			requestId: input.requestId,
		});
		return booking;
	}

	async confirm(
		actorId: string,
		bookingId: string,
		scopedBranchIds: string[] | null,
	) {
		const booking = await this.authz.assertBookingAccess(
			actorId,
			bookingId,
			scopedBranchIds,
		);
		if (booking.status !== "Pending") {
			throw new ConflictError("Only Pending bookings can be confirmed");
		}
		const updated = await this.repo.updateStatus(bookingId, "Confirmed");
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}

	async complete(
		actorId: string,
		bookingId: string,
		scopedBranchIds: string[] | null,
	) {
		const booking = await this.authz.assertBookingAccess(
			actorId,
			bookingId,
			scopedBranchIds,
		);
		if (booking.status !== "Confirmed") {
			throw new ConflictError(
				"Only Confirmed bookings can be marked Completed",
			);
		}

		const updated = await this.repo.updateStatus(bookingId, "Completed");
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		const completed = updated.data!;

		if (completed.userId) {
			await this.queue.send({
				type: "rewards.credit",
				userId: completed.userId,
				bookingId: completed.id,
			});
		}

		return completed;
	}

	async assignStaff(
		actorId: string,
		bookingId: string,
		staffId: string | null,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBookingAccess(actorId, bookingId, scopedBranchIds);
		if (staffId !== null && this.teamRepo) {
			const member = await this.teamRepo.findOne(staffId);
			if (!member.data) throw new NotFoundError("Staff member not found");
		}
		const updated = await this.repo.assignStaff(bookingId, staffId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}

	private addMinutes(isoLocal: string, minutes: number): string {
		const dt = new Date(isoLocal.replace("T", " ").replace(/-/g, "/"));
		dt.setMinutes(dt.getMinutes() + minutes);
		return dt.toISOString().slice(0, 19).replace("T", "T");
	}

	async cancel(userId: string, bookingId: string) {
		const booking = await this.authz.assertCustomerOwnsBooking(
			userId,
			bookingId,
		);
		if (booking.status === "Cancelled")
			throw new ConflictError("Booking is already cancelled");
		if (booking.status === "Completed")
			throw new ConflictError("Completed bookings cannot be cancelled");

		// Revert coupon before updating status. If the status update fails after revert,
		// the booking stays active (user can retry). The inverse order — status first —
		// leaves a cancelled booking with an unconsumed coupon slot, which is harder to
		// recover. A truly atomic swap would require a D1 batch transaction.
		if (booking.couponCode) {
			const branch = await this.branchesRepo.findOne(booking.branchId);
			const businessId = branch.data?.businessId;
			if (businessId) {
				const coupon = await this.couponsService.findByCodeAndBusiness(
					booking.couponCode,
					businessId,
				);
				if (coupon) await this.couponsService.revertUsage(coupon.id);
			}
		}

		const updated = await this.repo.updateStatus(bookingId, "Cancelled");

		await this.queue.send({
			type: "notification.booking_cancelled",
			bookingId,
		});
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return updated.data!;
	}

	async listByBusiness(
		actorId: string,
		businessId: string,
		scopedBranchIds: string[] | null,
		opts?: { status?: string; limit?: number },
	) {
		if (scopedBranchIds === null) {
			await this.authz.assertBusinessOwner(actorId, businessId);
		}
		const branches = await this.branchesRepo.findByBusiness(businessId);
		const authorizedBranches =
			scopedBranchIds === null
				? branches
				: branches.filter((b) => scopedBranchIds.includes(b.id));
		const results = await Promise.all(
			authorizedBranches.map((b) => this.repo.findByBranch(b.id)),
		);
		let allBookings = results.flat();
		if (opts?.status) {
			allBookings = allBookings.filter((b) => b.status === opts.status);
		}
		const total = allBookings.length;
		const limited = opts?.limit
			? allBookings.slice(0, opts.limit)
			: allBookings;
		const effectiveLimit = opts?.limit ?? total;
		return {
			data: limited,
			query: {
				page: 1,
				limit: effectiveLimit,
				total,
				totalPages:
					total === 0 ? 1 : Math.ceil(total / Math.max(1, effectiveLimit)),
				hasNextPage: limited.length < total,
				hasPrevPage: false,
			},
		};
	}

	async exportCsv(
		actorId: string,
		businessId: string,
		status: string | undefined,
		scopedBranchIds: string[] | null,
	) {
		if (scopedBranchIds === null) {
			await this.authz.assertBusinessOwner(actorId, businessId);
		}
		const branches = await this.branchesRepo.findByBusiness(businessId);
		const authorizedBranches =
			scopedBranchIds === null
				? branches
				: branches.filter((b) => scopedBranchIds.includes(b.id));
		const allBookings = (
			await Promise.all(
				authorizedBranches.map((b) => this.repo.findByBranch(b.id)),
			)
		).flat();
		const filtered = status
			? allBookings.filter((b) => b.status === status)
			: allBookings;
		const csvField = (v: string | number | null | undefined): string => {
			const s = String(v ?? "");
			return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};
		const header =
			"id,userId,serviceId,branchId,slot,status,price,discount,couponCode,createdAt\n";
		const body = filtered
			.map((b) =>
				[
					b.id,
					b.userId,
					b.serviceId,
					b.branchId,
					b.slot,
					b.status,
					b.price,
					b.discount,
					b.couponCode ?? "",
					b.createdAt,
				]
					.map(csvField)
					.join(","),
			)
			.join("\n");
		return { csv: header + body, filename: `bookings-${businessId}.csv` };
	}

	async calendar(
		actorId: string,
		branchId: string,
		start: string,
		end: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(actorId, branchId, scopedBranchIds);
		return this.repo.findByBranchInRange(branchId, start, end);
	}
}
