import { router } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { Colors } from "../tokens";
import { NetworkError } from "./NetworkError";
import { Button } from "./ui";

type Props =
	| { kind: "loading" }
	| { kind: "error"; onRetry: () => void }
	| { kind: "missing" };

export function BusinessRouteShell(props: Props) {
	if (props.kind === "loading") {
		return (
			<View className="flex-1 items-center justify-center bg-paper">
				<ActivityIndicator size="large" color={Colors.primary600} />
			</View>
		);
	}
	if (props.kind === "error") {
		return (
			<NetworkError
				message="We couldn't load this business. Check your connection and try again."
				onRetry={props.onRetry}
			/>
		);
	}
	return (
		<View className="flex-1 items-center justify-center bg-paper px-8">
			<Text
				className="text-ink-900 text-center font-medium"
				style={{ fontSize: 20, marginBottom: 8 }}
			>
				Business unavailable
			</Text>
			<Text
				className="text-ink-500 text-center"
				style={{ fontSize: 14, lineHeight: 22, marginBottom: 20 }}
			>
				Open a business from search or your favourites to view details.
			</Text>
			<Button onPress={() => router.replace("/(tabs)")}>Discover businesses</Button>
		</View>
	);
}
