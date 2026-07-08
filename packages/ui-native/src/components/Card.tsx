import { Radius, Shadow } from "@repo/tokens";
import type React from "react";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { cn } from "../cn";
import {
	type CardPadding,
	type CardRounded,
	type CardShadow,
	cardVariants,
	resolveCardPadding,
} from "./Card.styles";

const SHADOW_STYLE: Record<CardShadow, object> = {
	none: {},
	sm: Shadow.sm,
	md: Shadow.md,
};

export type CardProps = {
	children: React.ReactNode;
	rounded?: CardRounded;
	shadow?: CardShadow;
	/** Named padding size or raw pixel value. */
	pad?: CardPadding | number;
	onPress?: () => void;
	style?: ViewStyle;
	className?: string;
};

export function Card({
	children,
	rounded = "lg",
	shadow = "sm",
	pad = "md",
	onPress,
	style,
	className,
}: CardProps) {
	const padding = resolveCardPadding(pad);
	const combined = [
		SHADOW_STYLE[shadow],
		{ borderRadius: Radius[rounded], padding },
		style,
	];

	if (onPress) {
		return (
			<TouchableOpacity
				onPress={onPress}
				activeOpacity={0.85}
				className={cn(cardVariants({ rounded, shadow }), className)}
				style={combined}
			>
				{children}
			</TouchableOpacity>
		);
	}
	return (
		<View
			className={cn(cardVariants({ rounded, shadow }), className)}
			style={combined}
		>
			{children}
		</View>
	);
}
