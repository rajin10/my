import type { AuthTokens } from "@repo/api-client";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { Colors } from "../tokens";
import { EmailPasswordAuth } from "./EmailPasswordAuth";

const REDIRECT_URI = "mobileapp://auth/callback";

export default function AuthScreenRedirect({
	onAuthed,
	onBack,
}: {
	onAuthed: (tokens: AuthTokens) => void;
	onBack?: () => void;
}) {
	const insets = useSafeAreaInsets();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleGooglePress() {
		setError("");
		setLoading(true);
		try {
			const { url } = await api.auth.getGoogleUrl(REDIRECT_URI, "mobile-app");
			const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
			if (result.type !== "success") return;
			const params = new URL(result.url).searchParams;
			const code = params.get("code");
			const state = params.get("state");
			if (!code || !state) {
				setError("Google sign-in did not return the expected parameters.");
				return;
			}
			const tokens = await api.auth.googleCallback({
				code,
				state,
				redirect_uri: REDIRECT_URI,
			});
			onAuthed(tokens);
		} catch (e) {
			setError((e as Error).message ?? "Google sign-in failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<View className="flex-1 bg-primary-900">
			{/* Decorative blobs */}
			<View
				className="absolute bg-[rgba(63,184,155,0.12)]"
				style={{
					top: -80,
					right: -80,
					width: 280,
					height: 280,
					borderRadius: 140,
				}}
			/>
			<View
				className="absolute bg-[rgba(201,160,99,0.1)]"
				style={{
					bottom: 120,
					left: -60,
					width: 220,
					height: 220,
					borderRadius: 110,
				}}
			/>

			<View className="flex-1 px-7 pb-2">
				<View
					className="flex-row items-center gap-2.5"
					style={{ marginTop: insets.top + 20, marginBottom: "auto" }}
				>
					{onBack && (
						<TouchableOpacity onPress={onBack} className="p-1">
							<Text style={{ fontSize: 16, color: Colors.primary300 }}>←</Text>
						</TouchableOpacity>
					)}
					<View className="w-8 h-8 items-center justify-center rounded-sm bg-primary-600">
						<Text className="text-lg text-white">✦</Text>
					</View>
					<Text className="text-2xl font-semibold tracking-tight text-white">
						Talash
					</Text>
				</View>

				<Text
					className="text-gold-300 font-bold uppercase"
					style={{ fontSize: 12, letterSpacing: 2, marginBottom: 14 }}
				>
					Your wellness, simplified
				</Text>
				<Text
					className="text-white"
					style={{
						fontSize: 36,
						fontWeight: "400",
						lineHeight: 42,
						letterSpacing: -0.5,
					}}
				>
					Book beautiful{"\n"}
					<Text style={{ fontStyle: "italic", color: Colors.primary300 }}>
						experiences.
					</Text>
				</Text>
				<Text
					className="text-primary-200"
					style={{ marginTop: 16, fontSize: 16, lineHeight: 26, maxWidth: 320 }}
				>
					Track bookings, earn rewards, and discover the best spas and salons
					near you.
				</Text>
			</View>

			<View
				style={{
					paddingHorizontal: 24,
					paddingBottom: insets.bottom + 20,
					paddingTop: 24,
				}}
			>
				{error ? (
					<Text className="text-[#f87171] text-xs mb-3 text-center">
						{error}
					</Text>
				) : null}

				<TouchableOpacity
					onPress={handleGooglePress}
					disabled={loading}
					className={cn(
						"w-full flex-row items-center justify-center rounded-md bg-white",
						loading && "opacity-70",
					)}
					style={{ paddingVertical: 16, gap: 10 }}
				>
					{loading ? (
						<ActivityIndicator color={Colors.primary900} />
					) : (
						<>
							<Text style={{ fontSize: 22 }}>G</Text>
							<Text
								className="text-primary-900 font-bold"
								style={{ fontSize: 16 }}
							>
								Continue with Google
							</Text>
						</>
					)}
				</TouchableOpacity>

				<EmailPasswordAuth source="mobile-app" onAuthed={onAuthed} />

				<Text
					className="mt-4 text-xs leading-5 text-center"
					style={{ color: Colors.primary300 }}
				>
					By continuing you agree to our Terms & Privacy Policy.
				</Text>
			</View>
		</View>
	);
}
