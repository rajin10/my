import { customerAddressesSchema } from "@core/database/schema/customer-addresses.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import { createCustomerAddress } from "../factories/customer-address.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

/**
 * Seeds 1–2 delivery addresses per customer. Exactly one address per user is
 * marked isDefault.
 */
export async function seedCustomerAddresses(
	db: DbClient,
	userIds: string[],
): Promise<SeedResult> {
	const addresses = userIds.flatMap((userId) => {
		const count = faker.number.int({ min: 1, max: 2 });
		return Array.from({ length: count }, (_, index) =>
			createCustomerAddress(userId, {
				label: index === 0 ? "Home" : "Office",
				isDefault: index === 0, // first address is the default
			}),
		);
	});

	for (let i = 0; i < addresses.length; i += CHUNK) {
		await db
			.insert(customerAddressesSchema as never)
			.values(addresses.slice(i, i + CHUNK));
	}

	return { module: "customer_addresses", inserted: addresses.length };
}
