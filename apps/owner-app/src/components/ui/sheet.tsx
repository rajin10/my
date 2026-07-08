import { Icon } from "@repo/ui-native";
import type React from "react";
import {
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Colors, Shadow } from "../../tokens";

export type SheetProps = {
	visible: boolean;
	title: string;
	onClose: () => void;
	children: React.ReactNode;
	footer?: React.ReactNode;
};

export function Sheet({
	visible,
	title,
	onClose,
	children,
	footer,
}: SheetProps) {
	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onClose}
		>
			<View style={styles.overlay}>
				<TouchableOpacity
					style={StyleSheet.absoluteFill}
					onPress={onClose}
					activeOpacity={1}
				/>
				<View style={styles.content}>
					<View className="items-center pt-2.5 pb-1">
						<View className="w-10 h-1 rounded-full bg-line-strong" />
					</View>
					<View className="flex-row items-center justify-between px-4 pb-3">
						<Text className="text-ink-900 font-medium" style={{ fontSize: 22 }}>
							{title}
						</Text>
						<TouchableOpacity
							onPress={onClose}
							className="w-8 h-8 rounded-full items-center justify-center bg-surface"
							style={Shadow.xs}
						>
							<Icon name="X" sizePx={18} color={Colors.ink700} />
						</TouchableOpacity>
					</View>
					<ScrollView
						showsVerticalScrollIndicator={false}
						contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
					>
						{children}
					</ScrollView>
					{footer && (
						<View
							className="px-4 pt-3 border-t border-line bg-surface"
							style={{ paddingBottom: 30 }}
						>
							{footer}
						</View>
					)}
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: "rgba(8,54,44,0.45)",
	},
	content: {
		backgroundColor: Colors.surface,
		borderTopLeftRadius: 28,
		borderTopRightRadius: 28,
		maxHeight: "88%",
		shadowColor: "#08362C",
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.12,
		shadowRadius: 24,
		elevation: 12,
	},
});
