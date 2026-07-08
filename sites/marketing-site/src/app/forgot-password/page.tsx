"use client";

import { authFormErrorMessage } from "@repo/api-client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
				source: "marketing-site",
			});
			setSent(true);
		} catch (err) {
			setError(authFormErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-paper px-4">
			<div className="w-full max-w-100">
				<Link href="/" className="flex items-center gap-2 mb-10 no-underline">
					<Image src="/talash-mark.svg" width={28} height={28} alt="" />
					<span className="font-serif text-2xl font-semibold tracking-tight text-ink-900">
						Talash
					</span>
				</Link>

				<div className="bg-surface rounded-xl border border-line shadow-md p-8">
					<h1 className="m-0 mb-1.5 font-serif font-normal text-3xl text-ink-900">
						Reset password
					</h1>
					<p className="m-0 mb-7 font-sans text-sm text-ink-500">
						Enter your email and we will send you a reset link.
					</p>

					{sent ? (
						<p className="text-sm text-ink-600 text-center">
							If an account exists, a reset link has been sent. Check your
							inbox.
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
		</div>
	);
}
