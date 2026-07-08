// Talash design tokens — single source of truth (platform-agnostic).
//
// This file holds the JS representation for React Native inline styles.
// `theme.css` holds the matching CSS `@theme` representation for web + NativeWind
// class generation. `index.test.ts` enforces that the two never drift.
//
// Components should prefer the SEMANTIC roles (primary, on-primary, accent,
// surface, ink…) over the raw ramp (green-600). The raw ramp is retained so
// existing references keep working until they are migrated (issue #54).

export const Colors = {
	// ── Raw ramp — Primary (Emerald / Forest) ──
	primary950: "#052620",
	primary900: "#08362C",
	primary800: "#0B4A3C",
	primary700: "#0B5C4B",
	primary600: "#0E7C66",
	primary500: "#149A7E",
	primary400: "#3FB89B",
	primary300: "#79D0BA",
	primary200: "#B9E5D8",
	primary100: "#E8F2EE",
	primary50: "#F3F8F6",

	// ── Raw ramp — Neutrals ──
	ink900: "#14201C",
	ink800: "#22302B",
	ink700: "#33403B",
	ink600: "#4A564F",
	ink500: "#5E6B65",
	ink400: "#8A958F",
	ink300: "#B9C1BC",
	lineStrong: "#D5DBD7",
	line: "#E4E8E5",
	lineSoft: "#EEF1EF",
	surface: "#FFFFFF",
	paper: "#FBFAF6",
	cream: "#F5F1E8",
	creamDeep: "#ECE5D5",

	// ── Raw ramp — Accent (Brass / Gold) ──
	gold700: "#9C7634",
	gold600: "#B8893F",
	gold500: "#C9A063",
	gold300: "#E2C893",
	gold100: "#F6EEDC",

	// ── Semantic status (static — never tenant-themeable) ──
	success: "#149A7E",
	successBg: "#E3F3EE",
	successFg: "#0B5C4B",
	pending: "#C98A1E",
	pendingBg: "#FAF0DC",
	pendingFg: "#8A5E0F",
	danger: "#C0492F",
	dangerBg: "#FAE8E2",
	dangerFg: "#8A2F1B",
	info: "#2E7D8C",
	infoBg: "#E2F0F2",
	infoFg: "#1B5560",

	// ── Semantic roles — Brand (themeable) ──
	primary: "#0E7C66", // primary600
	primaryStrong: "#0B5C4B", // primary700
	primaryDeep: "#08362C", // primary900
	primarySoft: "#F3F8F6", // primary50
	primaryMuted: "#E8F2EE", // primary100
	onPrimary: "#FFFFFF",

	// ── Semantic roles — Accent (themeable) ──
	accent: "#C9A063", // gold500
	accentStrong: "#9C7634", // gold700
	accentSoft: "#F6EEDC", // gold100
	onAccent: "#14201C", // ink900

	// ── Semantic roles — Ink / text (static) ──
	ink: "#14201C", // ink900
	inkMuted: "#4A564F", // ink600
	inkSubtle: "#8A958F", // ink400
} as const;

export const Radius = {
	xs: 6,
	sm: 10,
	md: 14,
	lg: 20,
	xl: 28,
	pill: 999,
} as const;

export const Shadow = {
	xs: {
		shadowColor: "#08362C",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 2,
		elevation: 1,
	},
	sm: {
		shadowColor: "#08362C",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 2,
	},
	md: {
		shadowColor: "#08362C",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.08,
		shadowRadius: 24,
		elevation: 4,
	},
	lg: {
		shadowColor: "#08362C",
		shadowOffset: { width: 0, height: 18 },
		shadowOpacity: 0.12,
		shadowRadius: 48,
		elevation: 8,
	},
} as const;

// Business gradients (for placeholder photos)
export const Tones = {
	forest: ["#1f6b58", "#0b4a3c"] as [string, string],
	clay: ["#9c7448", "#5d4327"] as [string, string],
	sage: ["#6f8a73", "#3e5742"] as [string, string],
	stone: ["#8a8170", "#544d3e"] as [string, string],
	rose: ["#a86b63", "#6e3f3a"] as [string, string],
	deep: ["#2e7d8c", "#1b5560"] as [string, string],
} as const;

export type ToneKey = keyof typeof Tones;

// Dark mode overrides — only neutrals / surfaces change (brand + status hold).
export const DarkColors = {
	...Colors,
	ink900: "#ECF0EE",
	ink800: "#D4DCD8",
	ink700: "#B9C6C1",
	ink600: "#9AAAA4",
	ink500: "#7A8D87",
	ink400: "#55635E",
	ink300: "#3D4D47",
	lineStrong: "#2E3D38",
	line: "#243029",
	lineSoft: "#1C2622",
	surface: "#1A2320",
	paper: "#121917",
	cream: "#1E2822",
	creamDeep: "#182119",
	// keep semantic ink aliases in sync with the dark neutrals
	ink: "#ECF0EE",
	inkMuted: "#9AAAA4",
	inkSubtle: "#55635E",
} as const;

export type ColorToken = keyof typeof Colors;

// Per-tenant brand-tint derivation (#97) — shared by app render boundaries and the
// API WCAG gate so rendered colours == gated colours.
export { derivePrimaryTints, type PrimaryTints } from "./derive";
