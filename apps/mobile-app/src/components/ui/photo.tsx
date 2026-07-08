import { Icon } from "@repo/ui-native";
import { cva, type VariantProps } from "class-variance-authority";
import { Image } from "expo-image";
import type React from "react";
import { View, type ViewStyle } from "react-native";
import { cn } from "../../lib/cn";
import { Radius } from "../../tokens";

const photoVariants = cva("relative overflow-hidden", {
	variants: {
		rounded: {
			none: "",
			sm: "rounded-sm",
			md: "rounded-md",
			lg: "rounded-lg",
			xl: "rounded-xl",
			full: "rounded-full",
		},
	},
	defaultVariants: { rounded: "none" },
});

export type PhotoProps = VariantProps<typeof photoVariants> & {
	/** Business tone: [overlay colour, base colour]. */
	tone: [string, string];
	height: number;
	/** Explicit border radius in px — takes precedence over `rounded`. */
	radiusPx?: number;
	/** Real image URI; when absent renders the tone placeholder. */
	uri?: string | null;
	children?: React.ReactNode;
	style?: ViewStyle;
	className?: string;
};

export function Photo({
	tone,
	height,
	rounded = "none",
	radiusPx,
	uri,
	children,
	style,
	className,
}: PhotoProps) {
	const borderRadius =
		radiusPx != null
			? radiusPx
			: rounded === "none"
				? 0
				: (Radius[rounded as keyof typeof Radius] ?? 0);

	if (uri) {
		return (
			<View
				className={cn(photoVariants({ rounded }), className)}
				style={[{ height, borderRadius, backgroundColor: tone[1] }, style]}
			>
				<Image
					source={{ uri }}
					style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
					contentFit="cover"
					cachePolicy="memory-disk"
					transition={200}
				/>
				{children}
			</View>
		);
	}

	return (
		<View
			className={cn(
				"items-center justify-center",
				photoVariants({ rounded }),
				className,
			)}
			style={[{ height, borderRadius, backgroundColor: tone[1] }, style]}
		>
			<View
				className="absolute inset-0 opacity-60"
				style={{ backgroundColor: tone[0] }}
			/>
			<Icon
				name="Image"
				sizePx={Math.min(30, height / 4)}
				color="rgba(255,255,255,0.38)"
			/>
			{children}
		</View>
	);
}
