import { Icon } from "@repo/ui-native";
import { useState } from "react";
import {
	Modal,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	type ViewStyle,
} from "react-native";
import { Colors, Radius } from "../../tokens";

export type PickerFieldProps = {
	label?: string;
	value: string;
	options: string[];
	onChange: (v: string) => void;
	style?: ViewStyle;
};

export function PickerField({
	label,
	value,
	options,
	onChange,
	style,
}: PickerFieldProps) {
	const [open, setOpen] = useState(false);
	return (
		<View style={style}>
			{label && (
				<Text
					className="text-ink-700 font-semibold"
					style={{ fontSize: 13.5, marginBottom: 6 }}
				>
					{label}
				</Text>
			)}
			<TouchableOpacity
				onPress={() => setOpen(true)}
				className="flex-row items-center justify-between"
				style={{
					paddingVertical: 12,
					paddingHorizontal: 14,
					borderRadius: Radius.md,
					borderWidth: 1,
					borderColor: Colors.lineStrong,
					backgroundColor: Colors.surface,
				}}
			>
				<Text style={{ fontSize: 16, color: Colors.ink900 }}>{value}</Text>
				<Icon name="ChevronDown" sizePx={18} color={Colors.ink400} />
			</TouchableOpacity>

			<Modal
				visible={open}
				transparent
				animationType="fade"
				onRequestClose={() => setOpen(false)}
			>
				<TouchableOpacity
					style={styles.overlay}
					onPress={() => setOpen(false)}
					activeOpacity={1}
				>
					<View style={styles.sheet}>
						{options.map((opt, i) => (
							<TouchableOpacity
								key={opt}
								onPress={() => {
									onChange(opt);
									setOpen(false);
								}}
								className="flex-row items-center justify-between"
								style={[
									styles.option,
									i > 0 && {
										borderTopWidth: 1,
										borderTopColor: Colors.lineSoft,
									},
								]}
							>
								<Text
									style={{
										fontSize: 16,
										color: opt === value ? Colors.primary700 : Colors.ink900,
										fontWeight: opt === value ? "600" : "400",
									}}
								>
									{opt}
								</Text>
								{opt === value && (
									<Icon name="Check" sizePx={18} color={Colors.primary600} />
								)}
							</TouchableOpacity>
						))}
					</View>
				</TouchableOpacity>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(8,54,44,0.45)",
		justifyContent: "flex-end",
		paddingHorizontal: 16,
		paddingBottom: 40,
	},
	sheet: {
		backgroundColor: Colors.surface,
		borderRadius: Radius.xl,
		overflow: "hidden",
	},
	option: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 18,
		paddingVertical: 15,
	},
});
