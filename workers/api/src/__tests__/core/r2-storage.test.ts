import { describe, expect, it, vi } from "vitest";
import { R2Storage } from "../../core/storage/r2";

function makeBucket() {
	return {
		put: vi.fn().mockResolvedValue(undefined),
		delete: vi.fn().mockResolvedValue(undefined),
	} as unknown as R2Bucket;
}

describe("R2Storage public URL normalization", () => {
	it("prepends https:// when the configured base lacks a scheme", () => {
		const storage = new R2Storage(makeBucket(), "storage.talash.bd");
		expect(storage.url("users/1/a.png")).toBe(
			"https://storage.talash.bd/users/1/a.png",
		);
	});

	it("keeps an existing https:// scheme intact", () => {
		const storage = new R2Storage(makeBucket(), "https://storage.talash.bd");
		expect(storage.url("businesses/1/b.jpg")).toBe(
			"https://storage.talash.bd/businesses/1/b.jpg",
		);
	});

	it("preserves an http:// scheme (e.g. local dev)", () => {
		const storage = new R2Storage(makeBucket(), "http://localhost:8787");
		expect(storage.url("k")).toBe("http://localhost:8787/k");
	});

	it("drops a trailing slash on the base so the key join stays single", () => {
		const storage = new R2Storage(makeBucket(), "https://storage.talash.bd/");
		expect(storage.url("k")).toBe("https://storage.talash.bd/k");
	});

	it("returns an absolute URL from upload()", async () => {
		const storage = new R2Storage(makeBucket(), "storage.talash.bd");
		const url = await storage.upload(
			"users/1/a.png",
			new ArrayBuffer(0),
			"image/png",
		);
		expect(url).toBe("https://storage.talash.bd/users/1/a.png");
	});
});
