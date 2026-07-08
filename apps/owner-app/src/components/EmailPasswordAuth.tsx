import { type AuthTokens, authFormErrorMessage } from "@repo/api-client";
import { useState } from "react";
import {
	ActivityIndicator,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { Colors } from "../tokens";

type Mode = "login" | "register" | "forgot";

export function EmailPasswordAuth({
	source,
	onAuthed,
}: {
	source: "mobile-app" | "business-app";
	onAuthed: (tokens: AuthTokens) => void;
}) {
	const [mode, setMode] = useState<Mode>("login");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);

	async function handleSubmit() {
		setError("");
		if (mode !== "forgot" && password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setLoading(true);
		try {
			if (mode === "login") {
				const tokens = await api.auth.login({ email, password, source });
				onAuthed(tokens);
			} else if (mode === "register") {
				const tokens = await api.auth.register({
					name,
					email,
					password,
					source,
				});
				onAuthed(tokens);
			} else {
				await api.auth.forgotPassword({
					email,
					reset_uri: "ownerapp://auth/reset-password",
					source,
				});
				setSent(true);
			}
		} catch (e) {
			setError(authFormErrorMessage(e));
		} finally {
			setLoading(false);
		}
	}

	const inputStyle = {
		backgroundColor: "rgba(255,255,255,0.95)",
		borderRadius: 8,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 15,
		color: Colors.primary900,
		marginBottom: 10,
	};

	return (
		<View className="mt-4">
			<View className="flex-row items-center gap-3 mb-4">
				<View className="flex-1 h-px bg-primary-600/40" />
				<Text className="text-xs text-primary-300">or</Text>
				<View className="flex-1 h-px bg-primary-600/40" />
			</View>

			{mode === "register" && (
				<TextInput
					placeholder="Name"
					autoComplete="name"
					value={name}
					onChangeText={setName}
					style={inputStyle}
					placeholderTextColor={Colors.primary400}
				/>
			)}

			<TextInput
				placeholder="Email"
				autoComplete="email"
				keyboardType="email-address"
				autoCapitalize="none"
				value={email}
				onChangeText={setEmail}
				style={inputStyle}
				placeholderTextColor={Colors.primary400}
			/>

			{mode !== "forgot" && (
				<TextInput
					placeholder="Password"
					secureTextEntry
					autoComplete={
						mode === "register" ? "new-password" : "current-password"
					}
					value={password}
					onChangeText={setPassword}
					style={inputStyle}
					placeholderTextColor={Colors.primary400}
				/>
			)}

			{sent && mode === "forgot" ? (
				<Text className="text-primary-200 text-xs text-center mb-3">
					If an account exists, a reset link has been sent.
				</Text>
			) : (
				<TouchableOpacity
					onPress={handleSubmit}
					disabled={loading}
					className={cn(
						"w-full items-center rounded-md border border-primary-400/50",
						loading && "opacity-70",
					)}
					style={{ paddingVertical: 14 }}
				>
					{loading ? (
						<ActivityIndicator color={Colors.primary200} />
					) : (
						<Text className="text-white font-semibold text-base">
							{mode === "login"
								? "Sign in with email"
								: mode === "register"
									? "Create account"
									: "Send reset link"}
						</Text>
					)}
				</TouchableOpacity>
			)}

			{error ? (
				<Text className="text-[#f87171] text-xs mt-2 text-center">{error}</Text>
			) : null}

			<View className="flex-row justify-between mt-3">
				{mode === "login" ? (
					<>
						<TouchableOpacity onPress={() => setMode("forgot")}>
							<Text className="text-primary-300 text-xs">Forgot password?</Text>
						</TouchableOpacity>
						<TouchableOpacity onPress={() => setMode("register")}>
							<Text className="text-primary-300 text-xs">Create account</Text>
						</TouchableOpacity>
					</>
				) : (
					<TouchableOpacity
						onPress={() => {
							setMode("login");
							setSent(false);
							setError("");
						}}
					>
						<Text className="text-primary-300 text-xs">Back to sign in</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
}
