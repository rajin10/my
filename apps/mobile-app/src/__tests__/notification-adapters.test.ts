import { describe, expect, it } from "vitest";
import { mapNotificationType, orderNotifParams } from "../lib/adapters";

describe("mapNotificationType", () => {
	it("maps the order status type to its own local type", () => {
		expect(mapNotificationType("order")).toBe("order");
	});

	it("maps an order cancellation to its own local type (distinct icon)", () => {
		expect(mapNotificationType("order_cancelled")).toBe("order_cancelled");
	});

	it("maps booking/review through to their local types", () => {
		expect(mapNotificationType("booking")).toBe("confirmed");
		expect(mapNotificationType("review")).toBe("review");
	});

	it("keeps booking cancellations and unknown types on the system fallback", () => {
		expect(mapNotificationType("cancel")).toBe("system");
		expect(mapNotificationType("whatever")).toBe("system");
	});
});

describe("orderNotifParams", () => {
	it("deep-links an order notification carrying an orderId straight to that order", () => {
		expect(orderNotifParams({ go: "orders", orderId: "o-1" })).toEqual({
			view: "orders",
			orderId: "o-1",
		});
	});

	it("opens the My Orders list (no orderId) when the order notification has none", () => {
		expect(orderNotifParams({ go: "orders", orderId: null })).toEqual({
			view: "orders",
		});
		expect(orderNotifParams({ go: "orders" })).toEqual({ view: "orders" });
	});

	it("returns null for non-order notifications (they route by their own tab)", () => {
		expect(orderNotifParams({ go: "bookings", orderId: null })).toBeNull();
		expect(orderNotifParams({ go: "reviews" })).toBeNull();
		expect(orderNotifParams({})).toBeNull();
	});
});
