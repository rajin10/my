import { cva } from "class-variance-authority";

// Pure, RN-free style logic for `Avatar` — node-testable. Superset of both apps:
// owner-app's numeric `size` support over mobile-app's token-only sizes.

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export const AVATAR_SIZE_PX: Record<AvatarSize, number> = {
	xs: 28,
	sm: 36,
	md: 42,
	lg: 52,
	xl: 68,
	"2xl": 84,
};

export const AVATAR_FONT_SIZE: Record<AvatarSize, number> = {
	xs: 11,
	sm: 13,
	md: 16,
	lg: 20,
	xl: 26,
	"2xl": 32,
};

export const avatarVariants = cva("items-center justify-center shrink-0", {
	variants: {
		size: { xs: "", sm: "", md: "", lg: "", xl: "", "2xl": "" },
	},
	defaultVariants: { size: "md" },
});

/** Up to two uppercased initials; `?` when the name is empty. */
export function initialsOf(name: string): string {
	return (name || "?")
		.split(" ")
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function resolveAvatarPx(size: AvatarSize | number | undefined): number {
	if (typeof size === "number") return size;
	return AVATAR_SIZE_PX[size ?? "md"] ?? AVATAR_SIZE_PX.md;
}

/** Token sizes use the font scale; numeric sizes derive ~38% of their px. */
export function resolveAvatarFontSize(
	size: AvatarSize | number | undefined,
): number {
	if (typeof size === "number") return Math.round(size * 0.38);
	return AVATAR_FONT_SIZE[size ?? "md"] ?? AVATAR_FONT_SIZE.md;
}

export function avatarSizeKey(
	size: AvatarSize | number | undefined,
): AvatarSize {
	return typeof size === "string" ? size : "md";
}
