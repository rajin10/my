"use client";

import { authFormErrorMessage } from "@repo/api-client";
import Link from "next/link";
import { useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { api } from "@/lib/api";

const inputClass =
	"w-full py-2.5 px-3 bg-paper border border-line rounded-md text-sm text-ink-800";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			await api.auth.forgotPassword({
				email,
				reset_uri: `${window.location.origin}/auth/reset-password`,
				source: "business-app",
			});
			setSent(true);
		} catch (err) {
			setError(authFormErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex flex-col bg-paper">
			<div className="flex-1 flex items-center justify-center">
				<div className="w-100 p-10 bg-surface rounded-xl shadow-md">
					<h1 className="m-0 mb-2 text-3xl font-semibold text-ink-900">
						Reset password
					</h1>
					<p className="m-0 mb-7 text-ink-500 text-sm">
						Enter your email and we will send you a reset link.
					</p>

					{sent ? (
						<p className="text-sm text-ink-600 text-center">
							If an account exists, a reset link has been sent.
						</p>
					) : (
						<form onSubmit={handleSubmit} className="flex flex-col gap-3">
							<input
								type="email"
								autoComplete="email"
								placeholder="Email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className={inputClass}
							/>
							<button
								type="submit"
								disabled={loading}
								className="w-full py-3 px-4 bg-primary-600 text-white rounded-md text-base font-semibold cursor-pointer hover:bg-primary-700 transition-colors disabled:opacity-60"
							>
								{loading ? "Sending…" : "Send reset link"}
							</button>
						</form>
					)}

					{error && (
						<p className="text-danger text-xs mt-3 text-center">{error}</p>
					)}

					<p className="mt-6 text-center text-sm text-ink-500">
						<Link
							href="/login"
							className="text-primary-700 font-semibold no-underline"
						>
							Back to sign in
						</Link>
					</p>
				</div>
			</div>
			<AppFooter />
		</div>
	);
}
