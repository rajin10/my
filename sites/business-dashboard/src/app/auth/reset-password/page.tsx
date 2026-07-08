"use client";

import { authFormErrorMessage } from "@repo/api-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { api } from "@/lib/api";

const inputClass =
	"w-full py-2.5 px-3 bg-paper border border-line rounded-md text-sm text-ink-800";

function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token") ?? "";
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!token) {
			setError("Reset link is invalid or expired.");
			return;
		}
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setLoading(true);
		setError("");
		try {
			await api.auth.resetPassword({ token, password });
			setDone(true);
			setTimeout(() => router.replace("/login"), 2000);
		} catch (err) {
			setError(authFormErrorMessage(err));
			setLoading(false);
		}
	}

	if (!token) {
		return (
			<p className="text-sm text-danger text-center">
				Reset link is invalid.{" "}
				<Link href="/forgot-password" className="text-primary-700">
					Request a new one
				</Link>
				.
			</p>
		);
	}

	if (done) {
		return (
			<p className="text-sm text-ink-600 text-center">
				Password updated. Redirecting to sign in…
			</p>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-3">
			<input
				type="password"
				autoComplete="new-password"
				placeholder="New password (min 8 characters)"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				required
				minLength={8}
				className={inputClass}
			/>
			<button
				type="submit"
				disabled={loading}
				className="w-full py-3 px-4 bg-primary-600 text-white rounded-md text-base font-semibold cursor-pointer hover:bg-primary-700 transition-colors disabled:opacity-60"
			>
				{loading ? "Updating…" : "Set new password"}
			</button>
			{error && <p className="text-danger text-xs text-center">{error}</p>}
		</form>
	);
}

export default function ResetPasswordPage() {
	return (
		<div className="min-h-screen flex flex-col bg-paper">
			<div className="flex-1 flex items-center justify-center">
				<div className="w-100 p-10 bg-surface rounded-xl shadow-md">
					<h1 className="m-0 mb-2 text-3xl font-semibold text-ink-900">
						Set new password
					</h1>
					<p className="m-0 mb-7 text-ink-500 text-sm">
						Choose a new password for your account.
					</p>
					<Suspense>
						<ResetPasswordForm />
					</Suspense>
				</div>
			</div>
			<AppFooter />
		</div>
	);
}
