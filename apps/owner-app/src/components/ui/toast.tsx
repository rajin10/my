import { Icon, type IconName } from "@repo/ui-native";
import { Text, View } from "react-native";
import { Colors, Shadow } from "../../tokens";

export type ToastData = {
	msg: string;
	icon?: string;
	tone?: "success" | "danger";
};

export type ToastProps = {
	toast: ToastData | null;
	/** Distance from screen bottom. Defaults to 90. */
	bottomOffset?: number;
};

export function Toast({ toast, bottomOffset = 90 }: ToastProps) {
	if (!toast) return null;
	const bg =
		toast.tone === "danger"
			? Colors.danger
			: toast.tone === "success"
				? Colors.primary700
				: Colors.primary900;
	const iconName = (toast.icon ?? "Check") as IconName;
	return (
		<View
			className="absolute left-4 right-4 flex-row items-center gap-2.5 p-3.5 rounded-md"
			style={[
				{ bottom: bottomOffset, backgroundColor: bg, zIndex: 999 },
				Shadow.lg,
			]}
		>
			<Icon name={iconName} sizePx={18} color="#fff" />
			<Text
				className="flex-1 text-white font-medium"
				style={{ fontSize: 14.5, lineHeight: 21 }}
			>
				{toast.msg}
			</Text>
		</View>
	);
}
