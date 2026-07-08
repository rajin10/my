"use client";
import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

interface QueryErrorProps {
	title?: string;
	message?: string;
	onRetry?: () => void;
}

export function QueryError({
	title = "Couldn't load businesses",
	message = "Something went wrong on our side. Check your connection and try again.",
	onRetry,
}: QueryErrorProps) {
	return (
		<div className="text-center px-8 py-16 md:py-20">
			<div className="w-14 h-14 rounded-full bg-danger-bg flex items-center justify-center mx-auto mb-5">
				<AlertCircle size={28} className="text-danger-fg" />
			</div>
			<strong className="block text-xl text-ink-700 mb-2.5 font-serif font-normal">
				{title}
			</strong>
			<p className="m-0 mb-6 font-sans text-sm text-ink-500 max-w-md mx-auto">
				{message}
			</p>
			{onRetry && (
				<Button variant="ghost" onClick={onRetry}>
					Try again
				</Button>
			)}
		</div>
	);
}
