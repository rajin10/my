import { Colors, Shadow } from "@repo/tokens";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { cn } from "../cn";
import {
	resolveSwitchTrack,
	type SwitchSize,
	switchVariants,
} from "./Switch.styles";

export type SwitchProps = {
	on: boolean;
	onToggle: () => void;
	size?: SwitchSize;
	/** Active track color — defaults to primary-600. */
	activeColor?: string;
	style?: ViewStyle;
	className?: string;
};

export function Switch({
	on,
	onToggle,
	size = "md",
	activeColor = Colors.primary600,
	style,
	className,
}: SwitchProps) {
	const dim = resolveSwitchTrack(size);
	return (
		<TouchableOpacity
			onPress={onToggle}
			activeOpacity={0.8}
			className={cn(switchVariants({ size }), className)}
			style={[
				{
					width: dim.w,
					height: dim.h,
					backgroundColor: on ? activeColor : Colors.lineStrong,
				},
				style,
			]}
		>
			<View
				className={cn("rounded-full bg-white", on ? "self-end" : "self-start")}
				style={[{ width: dim.knob, height: dim.knob }, Shadow.xs]}
			/>
		</TouchableOpacity>
	);
}

/** Alias used by older owner-app screens. */
export { Switch as ToggleSwitch };
