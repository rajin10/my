import {
	GoogleSignin,
	isSuccessResponse,
	statusCodes,
} from "@react-native-google-signin/google-signin";
import type { AuthTokens } from "@repo/api-client";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { Colors } from "../tokens";
import { Icon } from "./ui";

const WEB_CLIENT_ID =
	(Constants.expoConfig?.extra?.googleWebClientId as string | undefined) ?? "";

export default function AuthScreenNative({
	onAuthed,
}: {
	onAuthed: (tokens: AuthTokens) => void;
}) {
	const insets = useSafeAreaInsets();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
	}, []);

	async function handleGooglePress() {
		setError("");
		setLoading(true);
		try {
			await GoogleSignin.hasPlayServices({
				showPlayServicesUpdateDialog: true,
			});
			const response = await GoogleSignin.signIn();
			if (!isSuccessResponse(response)) return; // user cancelled

			// idToken can be null if webClientId is not set — fall back to getTokens()
			const idToken =
				response.data.idToken ?? (await GoogleSignin.getTokens()).idToken;
			const tokens = await api.auth.googleSignIn({
				idToken,
				source: "business-app",
			});
			onAuthed(tokens);
		} catch (e: unknown) {
			const err = e as { code?: string; message?: string };
			if (err.code === statusCodes.SIGN_IN_CANCELLED) return;
			setError(err.message ?? "Google sign-in failed");
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

			<View className="flex-1 justify-end px-7 pb-2">
				<View
					className="flex-row items-center"
					style={{ gap: 10, marginBottom: "auto", marginTop: insets.top + 20 }}
				>
					<View className="w-8 h-8 rounded-sm bg-primary-600 items-center justify-center">
						<Icon name="Sparkles" size={18} color="#fff" />
					</View>
					<Text
						className="text-white font-semibold"
						style={{ fontSize: 24, letterSpacing: -0.4 }}
					>
						Talash
					</Text>
					<View
						className="border rounded-full"
						style={{
							borderColor: "rgba(201,160,99,0.4)",
							paddingHorizontal: 9,
							paddingVertical: 3,
						}}
					>
						<Text
							className="text-gold-300 font-bold uppercase"
							style={{ fontSize: 11.5, letterSpacing: 1.2 }}
						>
							Business
						</Text>
					</View>
				</View>

				<Text
					className="text-gold-300 font-bold uppercase"
					style={{ fontSize: 12, letterSpacing: 2, marginBottom: 14 }}
				>
					Run your business, anywhere
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
					Your bookings,{"\n"}
					<Text style={{ fontStyle: "italic", color: Colors.primary300 }}>
						in your pocket.
					</Text>
				</Text>
				<Text
					className="text-primary-200"
					style={{ marginTop: 16, fontSize: 16, lineHeight: 26, maxWidth: 320 }}
				>
					Approve bookings, manage your menu and reply to reviews — all from
					your phone.
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
					<Text
						className="text-[#f87171] text-center"
						style={{ fontSize: 13, marginBottom: 12 }}
					>
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

				<EmailPasswordAuth source="business-app" onAuthed={onAuthed} />

				<Text
					className="text-center"
					style={{
						marginTop: 16,
						fontSize: 12.5,
						lineHeight: 20,
						color: Colors.primary300,
					}}
				>
					By continuing you agree to our Terms & Privacy Policy.
				</Text>
			</View>
		</View>
	);
}
