import { bookingsSchema } from "@core/database/schema/bookings.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import { createBooking } from "../factories/booking.factory.ts";
import type { BookingRef, SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

interface BookingsResult extends SeedResult {
	bookingRefs: BookingRef[];
}

export async function seedBookings(
	db: DbClient,
	userIds: string[],
	businessIds: string[],
	businessBranches: Record<string, string[]>,
	branchServices: Record<string, string[]>,
	servicePrices: Record<string, number>,
): Promise<BookingsResult> {
	const bookingRefs: BookingRef[] = [];
	const allBookings = [];

	for (const userId of userIds) {
		const bookingCount = faker.number.int({ min: 0, max: 5 });

		for (let i = 0; i < bookingCount; i++) {
			const businessId = faker.helpers.arrayElement(businessIds);
			const branches = businessBranches[businessId];
			if (!branches?.length) continue;

			const branchId = faker.helpers.arrayElement(branches);
			const services = branchServices[branchId];
			if (!services?.length) continue;

			const serviceId = faker.helpers.arrayElement(services);
			const servicePrice = servicePrices[serviceId] ?? 50000;

			const booking = createBooking(userId, serviceId, branchId, servicePrice);
			allBookings.push(booking);
			bookingRefs.push({
				bookingId: booking.id,
				userId,
				businessId,
				serviceId,
				branchId,
				status: booking.status,
				price: booking.price,
			});
		}
	}

	for (let i = 0; i < allBookings.length; i += CHUNK) {
		await db
			.insert(bookingsSchema as never)
			.values(allBookings.slice(i, i + CHUNK));
	}

	return { module: "bookings", inserted: allBookings.length, bookingRefs };
}
