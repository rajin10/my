"use client";

import { authFormErrorMessage } from "@repo/api-client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { api, tokenStore } from "@/lib/api";
import { bootstrapAuthSession } from "@/lib/auth-bootstrap";

const inputClass =
	"w-full py-2.5 px-3 bg-paper border border-line rounded-md text-sm text-ink-800";

export default function RegisterPage() {
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
				source: "marketing-site",
			});
			await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
			await bootstrapAuthSession();
			window.location.replace("/");
		} catch (err) {
			setError(authFormErrorMessage(err));
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
						Create account
					</h1>
					<p className="m-0 mb-7 font-sans text-sm text-ink-500">
						Sign up to book appointments and save your favourites.
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
		</div>
	);
}
