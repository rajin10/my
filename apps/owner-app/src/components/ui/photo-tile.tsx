import { Icon } from "@repo/ui-native";
import { cva, type VariantProps } from "class-variance-authority";
import { StyleSheet, View } from "react-native";
import { cn } from "../../lib/cn";

const photoTileVariants = cva("overflow-hidden items-center justify-center", {
	variants: {
		rounded: {
			none: "",
			sm: "rounded-sm",
			md: "rounded-md",
			lg: "rounded-lg",
			xl: "rounded-xl",
		},
	},
	defaultVariants: { rounded: "none" },
});

export type PhotoTileProps = VariantProps<typeof photoTileVariants> & {
	tone: [string, string];
	width: number;
	height: number;
	/** Explicit border radius in px — overrides `rounded`. */
	borderRadius?: number;
	className?: string;
};

export function PhotoTile({
	tone,
	width,
	height,
	rounded = "none",
	borderRadius,
	className,
}: PhotoTileProps) {
	return (
		<View
			className={cn(photoTileVariants({ rounded }), className)}
			style={{ width, height, borderRadius, backgroundColor: tone[1] }}
		>
			<View
				style={[
					StyleSheet.absoluteFill,
					{ backgroundColor: tone[0], opacity: 0.6 },
				]}
			/>
			<Icon
				name="Image"
				sizePx={Math.min(28, height / 4)}
				color="rgba(255,255,255,0.35)"
			/>
		</View>
	);
}
