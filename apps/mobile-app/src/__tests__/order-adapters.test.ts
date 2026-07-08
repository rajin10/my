import { describe, expect, it } from "vitest";
import {
	adaptCustomerAddress,
	adaptOrder,
	adaptOrderItem,
} from "../lib/adapters";

describe("adaptOrderItem", () => {
	it("computes lineTotal and falls back to 'Item' when no product name", () => {
		const r = adaptOrderItem({
			id: "i1",
			orderId: "o1",
			productId: "p1",
			quantity: 3,
			unitPrice: 100,
		});
		expect(r).toMatchObject({
			id: "i1",
			productId: "p1",
			quantity: 3,
			unitPrice: 100,
			lineTotal: 300,
			name: "Item",
		});
	});
	it("uses a provided product-name resolver", () => {
		const r = adaptOrderItem(
			{ id: "i1", orderId: "o1", productId: "p1", quantity: 2, unitPrice: 50 },
			(id) => (id === "p1" ? "12kg Cylinder" : undefined),
		);
		expect(r.name).toBe("12kg Cylinder");
	});
});

describe("adaptOrder", () => {
	it("maps fields and adapts items", () => {
		const r = adaptOrder({
			id: "o1",
			businessId: "b",
			branchId: "br",
			userId: "u",
			status: "Confirmed",
			total: 300,
			deliveryLine: "12 Rd",
			deliveryArea: "Banani",
			deliveryCity: "Dhaka",
			deliveryLat: null,
			deliveryLng: null,
			deliveredAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: null,
			items: [
				{
					id: "i1",
					orderId: "o1",
					productId: "p1",
					quantity: 3,
					unitPrice: 100,
				},
			],
		});
		expect(r).toMatchObject({
			id: "o1",
			branchId: "br",
			status: "Confirmed",
			total: 300,
			deliveryLine: "12 Rd",
		});
		expect(r.items[0].lineTotal).toBe(300);
	});
	it("defaults items to [] when absent (list rows)", () => {
		const r = adaptOrder({
			id: "o1",
			businessId: "b",
			branchId: "br",
			userId: "u",
			status: "Pending",
			total: 0,
			deliveryLine: "x",
			deliveryArea: null,
			deliveryCity: null,
			deliveryLat: null,
			deliveryLng: null,
			deliveredAt: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: null,
		});
		expect(r.items).toEqual([]);
	});
});

describe("adaptCustomerAddress", () => {
	it("maps all fields", () => {
		const r = adaptCustomerAddress({
			id: "a1",
			userId: "u",
			label: "Home",
			line: "12 Rd",
			area: "Banani",
			city: "Dhaka",
			lat: 1,
			lng: 2,
			isDefault: true,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: null,
		});
		expect(r).toEqual({
			id: "a1",
			label: "Home",
			line: "12 Rd",
			area: "Banani",
			city: "Dhaka",
			lat: 1,
			lng: 2,
			isDefault: true,
		});
	});
});
