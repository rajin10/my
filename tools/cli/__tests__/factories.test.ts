import { describe, expect, it, test } from "bun:test";
import { faker } from "@faker-js/faker";
import { createBooking } from "../factories/booking.factory.ts";
import {
	BD_CITIES,
	BUSINESS_CATEGORIES,
	createBusiness,
} from "../factories/business.factory.ts";
import { createBranch } from "../factories/branch.factory.ts";
import { createCustomerAddress } from "../factories/customer-address.factory.ts";
import { createOrder } from "../factories/order.factory.ts";
import { createProduct } from "../factories/product.factory.ts";
import { createService } from "../factories/service.factory.ts";
import { createUser } from "../factories/user.factory.ts";

describe("user.factory", () => {
	test("creates a user with required fields", () => {
		const user = createUser();
		expect(user.id).toBeString();
		expect(user.email).toContain("@");
		expect(user.name).toBeString();
		expect(user.role).toBeDefined();
	});

	test("applies overrides", () => {
		const user = createUser({ email: "custom@example.com" });
		expect(user.email).toBe("custom@example.com");
	});
});

describe("business.factory", () => {
	test("creates a business with required fields", () => {
		const business = createBusiness("owner-1");
		expect(business.id).toBeString();
		expect(business.name).toBeString();
		expect(business.city).toBeOneOf([...BD_CITIES]);
		expect(business.category).toBeOneOf([...BUSINESS_CATEGORIES]);
		expect(business.ownerId).toBe("owner-1");
	});

	test("applies overrides", () => {
		const business = createBusiness("owner-1", { city: "Dhaka" });
		expect(business.city).toBe("Dhaka");
	});
});

describe("service.factory", () => {
	test("creates a service with positive price and duration", () => {
		const service = createService("b-1");
		expect(service.price).toBeGreaterThan(0);
		expect(service.duration).toBeGreaterThan(0);
		expect(service.branchId).toBe("b-1");
	});

	test("applies overrides", () => {
		const service = createService("b-1", { name: "Custom Service" });
		expect(service.name).toBe("Custom Service");
	});
});

describe("booking.factory", () => {
	test("creates a booking with required fields", () => {
		const booking = createBooking("u-1", "s-1", "b-1", 50000);
		expect(booking.id).toBeString();
		expect(booking.userId).toBe("u-1");
		expect(booking.serviceId).toBe("s-1");
		expect(booking.branchId).toBe("b-1");
	});

	test("discount does not exceed service price", () => {
		const price = 10000;
		const booking = createBooking("u-1", "s-1", "b-1", price);
		expect(booking.discount).toBeGreaterThanOrEqual(0);
		expect(booking.discount).toBeLessThanOrEqual(price);
	});
});

describe("product.factory", () => {
	test("creates a product with positive price and non-negative stock", () => {
		const product = createProduct("branch-1");
		expect(product.branchId).toBe("branch-1");
		expect(product.price).toBeGreaterThan(0);
		expect(product.stock).toBeGreaterThanOrEqual(0);
	});

	test("applies overrides", () => {
		const product = createProduct("branch-1", { stock: 0 });
		expect(product.stock).toBe(0);
	});
});

describe("customer-address.factory", () => {
	test("creates an address with required fields", () => {
		const addr = createCustomerAddress("u-1");
		expect(addr.userId).toBe("u-1");
		expect(addr.line).toBeString();
		expect(addr.isDefault).toBe(false);
	});

	test("applies overrides", () => {
		const addr = createCustomerAddress("u-1", { isDefault: true });
		expect(addr.isDefault).toBe(true);
	});
});

describe("order.factory", () => {
	test("sets deliveredAt only for Delivered orders", () => {
		const delivered = createOrder({
			businessId: "biz-1",
			branchId: "branch-1",
			userId: "u-1",
			status: "Delivered",
			total: 5000,
		});
		expect(delivered.deliveredAt).toBeString();

		const pending = createOrder({
			businessId: "biz-1",
			branchId: "branch-1",
			userId: "u-1",
			status: "Pending",
			total: 5000,
		});
		expect(pending.deliveredAt).toBeNull();
	});

	test("carries through ids and total", () => {
		const order = createOrder({
			businessId: "biz-1",
			branchId: "branch-1",
			userId: "u-1",
			status: "Confirmed",
			total: 12345,
		});
		expect(order.businessId).toBe("biz-1");
		expect(order.branchId).toBe("branch-1");
		expect(order.userId).toBe("u-1");
		expect(order.total).toBe(12345);
		expect(order.deliveryLine).toBeString();
	});
});

describe("createBranch coordinates", () => {
	it("assigns lat/lng inside Bangladesh's bounding box", () => {
		const b = createBranch("biz-1", "Dhaka");
		expect(b.lat).not.toBeNull();
		expect(b.lng).not.toBeNull();
		// Bangladesh bounding box (approx): lat 20.5–26.7, lng 88.0–92.7
		expect(b.lat as number).toBeGreaterThan(20.5);
		expect(b.lat as number).toBeLessThan(26.7);
		expect(b.lng as number).toBeGreaterThan(88.0);
		expect(b.lng as number).toBeLessThan(92.7);
	});

	it("is deterministic under a fixed faker seed", () => {
		faker.seed(42);
		const a = createBranch("biz-1", "Dhaka");
		faker.seed(42);
		const b = createBranch("biz-1", "Dhaka");
		expect([a.lat, a.lng]).toEqual([b.lat, b.lng]);
	});
});
