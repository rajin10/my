import { Colors } from "@repo/tokens";
import { cva, type VariantProps } from "class-variance-authority";

// Pure, RN-free style logic for `Button` — node-testable. The `.tsx` component
// owns rendering (TouchableOpacity, Icon, ActivityIndicator).
//
// Canonical superset of mobile-app + owner-app per issue #63:
//  - `danger` split into two variants (HITL): filled `danger` (high-emphasis,
//    from mobile-app) + outline `dangerOutline` (low-emphasis, from owner-app).
//  - `secondary` renamed to `subtle` (design-system contract).
//  - owner-app's per-size `BUTTON_ICON_SIZE` map.
//  - mobile-app's `md` padding/font (higher-traffic surface); owner's `sm`
//    padding (taller tap target).
//
// Tenant theming (#97 / #54): brand surfaces use the SEMANTIC themeable roles
// (`bg-primary`, `bg-primary-soft`, `bg-primary-deep`, `border-primary-muted`,
// `text-on-primary`, `text-primary-strong`) so they repaint per tenant inside a
// `ThemeProvider` subtree (the roles are derived from the palette seed, ADR-0002).
// Text colour is a className (cascades the var); the icon/spinner colour is a JS
// hex (lucide takes a `color` prop that can't read a themed var on RN) and so uses
// a static fallback — `subtle`'s icon is deliberately NEUTRAL ink, not brand, so a
// themed subtle button reads as text(brand) + icon(neutral), never a mismatched
// green icon on a brand-tinted background.

export const buttonVariants = cva(
	"flex-row items-center justify-center gap-2 rounded-md",
	{
		variants: {
			variant: {
				primary: "bg-primary",
				subtle: "bg-primary-soft border border-primary-muted",
				ghost: "bg-surface border border-line-strong",
				dark: "bg-primary-deep",
				danger: "bg-danger-bg",
				dangerOutline: "bg-surface border border-line-strong",
				quiet: "bg-transparent",
			},
			size: {
				sm: "py-[9px] px-[14px]",
				md: "py-[13px] px-[22px]",
				lg: "py-4 px-6",
			},
			full: { true: "self-stretch", false: "self-start" },
			disabled: { true: "opacity-70", false: "" },
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
			full: false,
			disabled: false,
		},
	},
);

export type ButtonVariant =
	| "primary"
	| "subtle"
	| "ghost"
	| "dark"
	| "danger"
	| "dangerOutline"
	| "quiet";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

// Text colour as a className so brand variants repaint under a tenant palette
// (the var cascades through NativeWind's VariableContextProvider, #97). Static
// roles (ink/danger) resolve to fixed values.
export const BUTTON_TEXT_CLASS: Record<ButtonVariant, string> = {
	primary: "text-on-primary",
	subtle: "text-primary-strong",
	ghost: "text-ink-800",
	dark: "text-on-primary",
	danger: "text-danger-fg",
	dangerOutline: "text-danger-fg",
	quiet: "text-ink-600",
};

// Icon + spinner colour as a JS hex (lucide/ActivityIndicator take a `color`
// prop, not a className, so these CANNOT read a themed var on RN — they are
// static). `subtle` is intentionally neutral ink (decoupled from its themed
// text) so a reskinned subtle button never shows a green icon on a brand tint.
export const BUTTON_ICON_COLOR: Record<ButtonVariant, string> = {
	primary: "#fff",
	subtle: Colors.ink600,
	ghost: Colors.ink800,
	dark: "#fff",
	danger: Colors.dangerFg,
	dangerOutline: Colors.dangerFg,
	quiet: Colors.ink600,
};

export const BUTTON_FONT_SIZE: Record<ButtonSize, number> = {
	sm: 14,
	md: 16,
	lg: 17,
};

export const BUTTON_ICON_SIZE: Record<ButtonSize, number> = {
	sm: 16,
	md: 18,
	lg: 20,
};

/** A loading or disabled button does not respond to presses. */
export function isButtonInteractive({
	disabled,
	loading,
}: {
	disabled?: boolean;
	loading?: boolean;
}): boolean {
	return !disabled && !loading;
}

// Press feedback for the themed-fill variants (#97). The old `pressedBackground`
// painted a static darker hex over the fill — which would flash the Talash green
// over a tenant-themed button. Opacity dimming applies to whatever colour the
// theme resolved, so it stays correct per tenant. Other variants keep their
// prior (no-dim) press behaviour.
export function buttonActiveOpacity(variant: ButtonVariant): number {
	return variant === "primary" || variant === "dark" ? 0.85 : 1;
}
