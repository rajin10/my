import { Colors } from "@repo/tokens";
import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import type { ComponentType } from "react";
import { View, type ViewStyle } from "react-native";
import { cn } from "../cn";
import {
	type IconSize,
	iconSizeVariant,
	iconVariants,
	resolveIconPx,
} from "./Icon.styles";

export type IconName = keyof typeof Icons;

export type IconProps = {
	name: IconName;
	/** Token size or explicit pixel value. `sizePx` takes precedence over both. */
	size?: IconSize | number;
	sizePx?: number;
	color?: string;
	strokeWidth?: number;
	style?: ViewStyle;
	className?: string;
};

export function Icon({
	name,
	size = "md",
	sizePx,
	color = Colors.ink700,
	strokeWidth = 1.75,
	style,
	className,
}: IconProps) {
	const Comp = (Icons as unknown as Record<string, ComponentType<LucideProps>>)[
		name
	];
	if (!Comp) return null;
	const px = resolveIconPx(size, sizePx);
	return (
		<View
			className={cn(iconVariants({ size: iconSizeVariant(size) }), className)}
			style={[{ width: px, height: px }, style]}
		>
			<Comp size={px} color={color} strokeWidth={strokeWidth} />
		</View>
	);
}
