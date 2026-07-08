import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import type { RerankAI } from "./booking-strategy";
import { SearchResultSchema } from "./result";
import { SearchService } from "./search.service";

const searchRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Search"],
	summary: "Search booking businesses",
	description:
		"Booking vertical discovery: full-text filter + optional AI re-rank.",
	request: {
		query: z.object({
			q: z.string().optional().openapi({ description: "Search query" }),
			city: z.string().optional(),
			category: z.string().optional(),
			minPrice: z.coerce.number().int().nonnegative().optional(),
			maxPrice: z.coerce.number().int().nonnegative().optional(),
			minRating: z.coerce.number().min(0).max(5).optional(),
			sortBy: z
				.enum(["recommended", "rating", "price"])
				.default("recommended")
				.optional(),
			limit: z.coerce.number().int().positive().max(50).default(20).optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(SearchResultSchema),
						aiRanked: z.boolean(),
					}),
				},
			},
			description: "Search results",
		},
	},
});

export const searchApp = createApp().openapi(searchRoute, async (c) => {
	const params = c.req.valid("query");
	const result = await c.var.searchService.search(
		params,
		c.env.TALASH_AI as unknown as RerankAI | undefined,
	);
	return c.json(result, 200);
});

export const installSearchService: ServiceInstaller = (c) =>
	c.set("searchService", new SearchService());
