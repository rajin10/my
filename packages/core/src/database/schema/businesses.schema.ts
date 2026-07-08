import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { usersSchema } from "./users.schema";

export const BusinessStatus = {
	DRAFT: "Draft",
	ACTIVE: "Active",
	SUSPENDED: "Suspended",
} as const;
export type BusinessStatusType =
	(typeof BusinessStatus)[keyof typeof BusinessStatus];

export const BusinessVertical = {
	BOOKING: "booking",
	COMMERCE: "commerce",
} as const;
export type BusinessVerticalType =
	(typeof BusinessVertical)[keyof typeof BusinessVertical];

/**
 * Full custom brand palette a business may supply to reskin its single-tenant
 * surfaces (owner app end-to-end; customer venue-detail + booking flow). The four
 * owner-chosen seed roles per ADR-0003 — these are exactly the themeable custom
 * properties the render path consumes (`primary`, `accent`, `surface`, and the
 * on-surface `foreground`/text role). Status colors and neutrals stay static
 * (ADR-0002). Each value is a hex string; the whole structure is nullable and a
 * `null` palette means the business renders with Talash defaults.
 *
 * Saved palettes are WCAG-AA-validated at write time (ADR-0003, issue #59), so the
 * customer render path never receives an unreadable combination.
 */
export type BrandPalette = {
	primary: string;
	accent: string;
	foreground: string;
	surface: string;
};

export const businessesSchema = sqliteTable(
	"businesses",
	{
		...primaryID(),
		name: text().notNull(),
		category: text().notNull(),
		city: text().notNull(),
		vertical: text({ enum: ["booking", "commerce"] })
			.notNull()
			.default("booking"),
		status: text({ enum: ["Draft", "Active", "Suspended"] })
			.notNull()
			.default("Draft"),
		description: text(),
		phone: text(),
		email: text(),
		website: text(),
		brandPalette: text("brand_palette", { mode: "json" }).$type<BrandPalette>(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => usersSchema.id, { onDelete: "cascade" }),
		...timestamps(),
	},
	(table) => [
		index("businesses_owner_id_idx").on(table.ownerId),
		index("businesses_status_idx").on(table.status),
		index("businesses_city_idx").on(table.city),
		index("businesses_vertical_idx").on(table.vertical),
	],
);

export const businessPhotosSchema = sqliteTable(
	"business_photos",
	{
		...primaryID(),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id, { onDelete: "cascade" }),
		url: text().notNull(),
		displayOrder: integer("display_order").notNull().default(0),
		...timestamps(),
	},
	(table) => [
		index("business_photos_business_id_idx").on(table.businessId),
	],
);

export type BusinessSelect = typeof businessesSchema.$inferSelect;
export type BusinessInsert = Omit<
	typeof businessesSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type BusinessPhotoSelect = typeof businessPhotosSchema.$inferSelect;
