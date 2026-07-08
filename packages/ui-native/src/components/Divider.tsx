import { View, type ViewStyle } from "react-native";
import { cn } from "../cn";
import {
	type DividerDirection,
	type DividerStrength,
	dividerVariants,
} from "./Divider.styles";

export type DividerProps = {
	direction?: DividerDirection;
	strength?: DividerStrength;
	style?: ViewStyle;
	className?: string;
};

export function Divider({
	direction = "horizontal",
	strength = "normal",
	style,
	className,
}: DividerProps) {
	return (
		<View
			className={cn(dividerVariants({ direction, strength }), className)}
			style={style}
		/>
	);
}
