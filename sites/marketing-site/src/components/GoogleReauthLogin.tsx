"use client";

import { GoogleLogin } from "@react-oauth/google";

export function GoogleReauthLogin({
	onCredential,
	disabled = false,
}: {
	onCredential: (idToken: string) => void;
	disabled?: boolean;
}) {
	if (disabled) {
		return (
			<p className="m-0 text-xs text-ink-400">
				Google verification unavailable for this account.
			</p>
		);
	}

	return (
		<GoogleLogin
			onSuccess={(response) => {
				if (response.credential) onCredential(response.credential);
			}}
			onError={() => {
				/* parent surfaces delete errors */
			}}
			text="continue_with"
			theme="outline"
			size="large"
			width="100%"
		/>
	);
}
