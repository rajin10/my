import type { CustomerAddressSelect } from "@core/database/schema/customer-addresses.schema";
import { faker } from "@faker-js/faker";
import { BD_CITIES } from "./business.factory.ts";

const ADDRESS_LABELS = ["Home", "Office"] as const;

export function createCustomerAddress(
	userId: string,
	overrides: Partial<CustomerAddressSelect> = {},
): CustomerAddressSelect {
	const city = faker.helpers.arrayElement(BD_CITIES);
	const createdAt = faker.date.past({ years: 1 }).toISOString();
	const hasCoords = faker.datatype.boolean(0.6);
	return {
		id: crypto.randomUUID(),
		userId,
		label: faker.helpers.arrayElement(ADDRESS_LABELS),
		line: `${faker.location.buildingNumber()} ${faker.location.street()}`,
		area: faker.location.county(),
		city,
		lat: hasCoords ? faker.location.latitude() : null,
		lng: hasCoords ? faker.location.longitude() : null,
		isDefault: false,
		createdAt,
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
