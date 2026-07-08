import { describe, expect, it } from "vitest";
import type { CartLine } from "../data";
import {
	addToCart,
	cartTotal,
	removeFromCart,
	setQty,
	toOrderItems,
} from "../lib/cart";

const p = { productId: "p1", name: "Cyl", unitPrice: 100 };

describe("cart", () => {
	it("adds a new line with quantity 1, then increments on re-add", () => {
		let c: CartLine[] = [];
		c = addToCart(c, p);
		expect(c).toEqual([{ ...p, quantity: 1 }]);
		c = addToCart(c, p);
		expect(c[0].quantity).toBe(2);
	});
	it("setQty replaces quantity; qty<=0 removes the line", () => {
		let c = addToCart([], p);
		c = setQty(c, "p1", 5);
		expect(c[0].quantity).toBe(5);
		c = setQty(c, "p1", 0);
		expect(c).toEqual([]);
	});
	it("removeFromCart drops the line", () => {
		const c = removeFromCart(addToCart([], p), "p1");
		expect(c).toEqual([]);
	});
	it("cartTotal sums quantity*unitPrice", () => {
		let c = addToCart([], p); // 100
		c = addToCart(c, { productId: "p2", name: "Reg", unitPrice: 50 }); // +50
		c = setQty(c, "p1", 2); // 200
		expect(cartTotal(c)).toBe(250);
	});
	it("toOrderItems maps to {productId, quantity}", () => {
		const c = setQty(addToCart([], p), "p1", 3);
		expect(toOrderItems(c)).toEqual([{ productId: "p1", quantity: 3 }]);
	});
});
