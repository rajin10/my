import { productsSchema } from "@core/database/schema/products.schema.ts";
import { faker } from "@faker-js/faker";
import type { DbClient } from "../core/db.ts";
import { createProduct } from "../factories/product.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

interface ProductsResult extends SeedResult {
	branchProducts: Record<string, string[]>; // branchId -> productId[]
	productPrices: Record<string, number>; // productId -> price
	productStock: Record<string, number>; // productId -> initial stock
}

/**
 * Seeds products for the branches of commerce-vertical businesses only.
 * Booking-vertical branches sell services, not products.
 */
export async function seedProducts(
	db: DbClient,
	commerceBusinessIds: string[],
	businessBranches: Record<string, string[]>,
): Promise<ProductsResult> {
	const branchProducts: Record<string, string[]> = {};
	const productPrices: Record<string, number> = {};
	const productStock: Record<string, number> = {};

	const commerceBranchIds = commerceBusinessIds.flatMap(
		(businessId) => businessBranches[businessId] ?? [],
	);

	const products = commerceBranchIds.flatMap((branchId) => {
		const count = faker.number.int({ min: 4, max: 12 });
		const list = Array.from({ length: count }, () => createProduct(branchId));
		branchProducts[branchId] = list.map((p) => p.id);
		for (const p of list) {
			productPrices[p.id] = p.price;
			productStock[p.id] = p.stock;
		}
		return list;
	});

	for (let i = 0; i < products.length; i += CHUNK) {
		await db
			.insert(productsSchema as never)
			.values(products.slice(i, i + CHUNK));
	}

	return {
		module: "products",
		inserted: products.length,
		branchProducts,
		productPrices,
		productStock,
	};
}
