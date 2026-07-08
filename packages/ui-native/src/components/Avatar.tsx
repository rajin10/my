import { Colors } from "@repo/tokens";
import { Text, View, type ViewStyle } from "react-native";
import { cn } from "../cn";
import {
	type AvatarSize,
	avatarSizeKey,
	avatarVariants,
	initialsOf,
	resolveAvatarFontSize,
	resolveAvatarPx,
} from "./Avatar.styles";

export type AvatarProps = {
	name: string;
	/** Token size or explicit pixel value. */
	size?: AvatarSize | number;
	/** Background color — defaults to primary-100. */
	bg?: string;
	/** Initials text color — defaults to primary-700. */
	fg?: string;
	style?: ViewStyle;
	className?: string;
};

export function Avatar({
	name,
	size = "md",
	bg = Colors.primary100,
	fg = Colors.primary700,
	style,
	className,
}: AvatarProps) {
	const px = resolveAvatarPx(size);
	const fs = resolveAvatarFontSize(size);

	return (
		<View
			className={cn(avatarVariants({ size: avatarSizeKey(size) }), className)}
			style={[
				{ width: px, height: px, borderRadius: px / 2, backgroundColor: bg },
				style,
			]}
		>
			<Text style={{ color: fg, fontSize: fs, fontWeight: "700" }}>
				{initialsOf(name)}
			</Text>
		</View>
	);
}
