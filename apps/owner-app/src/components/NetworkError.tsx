import { Text, TouchableOpacity, View } from "react-native";

interface Props {
	onRetry?: () => void;
	message?: string;
}

export function NetworkError({
	onRetry,
	message = "Couldn't load data. Check your connection.",
}: Props) {
	return (
		<View className="flex-1 items-center justify-center p-8 bg-paper">
			<Text style={{ fontSize: 34, marginBottom: 14 }}>📡</Text>
			<Text
				className="text-ink-900 text-center font-bold"
				style={{ fontSize: 16, marginBottom: 8 }}
			>
				Connection problem
			</Text>
			<Text
				className="text-ink-500 text-center"
				style={{ fontSize: 14, lineHeight: 22, marginBottom: 24 }}
			>
				{message}
			</Text>
			{onRetry && (
				<TouchableOpacity
					onPress={onRetry}
					className="rounded-md bg-primary-600"
					style={{ paddingVertical: 12, paddingHorizontal: 28 }}
					accessibilityRole="button"
					accessibilityLabel="Retry"
				>
					<Text className="text-white font-bold" style={{ fontSize: 15 }}>
						Retry
					</Text>
				</TouchableOpacity>
			)}
		</View>
	);
}
