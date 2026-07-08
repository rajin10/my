import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "./Button";

export type DeleteAccountAuthMethods = {
	password: boolean;
	google: boolean;
};

export type DeleteAccountProof = { password: string } | { idToken: string };

export function DeleteAccountVerificationModal({
	visible,
	authMethods,
	password,
	onPasswordChange,
	googleIdToken,
	onGooglePress,
	onClose,
	onConfirmDelete,
	isPending = false,
	error = null,
}: {
	visible: boolean;
	authMethods: DeleteAccountAuthMethods;
	password: string;
	onPasswordChange: (value: string) => void;
	googleIdToken: string | null;
	onGooglePress?: () => void;
	onClose: () => void;
	onConfirmDelete: (proof: DeleteAccountProof) => void;
	isPending?: boolean;
	error?: string | null;
}) {
	const proof: DeleteAccountProof | null = googleIdToken
		? { idToken: googleIdToken }
		: password.trim()
			? { password: password.trim() }
			: null;

	const canDelete =
		Boolean(proof) &&
		!isPending &&
		(authMethods.password || authMethods.google);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<Pressable
				className="flex-1 bg-ink-900/40 justify-center px-6"
				onPress={onClose}
			>
				<Pressable
					className="bg-surface rounded-xl p-5 border border-line"
					onPress={(e) => e.stopPropagation()}
				>
					<Text className="font-serif text-xl text-ink-900 mb-1">
						Verify your identity
					</Text>
					<Text className="text-sm text-ink-500 mb-4">
						Confirm it is you before we delete your account.
					</Text>

					<Text className="text-xs font-medium text-ink-600 mb-1.5">
						Password
					</Text>
					<TextInput
						value={password}
						onChangeText={onPasswordChange}
						secureTextEntry
						autoCapitalize="none"
						autoComplete="password"
						editable={authMethods.password && !isPending && !googleIdToken}
						placeholder={
							authMethods.password
								? "Enter your password"
								: "Password not set on this account"
						}
						className="border border-line rounded-md px-3 py-2.5 text-sm text-ink-800 mb-3 bg-paper"
					/>
					{!authMethods.password && (
						<Text className="text-xs text-ink-500 mb-3">
							No password on this account. Use Google verification below.
						</Text>
					)}

					{onGooglePress ? (
						<Button
							variant="subtle"
							full
							icon="LogIn"
							disabled={
								!authMethods.google || isPending || Boolean(googleIdToken)
							}
							onPress={onGooglePress}
							style={{ marginBottom: 12 }}
						>
							Verify with Google
						</Button>
					) : null}
					{!authMethods.google && (
						<Text className="text-xs text-ink-500 mb-3">
							Google sign-in is not linked to this account.
						</Text>
					)}

					{googleIdToken ? (
						<Text className="text-xs text-primary-700 mb-3">
							Google verification complete.
						</Text>
					) : null}

					{error ? (
						<Text
							className="text-sm text-danger-fg mb-3"
							accessibilityRole="alert"
						>
							{error}
						</Text>
					) : null}

					<View className="flex-row gap-2 justify-end">
						<Button variant="ghost" onPress={onClose} disabled={isPending}>
							Cancel
						</Button>
						<Button
							variant="danger"
							disabled={!canDelete}
							loading={isPending}
							onPress={() => {
								if (proof) onConfirmDelete(proof);
							}}
						>
							Delete account
						</Button>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
