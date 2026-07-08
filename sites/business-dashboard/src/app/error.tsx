"use client";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-paper px-4">
			<div className="max-w-[400px] text-center">
				<div className="text-4xl mb-4">⚠️</div>
				<h1 className="m-0 mb-2 font-sans text-2xl font-bold text-ink-900">
					Something went wrong
				</h1>
				<p className="m-0 mb-6 font-sans text-sm text-ink-500">
					An error occurred loading this page. Your data is safe.
				</p>
				<button
					type="button"
					onClick={reset}
					className="px-5 py-2.5 bg-primary-700 text-white rounded-md border-none cursor-pointer font-sans text-sm font-semibold"
				>
					Try again
				</button>
			</div>
		</div>
	);
}
