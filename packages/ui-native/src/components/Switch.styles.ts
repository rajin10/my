import { cva } from "class-variance-authority";

// Pure, RN-free style logic for `Switch` — node-testable. Both apps were
// near-identical; this unifies the cva name (`switchVariants`) and keeps the
// shared track-dimension map.

export type SwitchSize = "sm" | "md" | "lg";

export type SwitchTrack = { w: number; h: number; knob: number };

export const SWITCH_TRACK: Record<SwitchSize, SwitchTrack> = {
	sm: { w: 38, h: 22, knob: 16 },
	md: { w: 46, h: 28, knob: 22 },
	lg: { w: 54, h: 34, knob: 28 },
};

export const switchVariants = cva("justify-center px-0.5 rounded-full", {
	variants: {
		size: { sm: "", md: "", lg: "" },
	},
	defaultVariants: { size: "md" },
});

export function resolveSwitchTrack(size: SwitchSize | undefined): SwitchTrack {
	return SWITCH_TRACK[size ?? "md"] ?? SWITCH_TRACK.md;
}
