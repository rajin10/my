import {
	type OrderSelect,
	OrderStatus,
} from "@core/database/schema/orders.schema";
import { faker } from "@faker-js/faker";
import { BD_CITIES } from "./business.factory.ts";

/**
 * Picks a delivery-relevant status with a realistic mix: roughly half the orders
 * are terminal Delivered, the rest spread across the active lifecycle plus a few
 * Cancelled. Callers set `total`/`deliveredAt` from the chosen status.
 */
export function pickOrderStatus() {
	return faker.helpers.weightedArrayElement([
		{ weight: 5, value: OrderStatus.DELIVERED },
		{ weight: 2, value: OrderStatus.PENDING },
		{ weight: 2, value: OrderStatus.CONFIRMED },
		{ weight: 1, value: OrderStatus.OUT_FOR_DELIVERY },
		{ weight: 1, value: OrderStatus.CANCELLED },
	]);
}

interface OrderFactoryInput {
	businessId: string;
	branchId: string;
	userId: string;
	status: OrderSelect["status"];
	total: number;
	/** Optional snapshot from a customer address; falls back to faker. */
	delivery?: {
		line: string;
		area: string | null;
		city: string | null;
		lat: number | null;
		lng: number | null;
	};
}

export function createOrder(
	input: OrderFactoryInput,
	overrides: Partial<OrderSelect> = {},
): OrderSelect {
	const createdAt = faker.date.past({ years: 1 }).toISOString();
	const delivery = input.delivery ?? {
		line: `${faker.location.buildingNumber()} ${faker.location.street()}`,
		area: faker.location.county(),
		city: faker.helpers.arrayElement(BD_CITIES),
		lat: faker.location.latitude(),
		lng: faker.location.longitude(),
	};

	return {
		id: crypto.randomUUID(),
		businessId: input.businessId,
		branchId: input.branchId,
		userId: input.userId,
		status: input.status,
		total: input.total,
		deliveryLine: delivery.line,
		deliveryArea: delivery.area,
		deliveryCity: delivery.city,
		deliveryLat: delivery.lat,
		deliveryLng: delivery.lng,
		// deliveredAt is only meaningful once the order reaches the terminal Delivered state.
		deliveredAt:
			input.status === OrderStatus.DELIVERED
				? faker.date.recent({ days: 60 }).toISOString()
				: null,
		createdAt,
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
