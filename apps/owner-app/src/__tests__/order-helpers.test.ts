import type { Order, OrderItem } from "@repo/api-client";
import { describe, expect, it } from "vitest";
import type { Product } from "../data";
import {
	isOrderCancellable,
	nextOrderActionLabel,
	nextOrderStatus,
	partitionOrders,
} from "../data";
import { adaptOrderLine } from "../lib/adapters";

const order = (status: Order["status"]): Order =>
	({ id: status, status }) as Order;

describe("nextOrderStatus", () => {
	it("walks the forward machine and stops at terminals", () => {
		expect(nextOrderStatus("Pending")).toBe("Confirmed");
		expect(nextOrderStatus("Confirmed")).toBe("OutForDelivery");
		expect(nextOrderStatus("OutForDelivery")).toBe("Delivered");
		expect(nextOrderStatus("Delivered")).toBeNull();
		expect(nextOrderStatus("Cancelled")).toBeNull();
	});
});

describe("nextOrderActionLabel", () => {
	it("labels each forward action", () => {
		expect(nextOrderActionLabel("Confirmed")).toBe("Confirm order");
		expect(nextOrderActionLabel("OutForDelivery")).toBe(
			"Mark out for delivery",
		);
		expect(nextOrderActionLabel("Delivered")).toBe("Mark delivered");
	});
});

describe("isOrderCancellable", () => {
	it("allows cancel only from Pending or Confirmed", () => {
		expect(isOrderCancellable("Pending")).toBe(true);
		expect(isOrderCancellable("Confirmed")).toBe(true);
		expect(isOrderCancellable("OutForDelivery")).toBe(false);
		expect(isOrderCancellable("Delivered")).toBe(false);
		expect(isOrderCancellable("Cancelled")).toBe(false);
	});
});

describe("partitionOrders", () => {
	it("splits active vs done", () => {
		const { active, done } = partitionOrders([
			order("Pending"),
			order("OutForDelivery"),
			order("Delivered"),
			order("Cancelled"),
		]);
		expect(active.map((o) => o.status)).toEqual(["Pending", "OutForDelivery"]);
		expect(done.map((o) => o.status)).toEqual(["Delivered", "Cancelled"]);
	});
});

const item = (over: Partial<OrderItem>): OrderItem =>
	({
		id: "i1",
		orderId: "o1",
		productId: "p1",
		quantity: 2,
		unitPrice: 150,
		createdAt: "",
		updatedAt: null,
		...over,
	}) as OrderItem;

const products: Product[] = [
	{
		id: "p1",
		name: "Hair Oil",
		branch: "Gulshan",
		category: null,
		price: 150,
		stock: 9,
		status: "Active",
	} as Product,
];

describe("adaptOrderLine", () => {
	it("resolves the product name and computes the line total", () => {
		const line = adaptOrderLine(item({}), products);
		expect(line.name).toBe("Hair Oil");
		expect(line.quantity).toBe(2);
		expect(line.lineTotal).toBe(300);
	});

	it("falls back to a placeholder when the product is missing", () => {
		const line = adaptOrderLine(item({ productId: "gone" }), products);
		expect(line.name).toBe("Unknown product");
	});
});
