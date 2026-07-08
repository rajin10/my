import { createRoute, z } from "@hono/zod-openapi";
import { RewardsRepository } from "@repo/core/src/database/repositories/rewards.repository";
import { RewardsService } from "@repo/core/src/modules/rewards/rewards.service";
import { createApp } from "../../core/create-app";
import { ValidationError } from "../../core/errors";
import { authenticate } from "../../middleware/auth";
import type { ServiceInstaller } from "../../middleware/shared-deps";

const BalanceSchema = z
	.object({
		userId: z.string(),
		balance: z.number(),
	})
	.openapi("RewardBalance");

const TransactionSchema = z
	.object({
		id: z.string(),
		userId: z.string(),
		bookingId: z.string().nullable(),
		type: z.enum(["credit", "debit"]),
		points: z.number(),
		description: z.string(),
		createdAt: z.string(),
	})
	.openapi("RewardTransaction");

const RedeemBody = z
	.object({
		points: z.number().int().positive(),
		description: z.string().min(1).max(200).default("Points redeemed"),
	})
	.openapi("RedeemPointsBody");

const RedeemResult = z
	.object({
		newBalance: z.number(),
	})
	.openapi("RedeemPointsResult");

const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const PaginationMetaSchema = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	totalPages: z.number(),
	hasNextPage: z.boolean(),
	hasPrevPage: z.boolean(),
});

const balanceRoute = createRoute({
	method: "get",
	path: "/balance",
	tags: ["Rewards"],
	summary: "Get reward points balance",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: { "application/json": { schema: BalanceSchema } },
			description: "OK",
		},
	},
});

const historyRoute = createRoute({
	method: "get",
	path: "/history",
	tags: ["Rewards"],
	summary: "Get reward transaction history",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(TransactionSchema),
						query: PaginationMetaSchema,
					}),
				},
			},
			description: "OK",
		},
	},
});

const redeemRoute = createRoute({
	method: "post",
	path: "/redeem",
	tags: ["Rewards"],
	summary: "Redeem reward points",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: RedeemBody } },
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: RedeemResult } },
			description: "OK",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Insufficient points or invalid input",
		},
	},
});

export const rewardsApp = createApp();
rewardsApp.use("*", authenticate);
rewardsApp
	.openapi(balanceRoute, async (c) => {
		const result = await c.var.rewardsService.getBalance(c.var.user.id);
		return c.json(result, 200);
	})
	.openapi(historyRoute, async (c) => {
		const history = await c.var.rewardsService.getHistory(c.var.user.id);
		return c.json(
			{
				data: history,
				query: {
					page: 1,
					limit: history.length,
					total: history.length,
					totalPages: 1,
					hasNextPage: false,
					hasPrevPage: false,
				},
			},
			200,
		);
	})
	.openapi(redeemRoute, async (c) => {
		const { points, description } = c.req.valid("json");
		try {
			const result = await c.var.rewardsService.redeem(
				c.var.user.id,
				points,
				description,
			);
			return c.json(result, 200);
		} catch (err) {
			// Map only the known business-rule failures from the core service to a
			// 422. Anything else propagates to the generic error handler (500) — we
			// never echo a raw internal error message back to the client. Mirrors the
			// constraint-message mapping pattern in UsersService.update.
			const message = err instanceof Error ? err.message : "";
			if (/insufficient reward points/i.test(message))
				throw new ValidationError("Insufficient reward points");
			if (/points must be positive/i.test(message))
				throw new ValidationError("Points must be a positive number");
			throw err;
		}
	});

export const installRewardsService: ServiceInstaller = (c, { db }) =>
	c.set("rewardsService", new RewardsService(new RewardsRepository(db)));
