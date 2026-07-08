import { createRoute, z } from "@hono/zod-openapi";
import { createApp } from "../../core/create-app";
import { ValidationError } from "../../core/errors";
import { authenticate } from "../../middleware/auth";
import { requireAuth } from "../../middleware/auth-guard";
import type { ServiceInstaller } from "../../middleware/shared-deps";
import { CouponsService } from "../coupons/coupons.service";
import { BookingsService } from "./bookings.service";

const BookingSchema = z
	.object({
		id: z.string(),
		userId: z.string(),
		serviceId: z.string(),
		branchId: z.string(),
		slot: z.string(),
		status: z.enum(["Pending", "Confirmed", "Cancelled", "Completed"]),
		price: z.number(),
		discount: z.number(),
		couponCode: z.string().nullable(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Booking");

const CreateBookingBody = z
	.object({
		serviceId: z.string(),
		branchId: z.string(),
		slot: z.string().openapi({
			example: "2026-06-01T11:00:00",
			description: "ISO local datetime",
		}),
		couponCode: z.string().optional(),
	})
	.openapi("CreateBookingBody");

const IdParam = z.object({ id: z.string() });
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

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Bookings"],
	summary: "List my bookings",
	security: [{ bearerAuth: [] }],
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(BookingSchema),
						query: PaginationMetaSchema,
					}),
				},
			},
			description: "OK",
		},
	},
});

const getRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: ["Bookings"],
	summary: "Get booking",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BookingSchema }) },
			},
			description: "OK",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const createRoute_ = createRoute({
	method: "post",
	path: "/",
	tags: ["Bookings"],
	summary: "Create booking",
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: { "application/json": { schema: CreateBookingBody } },
			required: true,
		},
	},
	responses: {
		201: {
			content: {
				"application/json": { schema: z.object({ data: BookingSchema }) },
			},
			description: "Created",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Slot unavailable or coupon invalid",
		},
	},
});

const confirmRoute = createRoute({
	method: "patch",
	path: "/:id/confirm",
	tags: ["Bookings"],
	summary: "Confirm booking (owner/manager/staff)",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BookingSchema }) },
			},
			description: "Confirmed",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not assigned to this branch",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Cannot confirm",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const completeRoute = createRoute({
	method: "patch",
	path: "/:id/complete",
	tags: ["Bookings"],
	summary: "Mark booking Completed — triggers rewards (owner/manager/staff)",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BookingSchema }) },
			},
			description: "Completed",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not assigned to this branch",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not in Confirmed state",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const listByBranchRoute = createRoute({
	method: "get",
	path: "/branch",
	tags: ["Bookings"],
	summary: "List bookings for a branch or business (owner/manager/staff)",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({
			branchId: z.string().optional(),
			businessId: z.string().optional(),
			status: z
				.enum(["Pending", "Confirmed", "Cancelled", "Completed"])
				.optional(),
			limit: z.coerce.number().int().positive().max(500).optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						data: z.array(BookingSchema),
						query: PaginationMetaSchema,
					}),
				},
			},
			description: "OK",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not assigned to this branch",
		},
		422: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "branchId or businessId required",
		},
	},
});

const CalendarBookingSchema = BookingSchema.extend({
	customerName: z.string(),
	serviceName: z.string(),
	serviceDuration: z.number(),
}).openapi("CalendarBooking");

const calendarRoute = createRoute({
	method: "get",
	path: "/calendar",
	tags: ["Bookings"],
	summary:
		"Calendar view — bookings in a date range with customer/service names",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({
			branchId: z.string(),
			start: z.string().openapi({
				example: "2026-06-01",
				description: "ISO date start (inclusive)",
			}),
			end: z.string().openapi({
				example: "2026-06-07",
				description: "ISO date end (inclusive)",
			}),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.array(CalendarBookingSchema) },
			},
			description: "OK",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not assigned to this branch",
		},
	},
});

const cancelRoute = createRoute({
	method: "patch",
	path: "/:id/cancel",
	tags: ["Bookings"],
	summary: "Cancel booking",
	security: [{ bearerAuth: [] }],
	request: { params: IdParam },
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BookingSchema }) },
			},
			description: "Cancelled",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Already cancelled or completed",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

// Customer routes — any authenticated user
const customerApp = createApp();
customerApp.use("*", authenticate);
customerApp
	.openapi(listRoute, async (c) => {
		const bookings = await c.var.bookingsService.listByUser(c.var.user.id);
		return c.json(
			{
				data: bookings,
				query: {
					page: 1,
					limit: bookings.length,
					total: bookings.length,
					totalPages: 1,
					hasNextPage: false,
					hasPrevPage: false,
				},
			},
			200,
		);
	})
	.openapi(createRoute_, async (c) => {
		const body = c.req.valid("json");
		const booking = await c.var.bookingsService.create(c.var.user.id, {
			...body,
			requestId: c.var.requestId ?? undefined,
		});
		return c.json({ data: booking }, 201);
	})
	.openapi(cancelRoute, async (c) => {
		const { id } = c.req.valid("param");
		const booking = await c.var.bookingsService.cancel(c.var.user.id, id);
		return c.json({ data: booking }, 200);
	});

const assignRoute = createRoute({
	method: "patch",
	path: "/:id/assign",
	tags: ["Bookings"],
	summary: "Assign staff to booking (owner/manager)",
	security: [{ bearerAuth: [] }],
	request: {
		params: IdParam,
		body: {
			content: {
				"application/json": {
					schema: z.object({ staffId: z.string().nullable() }),
				},
			},
			required: true,
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: z.object({ data: BookingSchema }) },
			},
			description: "Updated",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

const exportRoute = createRoute({
	method: "get",
	path: "/export",
	tags: ["Bookings"],
	summary: "Export bookings as CSV (owner/manager)",
	security: [{ bearerAuth: [] }],
	request: {
		query: z.object({
			businessId: z.string(),
			status: z
				.enum(["Pending", "Confirmed", "Cancelled", "Completed"])
				.optional(),
		}),
	},
	responses: {
		200: {
			content: { "text/csv": { schema: z.string() } },
			description: "CSV download",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

// Staff routes — owner, manager, or staff only; branch scope injected by requireAuth.
// Guards are path-scoped (not `use("*")`) so they never run for the customer
// `GET /:id` route in customerDetailApp (mounted last) — a wildcard guard here
// would 403 the customer. Every staff route must be enumerated, or it goes
// unguarded: /branch, /calendar, /:id/confirm, /:id/complete, /:id/assign.
const staffApp = createApp();
const staffGuard = [
	authenticate,
	requireAuth(["owner", "manager", "staff"], { branchScope: true }),
] as const;
staffApp.use("/branch", ...staffGuard);
staffApp.use("/calendar", ...staffGuard);
staffApp.use("/:id/confirm", ...staffGuard);
staffApp.use("/:id/complete", ...staffGuard);
staffApp.use("/:id/assign", ...staffGuard);
const exportApp = createApp();
// Path-scoped (not `use("*")`) so this owner/manager guard never runs for the
// customer `GET /:id` route in customerDetailApp (mounted last). A wildcard
// guard here would 403 the customer's booking-detail request.
exportApp.use(
	"/export",
	authenticate,
	requireAuth(["owner", "manager"], { branchScope: true }),
);
exportApp.openapi(exportRoute, async (c) => {
	const { businessId, status } = c.req.valid("query");
	const { csv, filename } = await c.var.bookingsService.exportCsv(
		c.var.user.id,
		businessId,
		status,
		c.var.scopedBranchIds,
	);
	return new Response(csv, {
		status: 200,
		headers: {
			"Content-Type": "text/csv",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
});

staffApp
	.openapi(listByBranchRoute, async (c) => {
		const { branchId, businessId, status, limit } = c.req.valid("query");

		if (!branchId && !businessId) {
			throw new ValidationError("branchId or businessId required");
		}

		if (businessId && !branchId) {
			const result = await c.var.bookingsService.listByBusiness(
				c.var.user.id,
				businessId,
				c.var.scopedBranchIds,
				{ status, limit },
			);
			return c.json(result, 200);
		}

		const bookings = await c.var.bookingsService.listByBranch(
			branchId!,
			c.var.scopedBranchIds,
			c.var.user.id,
		);
		const filtered = status
			? bookings.filter((b) => b.status === status)
			: bookings;
		const total = filtered.length;
		const limited = limit ? filtered.slice(0, limit) : filtered;
		const effectiveLimit = limit ?? total;
		return c.json(
			{
				data: limited,
				query: {
					page: 1,
					limit: effectiveLimit,
					total,
					totalPages:
						total === 0 ? 1 : Math.ceil(total / Math.max(1, effectiveLimit)),
					hasNextPage: limited.length < total,
					hasPrevPage: false,
				},
			},
			200,
		);
	})
	.openapi(calendarRoute, async (c) => {
		const { branchId, start, end } = c.req.valid("query");
		const bookings = await c.var.bookingsService.calendar(
			c.var.user.id,
			branchId,
			start,
			end,
			c.var.scopedBranchIds,
		);
		return c.json(bookings, 200);
	})
	.openapi(confirmRoute, async (c) => {
		const { id } = c.req.valid("param");
		const booking = await c.var.bookingsService.confirm(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return c.json({ data: booking }, 200);
	})
	.openapi(completeRoute, async (c) => {
		const { id } = c.req.valid("param");
		const booking = await c.var.bookingsService.complete(
			c.var.user.id,
			id,
			c.var.scopedBranchIds,
		);
		return c.json({ data: booking }, 200);
	})
	.openapi(assignRoute, async (c) => {
		const { id } = c.req.valid("param");
		const { staffId } = c.req.valid("json");
		const booking = await c.var.bookingsService.assignStaff(
			c.var.user.id,
			id,
			staffId,
			c.var.scopedBranchIds,
		);
		return c.json({ data: booking }, 200);
	});

// Customer-owned booking detail (GET /:id). Mounted LAST and in its own
// authenticate-only app: across `.route("/", ...)` merges (and within Hono's
// router) the first-registered match wins, so the parametric `/:id` must be
// registered AFTER the static `/branch`, `/calendar`, and `/export` routes —
// otherwise `/:id` shadows all of them.
const customerDetailApp = createApp();
customerDetailApp.use("*", authenticate);
customerDetailApp.openapi(getRoute, async (c) => {
	const { id } = c.req.valid("param");
	const booking = await c.var.bookingsService.get(c.var.user.id, id);
	return c.json({ data: booking }, 200);
});

export const bookingsApp = createApp()
	.route("/", customerApp)
	.route("/", exportApp)
	.route("/", staffApp)
	.route("/", customerDetailApp);

export const installBookingsService: ServiceInstaller = (
	c,
	{
		bookingsRepo,
		servicesRepo,
		branchesRepo,
		couponsRepo,
		queue,
		authz,
		teamRepo,
	},
) => {
	// Bookings needs coupon validation; construct a private CouponsService instance
	// (it is stateless) so this installer has no ordering dependency on coupons.
	const couponsService = new CouponsService(couponsRepo, authz);
	c.set(
		"bookingsService",
		new BookingsService(
			bookingsRepo,
			servicesRepo,
			branchesRepo,
			couponsService,
			queue,
			authz,
			teamRepo,
		),
	);
};
