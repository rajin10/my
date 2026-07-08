import { createRoute, z } from "@hono/zod-openapi";
import { DemoRequestsRepository } from "@repo/core/src/database/repositories/demo-requests.repository";
import { createApp } from "../../core/create-app";
import { rateLimit } from "../../middleware/rate-limit";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { DemoRequestsService } from "./demo-requests.service";

const CreateDemoRequestBody = z
	.object({
		name: z.string().min(1).max(100),
		email: z.string().email(),
		businessName: z.string().min(1).max(200),
		message: z.string().max(1000).optional(),
	})
	.openapi("CreateDemoRequestBody");

const DemoRequestSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		businessName: z.string(),
		message: z.string().nullable(),
		createdAt: z.string(),
	})
	.openapi("DemoRequest");

const createRoute_ = createRoute({
	method: "post",
	path: "/",
	tags: ["Demo"],
	summary: "Submit a demo request",
	request: {
		body: {
			content: { "application/json": { schema: CreateDemoRequestBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: DemoRequestSchema } },
			description: "Created",
		},
	},
});

export const demoRequestsApp = createApp();
demoRequestsApp.use("*", rateLimit({ limit: 5, windowSecs: 60 }));
demoRequestsApp.openapi(createRoute_, async (c) => {
	const body = c.req.valid("json");
	const req = await c.var.demoRequestsService.create(body);
	return c.json(req, 201);
});

export const installDemoRequestsService: ServiceInstaller = (c, { db }) =>
	c.set(
		"demoRequestsService",
		new DemoRequestsService(new DemoRequestsRepository(db)),
	);
