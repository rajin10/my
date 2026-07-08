import { cva, type VariantProps } from "class-variance-authority";

// Pure, RN-free style logic for `Divider` — node-testable. Identical across both
// apps (#96): a 1px rule in either orientation, with an optional opacity tweak.

export const dividerVariants = cva("", {
	variants: {
		direction: {
			horizontal: "h-px w-full bg-line",
			vertical: "w-px self-stretch bg-line",
		},
		strength: {
			soft: "opacity-60",
			normal: "",
			strong: "opacity-100",
		},
	},
	defaultVariants: { direction: "horizontal", strength: "normal" },
});

export type DividerVariantProps = VariantProps<typeof dividerVariants>;
export type DividerDirection = NonNullable<DividerVariantProps["direction"]>;
export type DividerStrength = NonNullable<DividerVariantProps["strength"]>;
