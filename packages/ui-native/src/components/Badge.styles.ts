import { Colors } from "@repo/tokens";
import { cva } from "class-variance-authority";

// Pure, RN-free style logic for `Badge` + `StatusPill` — node-testable.
// Superset of both apps:
//  - `neutral` variant renamed to `default` (design-system contract, #63).
//  - absorbs mobile-app's `info` auto-icon.
//  - `StatusPill` covers owner-app's commerce statuses (Sent / OutForDelivery /
//    Delivered) and the "Out for delivery" humanized label.
//
// Tenant theming (#97 / #54): the `brand` badge uses the SEMANTIC themeable roles
// (`bg-primary-soft` fill + `text-primary-strong` label, derived from the palette
// seed) so it repaints per tenant inside a `ThemeProvider` subtree. Status roles
// (`bg-*-bg`, `*-fg`) and `default` stay static — status colour carries meaning.
// Text colour is a className (cascades the var); the icon colour is a JS hex
// (lucide `color` prop can't read a themed var on RN) — `brand` carries no icon.

export type BadgeVariant =
	| "success"
	| "danger"
	| "pending"
	| "info"
	| "default"
	| "brand";

export type BadgeSize = "sm" | "md";

export const badgeVariants = cva(
	"flex-row items-center gap-1 rounded-full self-start",
	{
		variants: {
			variant: {
				success: "bg-success-bg",
				danger: "bg-danger-bg",
				pending: "bg-pending-bg",
				info: "bg-info-bg",
				default: "bg-line-soft",
				brand: "bg-primary-soft",
			},
			size: { sm: "", md: "" },
		},
		defaultVariants: { variant: "default", size: "md" },
	},
);

// Label colour as a className so the `brand` badge repaints under a tenant palette
// (the var cascades through NativeWind's VariableContextProvider, #97). Status +
// neutral roles resolve to fixed values.
export const BADGE_TEXT_CLASS: Record<BadgeVariant, string> = {
	success: "text-success-fg",
	danger: "text-danger-fg",
	pending: "text-pending-fg",
	info: "text-info-fg",
	default: "text-ink-500",
	brand: "text-primary-strong",
};

// Icon colour as a JS hex (lucide takes a `color` prop, not a className, so it
// cannot read a themed var on RN). Status icons keep their semantic colour;
// `brand` carries no icon today, so it falls back to neutral ink.
export const BADGE_ICON_COLOR: Record<BadgeVariant, string> = {
	success: Colors.successFg,
	danger: Colors.dangerFg,
	pending: Colors.pendingFg,
	info: Colors.infoFg,
	default: Colors.ink500,
	brand: Colors.ink600,
};

// Icon names are valid lucide `IconName`s; typed loosely here to keep this file
// RN/lucide-free. The `.tsx` casts to `IconName` at the call site.
export const BADGE_ICONS: Partial<Record<BadgeVariant, string>> = {
	success: "CheckCircle",
	danger: "XCircle",
	pending: "Clock",
	info: "Info",
};

export type BookingStatus =
	| "Pending"
	| "Confirmed"
	| "Cancelled"
	| "Completed"
	| "Active"
	| "Draft"
	| "Published"
	| "Expired"
	| "Suspended"
	| "Sent"
	| "OutForDelivery"
	| "Delivered";

export const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
	Pending: "pending",
	Confirmed: "success",
	Cancelled: "danger",
	Completed: "success",
	Active: "success",
	Draft: "default",
	Published: "success",
	Expired: "default",
	Suspended: "danger",
	Sent: "success",
	OutForDelivery: "info",
	Delivered: "success",
};

const STATUS_LABEL: Partial<Record<BookingStatus, string>> = {
	OutForDelivery: "Out for delivery",
};

/** Humanized pill label — falls back to the status string itself. */
export function statusLabel(status: BookingStatus): string {
	return STATUS_LABEL[status] ?? status;
}
