"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/Button";

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
			<div className="max-w-[440px] text-center">
				<div className="text-5xl mb-5">✦</div>
				<h1 className="m-0 mb-2 font-serif font-normal text-3xl text-ink-900">
					Something went wrong
				</h1>
				<p className="m-0 mb-8 font-sans text-base text-ink-500">
					An unexpected error occurred. Please try again.
				</p>
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<Button onClick={reset}>Try again</Button>
					<Link href="/" className="no-underline">
						<Button variant="ghost">Back to home</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
