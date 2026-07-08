"use client";

import { authFormErrorMessage } from "@repo/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppFooter } from "@/components/AppFooter";
import { api, tokenStore } from "@/lib/api";

const inputClass =
	"w-full py-2.5 px-3 bg-paper border border-line rounded-md text-sm text-ink-800";

export default function RegisterPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const tokens = await api.auth.register({
				name,
				email,
				password,
				source: "business-app",
			});
			await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
			router.replace("/onboarding");
		} catch (err) {
			setError(authFormErrorMessage(err));
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex flex-col bg-paper">
			<div className="flex-1 flex items-center justify-center">
				<div className="w-100 p-10 bg-surface rounded-xl shadow-md">
					<h1 className="m-0 mb-2 text-3xl font-semibold text-ink-900">
						Create business account
					</h1>
					<p className="m-0 mb-7 text-ink-500 text-sm">
						Register to list and manage your business on Talash.
					</p>

					<form onSubmit={handleSubmit} className="flex flex-col gap-3">
						<input
							type="text"
							autoComplete="name"
							placeholder="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							className={inputClass}
						/>
						<input
							type="email"
							autoComplete="email"
							placeholder="Email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							className={inputClass}
						/>
						<input
							type="password"
							autoComplete="new-password"
							placeholder="Password (min 8 characters)"
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
							{loading ? "Creating account…" : "Create account"}
						</button>
					</form>

					{error && (
						<p className="text-danger text-xs mt-3 text-center">{error}</p>
					)}

					<p className="mt-6 text-center text-sm text-ink-500">
						Already have an account?{" "}
						<Link
							href="/login"
							className="text-primary-700 font-semibold no-underline"
						>
							Sign in
						</Link>
					</p>
				</div>
			</div>
			<AppFooter />
		</div>
	);
}
