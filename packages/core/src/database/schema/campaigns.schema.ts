import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { primaryID, timestamps } from "../helpers";
import { businessesSchema } from "./businesses.schema";

export const CampaignStatus = {
	DRAFT: "Draft",
	SENT: "Sent",
} as const;

export const CampaignSegment = {
	ALL: "All",
	VIP: "VIP",
	REGULAR: "Regular",
	NEW: "New",
	AT_RISK: "AtRisk",
} as const;

export const campaignsSchema = sqliteTable(
	"campaigns",
	{
		...primaryID(),
		businessId: text("business_id")
			.notNull()
			.references(() => businessesSchema.id, { onDelete: "cascade" }),
		name: text().notNull(),
		segment: text({ enum: ["All", "VIP", "Regular", "New", "AtRisk"] })
			.notNull()
			.default("All"),
		channels: text().notNull().default("[]"), // JSON array of "Email"|"SMS"|"Push"
		message: text().notNull().default(""),
		status: text({ enum: ["Draft", "Sent"] })
			.notNull()
			.default("Draft"),
		sentAt: text("sent_at"),
		recipientCount: integer("recipient_count").default(0),
		...timestamps(),
	},
	(table) => [index("campaigns_business_id_idx").on(table.businessId)],
);

export type CampaignSelect = typeof campaignsSchema.$inferSelect;
export type CampaignInsert = Omit<
	typeof campaignsSchema.$inferInsert,
	"id" | "createdAt" | "updatedAt" | "deletedAt"
>;
