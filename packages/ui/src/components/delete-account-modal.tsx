"use client";
import { useState } from "react";
import { Button } from "./button";
import { Field, inputClass } from "./field";
import { Modal } from "./modal";

export type DeleteAccountModalAuthMethods = {
	password: boolean;
	google: boolean;
};

export type DeleteAccountModalProof =
	| { password: string }
	| { idToken: string };

export function DeleteAccountModal({
	open,
	authMethods,
	onClose,
	onDelete,
	googleVerify,
	googleIdToken = null,
	isPending = false,
	error = null,
}: {
	open: boolean;
	authMethods: DeleteAccountModalAuthMethods;
	onClose: () => void;
	onDelete: (proof: DeleteAccountModalProof) => Promise<void>;
	/** Google re-auth UI (e.g. @react-oauth/google GoogleLogin). Parent sets `googleIdToken` on success. */
	googleVerify?: React.ReactNode;
	googleIdToken?: string | null;
	isPending?: boolean;
	error?: string | null;
}) {
	const [step, setStep] = useState<"confirm" | "verify">("confirm");
	const [password, setPassword] = useState("");

	if (!open) return null;

	function handleClose() {
		setStep("confirm");
		setPassword("");
		onClose();
	}

	const proof: DeleteAccountModalProof | null = googleIdToken
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
			title={step === "confirm" ? "Delete account?" : "Verify your identity"}
			sub={
				step === "confirm"
					? "Permanently delete your account and all data? This cannot be undone."
					: "Confirm it is you before we delete your account."
			}
			onClose={handleClose}
			footer={
				step === "confirm" ? (
					<>
						<Button variant="ghost" onClick={handleClose}>
							Cancel
						</Button>
						<Button variant="danger" onClick={() => setStep("verify")}>
							Continue
						</Button>
					</>
				) : (
					<>
						<Button variant="ghost" onClick={() => setStep("confirm")}>
							Back
						</Button>
						<Button
							variant="danger"
							disabled={!canDelete}
							onClick={() => {
								if (!proof) return;
								void onDelete(proof);
							}}
						>
							{isPending ? "Deleting…" : "Delete account"}
						</Button>
					</>
				)
			}
		>
			{step === "verify" ? (
				<div className="flex flex-col gap-4">
					<Field label="Password">
						<input
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={
								!authMethods.password || isPending || Boolean(googleIdToken)
							}
							placeholder={
								authMethods.password
									? "Enter your password"
									: "Password not set on this account"
							}
							className={inputClass}
						/>
					</Field>
					{!authMethods.password && (
						<p className="m-0 text-xs text-ink-500">
							No password on this account. Use Google verification below, or set
							a password via forgot password first.
						</p>
					)}

					{googleVerify ? (
						<div
							className={
								authMethods.google
									? undefined
									: "opacity-50 pointer-events-none"
							}
						>
							<p className="m-0 mb-2 text-xs font-medium text-ink-600">
								Or verify with Google
							</p>
							{googleVerify}
						</div>
					) : null}
					{!authMethods.google && (
						<p className="m-0 text-xs text-ink-500">
							Google sign-in is not linked to this account.
						</p>
					)}

					{googleIdToken ? (
						<p className="m-0 text-xs text-primary-700">
							Google verification complete. You can delete your account now.
						</p>
					) : null}

					{error ? (
						<p className="m-0 text-sm text-danger-fg" role="alert">
							{error}
						</p>
					) : null}
				</div>
			) : null}
		</Modal>
	);
}
