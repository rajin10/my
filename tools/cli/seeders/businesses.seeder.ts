import {
	businessesSchema,
	businessPhotosSchema,
} from "@core/database/schema/businesses.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import {
	createBusiness,
	EXAMPLE_BRAND_PALETTE,
} from "../factories/business.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 200;

interface BusinessesResult extends SeedResult {
	businessIds: string[];
	commerceBusinessIds: string[]; // subset with vertical === "commerce"
	businessCities: Record<string, string>; // businessId -> city
	businessOwnerIds: Record<string, string>; // businessId -> ownerId
}

export async function seedBusinesses(
	db: DbClient,
	ownerIds: string[],
): Promise<BusinessesResult> {
	const businesses = ownerIds.flatMap((ownerId, ownerIndex) => {
		const count = faker.number.int({ min: 1, max: 3 });
		return Array.from({ length: count }, (_, businessIndex) =>
			// ~25% of businesses are commerce so orders/products have data to seed
			// against. The very first business is forced to commerce so a default
			// `db seed`/`db fresh` always produces some products + orders.
			createBusiness(ownerId, {
				vertical:
					ownerIndex === 0 && businessIndex === 0
						? "commerce"
						: faker.datatype.boolean(0.25)
							? "commerce"
							: "booking",
			}),
		);
	});

	// Theme the first booking-vertical business with an example custom palette so
	// the white-label render path (owner app + customer venue/booking flow) always
	// has a themed tenant to exercise. The palette is WCAG-AA-safe (ADR-0003).
	const themed = businesses.find((b) => b.vertical === "booking");
	if (themed) {
		themed.brandPalette = EXAMPLE_BRAND_PALETTE;
	}

	for (let i = 0; i < businesses.length; i += CHUNK) {
		await db
			.insert(businessesSchema as never)
			.values(businesses.slice(i, i + CHUNK));
	}

	const photos = businesses.flatMap((business) => {
		const count = faker.number.int({ min: 1, max: 4 });
		return Array.from({ length: count }, (_, order) => ({
			id: crypto.randomUUID(),
			businessId: business.id,
			url: `https://picsum.photos/seed/${business.id.slice(0, 8)}${order}/800/600`,
			displayOrder: order,
			createdAt: business.createdAt,
			updatedAt: new Date().toISOString(),
			deletedAt: null,
		}));
	});

	for (let i = 0; i < photos.length; i += CHUNK) {
		await db
			.insert(businessPhotosSchema as never)
			.values(photos.slice(i, i + CHUNK));
	}

	const businessCities: Record<string, string> = {};
	const businessOwnerIds: Record<string, string> = {};
	for (const v of businesses) {
		businessCities[v.id] = v.city;
		businessOwnerIds[v.id] = v.ownerId;
	}

	return {
		module: "businesses",
		inserted: businesses.length + photos.length,
		businessIds: businesses.map((v) => v.id),
		commerceBusinessIds: businesses
			.filter((v) => v.vertical === "commerce")
			.map((v) => v.id),
		businessCities,
		businessOwnerIds,
	};
}
