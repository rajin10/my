import { Icon, type IconName } from "@repo/ui-native";
import type React from "react";
import { Text, View } from "react-native";
import { Colors } from "../../tokens";

export type FieldLabelProps = {
	icon?: IconName;
	children: React.ReactNode;
};

export function FieldLabel({ icon, children }: FieldLabelProps) {
	return (
		<View className="flex-row items-center gap-1.5 mb-2.5">
			{icon && <Icon name={icon} sizePx={15} color={Colors.primary600} />}
			<Text className="text-ink-800 font-bold" style={{ fontSize: 13 }}>
				{children}
			</Text>
		</View>
	);
}
