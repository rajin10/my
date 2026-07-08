import { getDB } from "@repo/core/src/database/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchService } from "../../../modules/search/search.service";
import { TEST_ENV } from "../../helpers/auth";
import { createTestApp } from "../../helpers/create-test-app";

vi.mock("@repo/core/src/database/client", () => ({
	getDB: vi.fn(),
	eq: vi.fn(),
	and: vi.fn(),
	like: vi.fn(),
	isNull: vi.fn(),
	inArray: vi.fn(),
	avg: vi.fn(),
	min: vi.fn(),
	sql: vi.fn(),
	gte: vi.fn(),
	lte: vi.fn(),
}));

const makeChain = (): Record<string, (...args: unknown[]) => unknown> => {
	const chain: Record<string, (...args: unknown[]) => unknown> = {};
	const self = () => chain;
	chain.select = vi.fn(self);
	chain.from = vi.fn(self);
	chain.leftJoin = vi.fn(self);
	chain.where = vi.fn(self);
	chain.groupBy = vi.fn(self);
	chain.limit = vi.fn().mockResolvedValue([]);
	return chain;
};

beforeEach(() => {
	vi.mocked(getDB).mockReturnValue(makeChain() as never);
});

const app = createTestApp({ searchService: new SearchService() });

describe("GET /api/v1/search (public)", () => {
	it("returns 200 with empty results when no businesses match", async () => {
		const res = await app.request("/api/v1/search?q=test", {}, TEST_ENV);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.data).toEqual([]);
		expect(body.aiRanked).toBe(false);
	});

	it("returns 200 with sortBy and limit params", async () => {
		const res = await app.request(
			"/api/v1/search?sortBy=rating&limit=5",
			{},
			TEST_ENV,
		);
		expect(res.status).toBe(200);
	});

	it("returns booking search results shape", async () => {
		const res = await app.request("/api/v1/search", {}, TEST_ENV);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: unknown[]; aiRanked: boolean };
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.aiRanked).toBe(false);
	});
});
