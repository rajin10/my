import { Text, TextInput, View, type ViewStyle } from "react-native";
import { Colors, Radius } from "../../tokens";

export type TextFieldProps = {
	label?: string;
	value: string;
	onChangeText: (v: string) => void;
	placeholder?: string;
	hint?: string;
	multiline?: boolean;
	rows?: number;
	keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
	autoFocus?: boolean;
	style?: ViewStyle;
};

export function TextField({
	label,
	value,
	onChangeText,
	placeholder,
	hint,
	multiline,
	rows,
	keyboardType = "default",
	autoFocus,
	style,
}: TextFieldProps) {
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
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={Colors.ink400}
				multiline={multiline}
				numberOfLines={multiline ? rows : 1}
				keyboardType={keyboardType}
				autoFocus={autoFocus}
				style={{
					width: "100%",
					paddingVertical: 12,
					paddingHorizontal: 14,
					borderRadius: Radius.md,
					borderWidth: 1,
					borderColor: Colors.lineStrong,
					fontSize: 16,
					color: Colors.ink900,
					backgroundColor: Colors.surface,
					textAlignVertical: multiline ? "top" : "center",
					minHeight: multiline && rows ? rows * 24 + 24 : undefined,
				}}
			/>
			{hint && (
				<Text className="text-ink-400" style={{ fontSize: 12.5, marginTop: 5 }}>
					{hint}
				</Text>
			)}
		</View>
	);
}
