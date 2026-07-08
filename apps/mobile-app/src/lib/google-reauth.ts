import {
	GoogleSignin,
	isSuccessResponse,
	statusCodes,
} from "@react-native-google-signin/google-signin";

/** Fresh Google ID token for destructive-action verification (not Talash sign-in). */
export async function fetchGoogleIdTokenForReauth(): Promise<string | null> {
	await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
	const response = await GoogleSignin.signIn();
	if (!isSuccessResponse(response)) return null;
	const idToken =
		response.data.idToken ?? (await GoogleSignin.getTokens()).idToken;
	return idToken ?? null;
}

export function isGoogleSignInCancelled(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code: string }).code === statusCodes.SIGN_IN_CANCELLED
	);
}
