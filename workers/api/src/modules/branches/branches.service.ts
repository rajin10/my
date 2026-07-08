import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type {
	BranchHoursInsert,
	BranchInsert,
} from "@repo/core/src/database/schema";
import type { AuthorizationService } from "../../core/authorization";
import { NotFoundError, ValidationError } from "../../core/errors";
import {
	addMinutes,
	generateSlotCandidates,
	isBranchClosedOnDate,
} from "../../lib/booking-slots";

export class BranchesService {
	constructor(
		private readonly repo: BranchesRepository,
		private readonly servicesRepo: ServicesRepository,
		private readonly bookingsRepo: BookingsRepository,
		private readonly authz: AuthorizationService,
	) {}

	listByBusiness(businessId: string) {
		return this.repo.findByBusiness(businessId);
	}

	async get(id: string) {
		const result = await this.repo.findOne(id);
		if (!result.data) throw new NotFoundError("Branch not found");
		return result.data;
	}

	async create(
		ownerId: string,
		businessId: string,
		data: Omit<BranchInsert, "businessId">,
	) {
		await this.authz.assertBusinessOwner(ownerId, businessId);
		const result = await this.repo.create({ ...data, businessId });
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async update(
		ownerId: string,
		branchId: string,
		data: Partial<Omit<BranchInsert, "businessId">>,
	) {
		await this.authz.assertBranchOwner(ownerId, branchId);
		const result = await this.repo.updateOne(branchId, data);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	async delete(ownerId: string, branchId: string) {
		await this.authz.assertBranchOwner(ownerId, branchId);
		const result = await this.repo.deleteOne(branchId);
		// biome-ignore lint/style/noNonNullAssertion: repo throws on failure; data is non-null on success
		return result.data!;
	}

	getHours(branchId: string) {
		return this.repo.findHours(branchId);
	}

	/** Bookable slots for a branch/service/day after hours + booking conflict checks. */
	async getAvailability(branchId: string, date: string, serviceId: string) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			throw new ValidationError("date must be YYYY-MM-DD");
		}

		await this.get(branchId);

		const svcResult = await this.servicesRepo.findOne(serviceId);
		if (!svcResult.data) throw new NotFoundError("Service not found");
		if (svcResult.data.branchId !== branchId) {
			throw new ValidationError("Service does not belong to this branch");
		}

		const hours = await this.repo.findHours(branchId);
		const isClosed = isBranchClosedOnDate(date, hours);
		if (isClosed) {
			return { date, serviceId, isClosed: true, slots: [] as string[] };
		}

		const candidates = generateSlotCandidates(
			date,
			svcResult.data.duration,
			hours,
		);
		const slots: string[] = [];

		for (const slot of candidates) {
			const slotEnd = addMinutes(slot, svcResult.data.duration);
			const conflict = await this.bookingsRepo.findConflict(
				branchId,
				serviceId,
				slot,
			);
			if (conflict) continue;
			const overlap = await this.bookingsRepo.countOverlapping(
				branchId,
				slot,
				slotEnd,
			);
			if (overlap > 0) continue;
			slots.push(slot);
		}

		return { date, serviceId, isClosed: false, slots };
	}

	async setHours(
		ownerId: string,
		branchId: string,
		hours: Array<
			Pick<
				BranchHoursInsert,
				"dayOfWeek" | "isClosed" | "openTime" | "closeTime"
			>
		>,
	) {
		await this.authz.assertBranchOwner(ownerId, branchId);
		const results = await Promise.all(
			hours.map((h) =>
				this.repo.upsertHour({
					branchId,
					dayOfWeek: h.dayOfWeek,
					isClosed: h.isClosed ?? false,
					openTime: h.openTime ?? null,
					closeTime: h.closeTime ?? null,
				}),
			),
		);
		return results;
	}
}
