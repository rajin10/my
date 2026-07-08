import type React from "react";
import { Text, type TextStyle } from "react-native";
import { cn } from "../cn";
import {
	EYEBROW_BASE_STYLE,
	EYEBROW_CLASSNAME,
	EYEBROW_DEFAULT_COLOR,
} from "./Eyebrow.styles";

export type EyebrowProps = {
	children: React.ReactNode;
	color?: string;
	style?: TextStyle;
	className?: string;
};

export function Eyebrow({
	children,
	color = EYEBROW_DEFAULT_COLOR,
	style,
	className,
}: EyebrowProps) {
	return (
		<Text
			className={cn(EYEBROW_CLASSNAME, className)}
			style={[EYEBROW_BASE_STYLE, { color }, style]}
		>
			{children}
		</Text>
	);
}
