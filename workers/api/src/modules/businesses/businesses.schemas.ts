import { z } from "@hono/zod-openapi";

export const BusinessStatusEnum = z.enum(["Draft", "Active", "Suspended"]);

export const BusinessVerticalEnum = z.enum(["booking", "commerce"]);

const HexColor = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color, e.g. #1A2B3C");

// Full custom white-label palette (ADR-0003): the four owner-chosen seed roles.
// WCAG-AA contrast across the role pairs is enforced separately at save (#59);
// this schema only guarantees the values are well-formed hex colors.
export const BrandPaletteSchema = z
	.object({
		primary: HexColor,
		accent: HexColor,
		foreground: HexColor,
		surface: HexColor,
	})
	.openapi("BrandPalette");

export const BusinessSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		category: z.string(),
		city: z.string(),
		vertical: BusinessVerticalEnum,
		status: BusinessStatusEnum,
		description: z.string().nullable(),
		brandPalette: BrandPaletteSchema.nullable(),
		ownerId: z.string(),
		createdAt: z.string(),
		updatedAt: z.string().nullable(),
	})
	.openapi("Business");

export const CreateBusinessBodySchema = z
	.object({
		name: z.string().min(1),
		category: z.string().min(1),
		city: z.string().min(1),
		// `vertical` is required — no silent default. It is immutable after creation.
		vertical: BusinessVerticalEnum,
		description: z.string().optional(),
		status: BusinessStatusEnum.default("Draft").optional(),
		// Nullable so an owner can clear a palette (revert to Talash defaults) via update.
		brandPalette: BrandPaletteSchema.nullable().optional(),
	})
	.openapi("CreateBusinessBody");

// `vertical` is immutable, so the update body is built from a vertical-free base
// rather than `CreateBusinessBodySchema.partial()` (which would expose it).
export const UpdateBusinessBodySchema = CreateBusinessBodySchema.omit({
	vertical: true,
})
	.partial()
	.refine((v) => Object.keys(v).length > 0, {
		message: "At least one field required",
	})
	.openapi("UpdateBusinessBody");

export const BusinessIdParamSchema = z.object({ id: z.string() });

export const PaginatedBusinessesSchema = z
	.object({
		data: z.array(BusinessSchema),
		query: z.object({
			page: z.number(),
			limit: z.number(),
			total: z.number(),
			totalPages: z.number(),
			hasNextPage: z.boolean(),
			hasPrevPage: z.boolean(),
		}),
	})
	.openapi("PaginatedBusinesses");

export const ErrorSchema = z
	.object({ ok: z.literal(false), code: z.string(), message: z.string() })
	.openapi("Error");

export const MessageSchema = z
	.object({ message: z.string() })
	.openapi("Message");
