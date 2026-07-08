import type { AuthTokens } from "@repo/api-client";

// Switch between auth providers via EXPO_PUBLIC_AUTH_PROVIDER env var.
//
// "redirect" (default) — server-side OAuth redirect flow; works in Expo Go.
// "native"             — @react-native-google-signin native SDK; requires an
//                        EAS dev/preview/prod build (does NOT work in Expo Go).
//
// Conditional require is intentional: a static import of the native module
// would cause it to be evaluated even when the redirect provider is active,
// breaking Expo Go.

type Props = { onAuthed: (tokens: AuthTokens) => void };

const provider = process.env.EXPO_PUBLIC_AUTH_PROVIDER ?? "redirect";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const _native = () =>
	(require("./AuthScreenNative") as { default: React.ComponentType<Props> })
		.default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _redirect = () =>
	(require("./AuthScreenRedirect") as { default: React.ComponentType<Props> })
		.default;

const AuthScreen: React.ComponentType<Props> =
	provider === "native" ? _native() : _redirect();

export default AuthScreen;
