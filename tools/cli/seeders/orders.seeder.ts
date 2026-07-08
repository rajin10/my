import { orderItemsSchema } from "@core/database/schema/order-items.schema.ts";
import { ordersSchema } from "@core/database/schema/orders.schema.ts";
import { productsSchema } from "@core/database/schema/products.schema.ts";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import type { DbClient } from "../core/db.ts";
import { createOrder, pickOrderStatus } from "../factories/order.factory.ts";
import type { SeedResult } from "./seeder.types.ts";

const CHUNK = 500;

interface OrdersResult extends SeedResult {
	orderCount: number;
	itemCount: number;
	/** `${businessId}:${userId}` → Σ delivered order totals, for payments seeder. */
	deliveredTotals: Record<string, number>;
}

/**
 * Seeds orders + order_items for every commerce-vertical business.
 *
 * Stock consistency: products were seeded with generous stock. Here we keep a
 * working in-memory copy of each product's stock, only create a line if the
 * product still has enough, and decrement it. After all orders are built we
 * persist the decremented stock back to the product rows. Because everything is
 * computed in memory before insert, the products_stock_nonneg CHECK can never
 * abort the run.
 */
export async function seedOrders(
	db: DbClient,
	commerceBusinessIds: string[],
	businessBranches: Record<string, string[]>,
	branchProducts: Record<string, string[]>,
	productPrices: Record<string, number>,
	productStock: Record<string, number>,
	customerUserIds: string[],
): Promise<OrdersResult> {
	if (commerceBusinessIds.length === 0 || customerUserIds.length === 0) {
		return {
			module: "orders",
			inserted: 0,
			orderCount: 0,
			itemCount: 0,
			deliveredTotals: {},
		};
	}

	// Working copy of stock we decrement as orders consume it.
	const remainingStock: Record<string, number> = { ...productStock };
	const touchedProducts = new Set<string>();

	/** `${businessId}:${userId}` → Σ total for Delivered orders only. */
	const deliveredTotals: Record<string, number> = {};

	const orders = [];
	const orderItems = [];

	for (const businessId of commerceBusinessIds) {
		const branches = (businessBranches[businessId] ?? []).filter(
			(branchId) => (branchProducts[branchId]?.length ?? 0) > 0,
		);
		if (branches.length === 0) continue;

		const orderCount = faker.number.int({ min: 2, max: 6 });
		for (let i = 0; i < orderCount; i++) {
			const branchId = faker.helpers.arrayElement(branches);
			const productIds = branchProducts[branchId];
			if (!productIds?.length) continue;

			const userId = faker.helpers.arrayElement(customerUserIds);
			const lineCount = faker.number.int({ min: 1, max: 3 });
			const chosen = faker.helpers.arrayElements(
				productIds,
				Math.min(lineCount, productIds.length),
			);

			const builtItems: {
				productId: string;
				quantity: number;
				unitPrice: number;
			}[] = [];
			let total = 0;
			for (const productId of chosen) {
				const available = remainingStock[productId] ?? 0;
				if (available <= 0) continue;
				const quantity = faker.number.int({
					min: 1,
					max: Math.min(5, available),
				});
				const unitPrice = productPrices[productId] ?? 0;
				remainingStock[productId] = available - quantity;
				touchedProducts.add(productId);
				total += quantity * unitPrice;
				builtItems.push({ productId, quantity, unitPrice });
			}

			// Skip orders that ended up with no affordable stock.
			if (builtItems.length === 0) continue;

			const order = createOrder({
				businessId,
				branchId,
				userId,
				status: pickOrderStatus(),
				total,
			});
			orders.push(order);
			if (order.status === "Delivered") {
				const key = `${businessId}:${userId}`;
				deliveredTotals[key] = (deliveredTotals[key] ?? 0) + total;
			}
			for (const item of builtItems) {
				orderItems.push({
					id: crypto.randomUUID(),
					orderId: order.id,
					productId: item.productId,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					createdAt: order.createdAt,
					updatedAt: new Date().toISOString(),
					deletedAt: null,
				});
			}
		}
	}

	for (let i = 0; i < orders.length; i += CHUNK) {
		await db.insert(ordersSchema as never).values(orders.slice(i, i + CHUNK));
	}
	for (let i = 0; i < orderItems.length; i += CHUNK) {
		await db
			.insert(orderItemsSchema as never)
			.values(orderItems.slice(i, i + CHUNK));
	}

	// Persist decremented stock so the DB reflects what these orders consumed.
	for (const productId of touchedProducts) {
		await db
			.update(productsSchema)
			.set({ stock: remainingStock[productId] })
			.where(eq(productsSchema.id, productId));
	}

	return {
		module: "orders",
		inserted: orders.length + orderItems.length,
		orderCount: orders.length,
		itemCount: orderItems.length,
		deliveredTotals,
	};
}
