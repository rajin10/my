import { Colors } from "@repo/tokens";
import * as Icons from "lucide-react-native";
import { View } from "react-native";
import { cn } from "../cn";
import {
	filledCount,
	resolveStarPx,
	type StarSize,
	starSizeKey,
	starsVariants,
} from "./Stars.styles";

export type StarsProps = {
	value?: number;
	/** Token size or explicit pixel value. `sizePx` takes precedence. */
	size?: StarSize | number;
	sizePx?: number;
	className?: string;
};

export function Stars({
	value = 5,
	size = "sm",
	sizePx,
	className,
}: StarsProps) {
	const full = filledCount(value);
	const px = resolveStarPx(size, sizePx);
	return (
		<View className={cn(starsVariants({ size: starSizeKey(size) }), className)}>
			{[1, 2, 3, 4, 5].map((n) => (
				<Icons.Star
					key={n}
					size={px}
					color={n <= full ? Colors.gold500 : Colors.gold300}
					fill={n <= full ? Colors.gold500 : "transparent"}
					strokeWidth={1.5}
				/>
			))}
		</View>
	);
}
