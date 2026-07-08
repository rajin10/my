import { createRoute, z } from "@hono/zod-openapi";
import { StaffAvailabilityRepository } from "@repo/core/src/database/repositories/staff-availability.repository";
import { createApp } from "../../core/create-app";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { StaffAvailabilityService } from "./staff-availability.service";

const AvailabilitySlot = z.object({
	dayOfWeek: z.number().int().min(0).max(6),
	isClosed: z.boolean(),
	startTime: z.string().nullable().optional(),
	endTime: z.string().nullable().optional(),
});

const AvailabilityRecord = z
	.object({
		id: z.string(),
		teamMemberId: z.string(),
		dayOfWeek: z.number(),
		isClosed: z.boolean(),
		startTime: z.string().nullable(),
		endTime: z.string().nullable(),
		createdAt: z.string(),
	})
	.openapi("StaffAvailability");

const IdParam = z.object({ id: z.string() });
const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

const getRoute = createRoute({
	method: "get",
	path: "/:id/availability",
	tags: ["Team"],
	summary: "Get staff member availability",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: { "application/json": { schema: z.array(AvailabilityRecord) } },
			description: "OK",
		},
	},
});

const upsertRoute = createRoute({
	method: "put",
	path: "/:id/availability",
	tags: ["Team"],
	summary: "Set staff member availability",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: {
				"application/json": {
					schema: z.object({ availability: z.array(AvailabilitySlot) }),
				},
			},
			required: true,
		},
	},
	responses: {
		200: {
			content: { "application/json": { schema: z.array(AvailabilityRecord) } },
			description: "Updated",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

export const staffAvailabilityApp = createApp();
staffAvailabilityApp.use(
	"*",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);

staffAvailabilityApp
	.openapi(getRoute, async (c) => {
		const { id } = c.req.valid("param");
		const slots = await c.var.staffAvailabilityService.get(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return c.json(slots, 200);
	})
	.openapi(upsertRoute, async (c) => {
		const { id } = c.req.valid("param");
		const { availability } = c.req.valid("json");
		const updated = await c.var.staffAvailabilityService.upsert(
			c.var.user.id,
			id,
			availability,
			c.var.scopedBranchIds,
		);
		return c.json(updated, 200);
	});

export const installStaffAvailabilityService: ServiceInstaller = (
	c,
	{ db, authz },
) =>
	c.set(
		"staffAvailabilityService",
		new StaffAvailabilityService(new StaffAvailabilityRepository(db), authz),
	);
