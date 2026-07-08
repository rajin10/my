import type {
	Branch as ApiBranch,
	Product as ApiProduct,
} from "@repo/api-client";
import { describe, expect, it } from "vitest";
import { adaptProduct } from "../lib/adapters";

const branches = [
	{ id: "br1", name: "Gulshan" },
	{ id: "br2", name: "Banani" },
] as ApiBranch[];

function makeApiProduct(over: Partial<ApiProduct> = {}): ApiProduct {
	return {
		id: "p1",
		branchId: "br1",
		name: "12kg LPG Cylinder",
		category: "Cylinder",
		price: 1200,
		stock: 10,
		description: "Standard household cylinder",
		imageUrl: "https://cdn/x.jpg",
		status: "Active",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: null,
		...over,
	};
}

describe("adaptProduct", () => {
	it("maps API fields and resolves branchId → branch name", () => {
		const p = adaptProduct(makeApiProduct(), branches);
		expect(p).toEqual({
			id: "p1",
			name: "12kg LPG Cylinder",
			branch: "Gulshan",
			category: "Cylinder",
			price: 1200,
			stock: 10,
			desc: "Standard household cylinder",
			status: "Active",
			photoUrl: "https://cdn/x.jpg",
		});
	});

	it("falls back to the raw branchId when the branch is not found", () => {
		const p = adaptProduct(makeApiProduct({ branchId: "missing" }), branches);
		expect(p.branch).toBe("missing");
	});

	it("preserves a null category (no badge will render) and null image", () => {
		const p = adaptProduct(
			makeApiProduct({ category: null, imageUrl: null }),
			branches,
		);
		expect(p.category).toBeNull();
		expect(p.photoUrl).toBeNull();
	});

	it("maps a null description to undefined desc", () => {
		const p = adaptProduct(makeApiProduct({ description: null }), branches);
		expect(p.desc).toBeUndefined();
	});

	it("carries through zero stock (out of stock) and Inactive status", () => {
		const p = adaptProduct(
			makeApiProduct({ stock: 0, status: "Inactive" }),
			branches,
		);
		expect(p.stock).toBe(0);
		expect(p.status).toBe("Inactive");
	});
});
