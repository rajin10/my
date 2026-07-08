"use client";

import {
	authFormErrorMessage,
	authLoginErrorMessage,
	authSignInStartErrorMessage,
} from "@repo/api-client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, tokenStore } from "@/lib/api";
import { bootstrapAuthSession } from "@/lib/auth-bootstrap";

function GoogleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z"
			/>
		</svg>
	);
}

const inputClass =
	"w-full py-2.5 px-3 bg-paper border border-line rounded-md text-sm text-ink-800";

function LoginForm() {
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [googleLoading, setGoogleLoading] = useState(false);
	const [emailLoading, setEmailLoading] = useState(false);
	const [error, setError] = useState(
		authLoginErrorMessage(searchParams.get("error")),
	);

	const loading = googleLoading || emailLoading;
	const next = searchParams.get("next") ?? "/";

	async function signInWithGoogle() {
		setGoogleLoading(true);
		setError("");
		try {
			const redirectUri = `${window.location.origin}/auth/callback`;
			sessionStorage.setItem("auth_next", next);
			const { url } = await api.auth.getGoogleUrl(
				redirectUri,
				"marketing-site",
			);
			window.location.href = url;
		} catch (e) {
			setError(authSignInStartErrorMessage(e));
			setGoogleLoading(false);
		}
	}

	async function signInWithEmail(e: React.FormEvent) {
		e.preventDefault();
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setEmailLoading(true);
		setError("");
		try {
			const tokens = await api.auth.login({
				email,
				password,
				source: "marketing-site",
			});
			await tokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
			await bootstrapAuthSession();
			// Hard navigation so AuthProvider bootstraps with tokens already set
			// (client-side router.replace left the header on "Sign in").
			window.location.replace(next);
		} catch (err) {
			setError(authFormErrorMessage(err));
			setEmailLoading(false);
		}
	}

	return (
		<>
			<button
				type="button"
				onClick={signInWithGoogle}
				disabled={loading}
				className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface border border-line rounded-md text-base font-semibold text-ink-800 cursor-pointer hover:bg-primary-50 transition-colors disabled:opacity-60"
			>
				<GoogleIcon />
				{googleLoading ? "Redirecting…" : "Continue with Google"}
			</button>

			<div className="flex items-center gap-3 my-5">
				<div className="flex-1 h-px bg-line" />
				<span className="text-xs text-ink-400">or</span>
				<div className="flex-1 h-px bg-line" />
			</div>

			<form onSubmit={signInWithEmail} className="flex flex-col gap-3">
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
					autoComplete="current-password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					className={inputClass}
				/>
				<button
					type="submit"
					disabled={loading}
					className="w-full py-3 px-4 bg-primary-600 text-white rounded-md text-base font-semibold cursor-pointer hover:bg-primary-700 transition-colors disabled:opacity-60"
				>
					{emailLoading ? "Signing in…" : "Sign in"}
				</button>
			</form>

			<div className="flex justify-between mt-4 text-xs">
				<Link href="/forgot-password" className="text-primary-700 no-underline">
					Forgot password?
				</Link>
				<Link href="/register" className="text-primary-700 no-underline">
					Create account
				</Link>
			</div>

			{error && <p className="text-danger text-xs mt-3 text-center">{error}</p>}
		</>
	);
}

export default function LoginPage() {
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
						Sign in
					</h1>
					<p className="m-0 mb-7 font-sans text-sm text-ink-500">
						Book appointments and manage your account.
					</p>

					<Suspense>
						<LoginForm />
					</Suspense>

					<p className="mt-6 text-xs text-ink-400 text-center">
						By signing in you agree to our{" "}
						<Link href="/terms" className="text-ink-600 underline">
							Terms of Service
						</Link>
						.
					</p>
				</div>

				<p className="mt-6 text-center font-sans text-sm text-ink-500">
					Want to list your business?{" "}
					<Link
						href="/for-business"
						className="text-primary-700 font-semibold no-underline"
					>
						Learn more →
					</Link>
				</p>
			</div>
		</div>
	);
}
