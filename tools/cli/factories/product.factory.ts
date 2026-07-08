import {
	type ProductSelect,
	ProductStatus,
} from "@core/database/schema/products.schema";
import { faker } from "@faker-js/faker";

export const PRODUCT_CATEGORIES = [
	"Skincare",
	"Haircare",
	"Makeup",
	"Fragrance",
	"Nailcare",
	"Bath & Body",
	"Tools & Accessories",
	"Grooming",
] as const;

export function createProduct(
	branchId: string,
	overrides: Partial<ProductSelect> = {},
): ProductSelect {
	return {
		id: crypto.randomUUID(),
		branchId,
		name: faker.commerce.productName(),
		category: faker.helpers.arrayElement(PRODUCT_CATEGORIES),
		// price in smallest currency unit (paisa); BDT 100–5000 range.
		price: faker.number.int({ min: 10000, max: 500000 }),
		// Generous starting stock so seeded orders never breach products_stock_nonneg.
		stock: faker.number.int({ min: 20, max: 200 }),
		description: faker.commerce.productDescription(),
		imageUrl: `https://picsum.photos/seed/${crypto.randomUUID().slice(0, 8)}/600/600`,
		status: faker.helpers.weightedArrayElement([
			{ weight: 9, value: ProductStatus.ACTIVE },
			{ weight: 1, value: ProductStatus.INACTIVE },
		]),
		createdAt: faker.date.past({ years: 1 }).toISOString(),
		updatedAt: new Date().toISOString(),
		deletedAt: null,
		...overrides,
	};
}
