import type { BookingsRepository } from "@repo/core/src/database/repositories/bookings.repository";
import type { BranchesRepository } from "@repo/core/src/database/repositories/branches.repository";
import type { BusinessesRepository } from "@repo/core/src/database/repositories/businesses.repository";
import type { ServicesRepository } from "@repo/core/src/database/repositories/services.repository";
import type { BookingSelect } from "@repo/core/src/database/schema";
import type { QueueProducer } from "@repo/core/src/queue/producer";
import {
	type WalkInCustomer,
	validateWalkInCustomer,
} from "@repo/walk-in-sync/validation";
import type { WalkInSubmitPayload } from "@repo/walk-in-sync/protocol";
import type { AuthorizationService } from "../../core/authorization";
import {
	ConflictError,
	NotFoundError,
	ValidationError,
} from "../../core/errors";
import {
	addMinutes,
	generateSlotCandidates,
	isBranchClosedOnDate,
} from "../../lib/booking-slots";
import { signBranchQr, verifyBranchQr } from "./qr-sign";

const SESSION_TTL_SECS = 900;
const MAX_SYNC_BATCH = 20;

type WalkInSession = {
	branchId: string;
	ownerId: string;
	expiresAt: number;
};

export class WalkInService {
	constructor(
		private readonly branchesRepo: BranchesRepository,
		private readonly businessesRepo: BusinessesRepository,
		private readonly servicesRepo: ServicesRepository,
		private readonly bookingsRepo: BookingsRepository,
		private readonly authz: AuthorizationService,
		private readonly queue: QueueProducer,
		private readonly kv: KVNamespace | undefined,
		private readonly jwtSecret: string,
	) {}

	async getContext(branchId: string, session?: string, signature?: string) {
		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const business = await this.businessesRepo.findOne(branch.data.businessId);
		if (!business.data) throw new NotFoundError("Business not found");

		await this.assertWalkInAccess(branchId, session, signature, branch.data);

		const today = new Date().toISOString().slice(0, 10);
		const services = await this.servicesRepo.findByBranch(branchId);
		const catalog = await Promise.all(
			services.map(async (svc) => {
				const availability = await this.getAvailability(
					branchId,
					today,
					svc.id,
				);
				return {
					id: svc.id,
					name: svc.name,
					price: svc.price,
					duration: svc.duration,
					photoUrl: svc.imageUrl,
					nextSlot: availability.slots[0] ?? null,
				};
			}),
		);

		return {
			branchId,
			businessId: business.data.id,
			businessName: business.data.name,
			vertical: "booking" as const,
			brandPalette: business.data.brandPalette ?? null,
			services: catalog,
			snapshotAt: new Date().toISOString(),
		};
	}

	async submit(input: WalkInSubmitPayload, userId?: string) {
		if (input.vertical !== "booking") {
			throw new ValidationError("This branch accepts booking walk-ins only");
		}

		const resolvedUserId = userId ?? input.customer.userId ?? null;
		const customer: WalkInCustomer = resolvedUserId
			? { userId: resolvedUserId }
			: {
					guestName: input.customer.guestName,
					guestPhone: input.customer.guestPhone,
				};

		if (
			!resolvedUserId &&
			!input.customer.guestName &&
			!input.customer.guestPhone
		) {
			throw new ValidationError("Signed-in or guest details are required");
		}

		const customerError = validateWalkInCustomer(customer);
		if (customerError) throw new ValidationError(customerError);

		const existingBooking = await this.bookingsRepo.findByWalkInLocalId(
			input.localId,
		);
		if (existingBooking) {
			return {
				localId: input.localId,
				serverId: existingBooking.id,
				status: "accepted" as const,
			};
		}

		if (!input.booking) {
			throw new ValidationError("Booking details are required");
		}

		const booking = await this.createWalkInBooking(
			input,
			customer,
			resolvedUserId,
		);
		await this.queue.send({
			type: "notification.booking_created",
			bookingId: booking.id,
		});
		return {
			localId: input.localId,
			serverId: booking.id,
			status: "accepted" as const,
		};
	}

	async syncBatch(
		entries: WalkInSubmitPayload[],
		ownerId: string,
		scopedBranchIds: string[] | null,
	) {
		if (entries.length > MAX_SYNC_BATCH) {
			throw new ValidationError(
				`Sync batch cannot exceed ${MAX_SYNC_BATCH} entries`,
			);
		}

		const synced: Record<string, string> = {};
		for (const entry of entries) {
			if (entry.vertical !== "booking") {
				throw new ValidationError(
					"Only booking walk-in entries can be synced here",
				);
			}
			await this.authz.assertBranchAccess(
				ownerId,
				entry.branchId,
				scopedBranchIds,
			);
			const result = await this.submit(entry);
			synced[entry.localId] = result.serverId;
		}
		return { synced };
	}

	async regenerateBranchQr(
		ownerId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(ownerId, branchId, scopedBranchIds);

		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const business = await this.businessesRepo.findOne(branch.data.businessId);
		if (!business.data) throw new NotFoundError("Business not found");

		const version = (branch.data.walkInQrVersion ?? 0) + 1;
		await this.branchesRepo.updateOne(branchId, { walkInQrVersion: version });

		const payload = {
			branchId,
			businessId: business.data.id,
			vertical: "booking" as const,
			version,
		};
		const signature = await signBranchQr(payload, this.jwtSecret);

		return {
			...payload,
			signature,
			universalUrl: `https://talash.app/w/${branchId}?sig=${signature}`,
			deepLink: `mobileapp://walk-in?branchId=${branchId}&signature=${signature}`,
		};
	}

	async createSession(
		ownerId: string,
		branchId: string,
		scopedBranchIds: string[] | null,
	) {
		await this.authz.assertBranchAccess(ownerId, branchId, scopedBranchIds);
		if (!this.kv) {
			throw new ValidationError("Walk-in sessions are not available");
		}

		const branch = await this.branchesRepo.findOne(branchId);
		if (!branch.data) throw new NotFoundError("Branch not found");

		const sessionToken = crypto.randomUUID();
		const expiresAt = Date.now() + SESSION_TTL_SECS * 1000;
		const session: WalkInSession = { branchId, ownerId, expiresAt };

		await this.kv.put(
			`walk-in:session:${sessionToken}`,
			JSON.stringify(session),
			{
				expirationTtl: SESSION_TTL_SECS,
			},
		);

		return {
			sessionToken,
			branchId,
			expiresAt,
			universalUrl: `https://talash.app/w/${branchId}?s=${sessionToken}`,
			deepLink: `mobileapp://walk-in?branchId=${branchId}&session=${sessionToken}`,
		};
	}

	async listReceipts(userId: string) {
		const bookings = (await this.bookingsRepo.findByUser(userId)).filter(
			(b) => b.source === "walk_in" && b.walkInLocalId,
		);
		return {
			bookings: bookings.map((b) => ({
				localId: b.walkInLocalId,
				serverId: b.id,
				status: b.status,
				slot: b.slot,
				createdAt: b.createdAt,
			})),
		};
	}

	private async getAvailability(
		branchId: string,
		date: string,
		serviceId: string,
	) {
		const svcResult = await this.servicesRepo.findOne(serviceId);
		if (!svcResult.data) throw new NotFoundError("Service not found");
		if (svcResult.data.branchId !== branchId) {
			throw new ValidationError("Service does not belong to this branch");
		}

		const hours = await this.branchesRepo.findHours(branchId);
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

	private async assertWalkInAccess(
		branchId: string,
		session?: string,
		signature?: string,
		branch?: { businessId: string; walkInQrVersion: number },
	) {
		if (session) {
			const valid = await this.validateSession(session, branchId);
			if (valid) return;
		}

		if (signature && branch) {
			const business = await this.businessesRepo.findOne(branch.businessId);
			if (!business.data) throw new NotFoundError("Business not found");

			const payload = {
				branchId,
				businessId: business.data.id,
				vertical: "booking" as const,
				version: branch.walkInQrVersion ?? 0,
			};
			const ok = await verifyBranchQr(payload, signature, this.jwtSecret);
			if (ok) return;
			throw new ValidationError("Invalid QR code signature");
		}

		throw new ValidationError("A valid session or QR signature is required");
	}

	private async validateSession(sessionToken: string, branchId: string) {
		if (!this.kv) return false;
		const raw = await this.kv.get(`walk-in:session:${sessionToken}`);
		if (!raw) return false;

		let session: WalkInSession;
		try {
			session = JSON.parse(raw) as WalkInSession;
		} catch {
			return false;
		}

		if (session.branchId !== branchId) return false;
		if (session.expiresAt < Date.now()) return false;
		return true;
	}

	private async createWalkInBooking(
		input: WalkInSubmitPayload,
		customer: WalkInCustomer,
		userId: string | null,
	): Promise<BookingSelect> {
		const bookingInput = input.booking!;
		const svcResult = await this.servicesRepo.findOne(bookingInput.serviceId);
		if (!svcResult.data) throw new NotFoundError("Service not found");
		if (svcResult.data.branchId !== input.branchId) {
			throw new ValidationError("Service does not belong to this branch");
		}

		if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(bookingInput.slot)) {
			throw new ValidationError(
				"Slot must be an ISO local datetime, e.g. 2026-06-01T11:00:00",
			);
		}

		const conflict = await this.bookingsRepo.findConflict(
			input.branchId,
			bookingInput.serviceId,
			bookingInput.slot,
		);
		if (conflict) throw new ConflictError("This slot is no longer available");

		const slotEnd = addMinutes(bookingInput.slot, svcResult.data.duration);
		const overlapCount = await this.bookingsRepo.countOverlapping(
			input.branchId,
			bookingInput.slot,
			slotEnd,
		);
		if (overlapCount > 0) {
			throw new ConflictError(
				"The requested time window overlaps with an existing booking",
			);
		}

		const branchResult = await this.branchesRepo.findOne(input.branchId);
		if (!branchResult.data) throw new NotFoundError("Branch not found");

		const slotDateStr = bookingInput.slot.slice(0, 10);
		const dayOfWeek = new Date(`${slotDateStr}T12:00:00`).getDay();
		const hours = await this.branchesRepo.findHoursForSlot(
			input.branchId,
			dayOfWeek,
		);
		if (hours) {
			if (hours.isClosed) {
				throw new ValidationError("The branch is closed on the requested day");
			}
			if (hours.openTime && hours.closeTime) {
				const toMins = (hhmm: string) => {
					const [h, m] = hhmm.split(":").map(Number);
					return h * 60 + (m ?? 0);
				};
				const slotMins = toMins(bookingInput.slot.slice(11, 16));
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

		try {
			const result = await this.bookingsRepo.create({
				userId: userId ?? undefined,
				serviceId: bookingInput.serviceId,
				branchId: input.branchId,
				slot: bookingInput.slot,
				status: "Confirmed",
				price: svcResult.data.price,
				discount: 0,
				couponCode: null,
				source: "walk_in",
				guestName: customer.guestName ?? null,
				guestPhone: customer.guestPhone ?? null,
				walkInLocalId: input.localId,
			});
			if (!result.data) throw new NotFoundError("Failed to create booking");
			return result.data;
		} catch (err) {
			if (
				err instanceof Error &&
				err.message.includes("UNIQUE constraint failed")
			) {
				throw new ConflictError("This slot is no longer available");
			}
			throw err;
		}
	}
}
