import { authFormErrorMessage } from "@repo/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { Colors } from "../../tokens";

export default function ResetPasswordScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { token } = useLocalSearchParams<{ token?: string }>();
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);

	async function handleSubmit() {
		if (!token || typeof token !== "string") {
			setError("Reset link is invalid or expired.");
			return;
		}
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setLoading(true);
		setError("");
		try {
			await api.auth.resetPassword({ token, password });
			setDone(true);
			setTimeout(() => router.replace("/(tabs)/account"), 2000);
		} catch (e) {
			setError(authFormErrorMessage(e));
			setLoading(false);
		}
	}

	return (
		<View
			className="flex-1 bg-primary-900 px-6"
			style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
		>
			<Text className="text-white text-2xl font-semibold mb-2">
				Set new password
			</Text>
			<Text className="text-primary-200 text-sm mb-6">
				Choose a new password for your account.
			</Text>

			{done ? (
				<Text className="text-primary-200 text-sm">
					Password updated. Redirecting…
				</Text>
			) : (
				<>
					<TextInput
						placeholder="New password (min 8 characters)"
						secureTextEntry
						autoComplete="new-password"
						value={password}
						onChangeText={setPassword}
						style={{
							backgroundColor: "rgba(255,255,255,0.95)",
							borderRadius: 8,
							paddingHorizontal: 14,
							paddingVertical: 12,
							fontSize: 15,
							color: Colors.primary900,
							marginBottom: 12,
						}}
						placeholderTextColor={Colors.primary400}
					/>
					<TouchableOpacity
						onPress={handleSubmit}
						disabled={loading}
						className="items-center rounded-md bg-white py-3.5"
						style={{ opacity: loading ? 0.7 : 1 }}
					>
						{loading ? (
							<ActivityIndicator color={Colors.primary900} />
						) : (
							<Text className="text-primary-900 font-semibold">
								Update password
							</Text>
						)}
					</TouchableOpacity>
					{error ? (
						<Text className="text-[#f87171] text-xs mt-3 text-center">
							{error}
						</Text>
					) : null}
				</>
			)}
		</View>
	);
}
