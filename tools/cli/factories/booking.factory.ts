import {
	type BookingSelect,
	BookingStatus,
} from "@core/database/schema/bookings.schema";
import { faker } from "@faker-js/faker";

function randomSlot(): string {
	const now = new Date();
	const from = new Date(now);
	from.setMonth(from.getMonth() - 6);
	const to = new Date(now);
	to.setMonth(to.getMonth() + 3);

	const date = faker.date.between({ from, to });
	date.setHours(
		faker.number.int({ min: 9, max: 19 }),
		faker.helpers.arrayElement([0, 30]),
		0,
		0,
	);
	// "2026-06-01T11:00:00"
	return date.toISOString().slice(0, 19);
}

export function createBooking(
	userId: string,
	serviceId: string,
	branchId: string,
	servicePrice: number,
	overrides: Partial<BookingSelect> = {},
): BookingSelect {
	const slot = randomSlot();
	const isPast = new Date(slot) < new Date();

	const status = isPast
		? faker.helpers.weightedArrayElement([
				{ weight: 6, value: BookingStatus.COMPLETED },
				{ weight: 3, value: BookingStatus.CANCELLED },
				{ weight: 1, value: BookingStatus.CONFIRMED },
			])
		: faker.helpers.weightedArrayElement([
				{ weight: 5, value: BookingStatus.PENDING },
				{ weight: 4, value: BookingStatus.CONFIRMED },
				{ weight: 1, value: BookingStatus.CANCELLED },
			]);

	const maxDiscount = Math.max(0, Math.floor(servicePrice * 0.3));
	const discount =
		faker.datatype.boolean(0.2) && maxDiscount > 0
			? faker.number.int({ min: 0, max: maxDiscount })
			: 0;

	return {
		id: crypto.randomUUID(),
		userId,
		serviceId,
		branchId,
		slot,
		status,
		price: servicePrice,
		discount,
		couponCode: null,
		createdAt: faker.date.past({ years: 1 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
