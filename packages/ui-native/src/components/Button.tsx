import type React from "react";
import {
	ActivityIndicator,
	Text,
	TouchableOpacity,
	type ViewStyle,
} from "react-native";
import { cn } from "../cn";
import {
	BUTTON_FONT_SIZE,
	BUTTON_ICON_COLOR,
	BUTTON_ICON_SIZE,
	BUTTON_TEXT_CLASS,
	type ButtonSize,
	type ButtonVariant,
	buttonActiveOpacity,
	buttonVariants,
	isButtonInteractive,
} from "./Button.styles";
import { Icon, type IconName } from "./Icon";

export type ButtonProps = {
	children: React.ReactNode;
	variant?: ButtonVariant;
	size?: ButtonSize;
	full?: boolean;
	disabled?: boolean;
	/** Shows a spinner in place of the leading icon and blocks presses (#63). */
	loading?: boolean;
	icon?: IconName;
	iconRight?: IconName;
	onPress?: () => void;
	style?: ViewStyle;
	className?: string;
};

export function Button({
	children,
	variant = "primary",
	size = "md",
	full = false,
	disabled = false,
	loading = false,
	icon,
	iconRight,
	onPress,
	style,
	className,
}: ButtonProps) {
	// Icon/spinner colour is a static hex (lucide can't read a themed var on RN);
	// text colour is a className so brand variants repaint per tenant (#97).
	const iconColor = BUTTON_ICON_COLOR[variant];
	const textClass = BUTTON_TEXT_CLASS[variant];
	const fs = BUTTON_FONT_SIZE[size];
	const is = BUTTON_ICON_SIZE[size];
	const interactive = isButtonInteractive({ disabled, loading });

	return (
		<TouchableOpacity
			onPress={interactive ? onPress : undefined}
			activeOpacity={buttonActiveOpacity(variant)}
			className={cn(
				buttonVariants({ variant, size, full, disabled: !interactive }),
				className,
			)}
			style={style}
		>
			{loading ? (
				<ActivityIndicator size="small" color={iconColor} />
			) : (
				icon && <Icon name={icon} sizePx={is} color={iconColor} />
			)}
			<Text className={textClass} style={{ fontSize: fs, fontWeight: "600" }}>
				{children}
			</Text>
			{iconRight && <Icon name={iconRight} sizePx={is} color={iconColor} />}
		</TouchableOpacity>
	);
}
