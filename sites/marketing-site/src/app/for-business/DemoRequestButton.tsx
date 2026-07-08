"use client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";

export function DemoRequestButton() {
	const [open, setOpen] = useState(false);
	const [f, setF] = useState({
		name: "",
		email: "",
		businessName: "",
		message: "",
	});
	const [done, setDone] = useState(false);

	const mut = useMutation({
		mutationFn: () =>
			api.demoRequests.create({
				name: f.name,
				email: f.email,
				businessName: f.businessName,
				message: f.message || undefined,
			}),
		onSuccess: () => {
			setDone(true);
			setF({ name: "", email: "", businessName: "", message: "" });
		},
	});

	function set(k: string) {
		return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			setF((prev) => ({ ...prev, [k]: e.target.value }));
	}

	const valid = f.name.trim() && f.email.trim() && f.businessName.trim();

	return (
		<>
			<Button
				variant="ghost"
				size="lg"
				onClick={() => {
					setOpen(true);
					setDone(false);
				}}
			>
				Book a demo
			</Button>

			{open && (
				<div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-900/50 px-4">
					<div className="bg-surface rounded-2xl border border-line shadow-2xl w-full max-w-md p-7">
						{done ? (
							<div className="text-center py-6">
								<div className="text-4xl mb-4">✓</div>
								<h3 className="m-0 mb-2 font-serif font-medium text-2xl text-ink-900">
									Request received!
								</h3>
								<p className="m-0 mb-6 font-sans text-sm text-ink-500 leading-relaxed">
									We'll be in touch within 1 business day to schedule your demo.
								</p>
								<Button onClick={() => setOpen(false)}>Close</Button>
							</div>
						) : (
							<>
								<div className="flex items-start justify-between mb-6">
									<div>
										<h3 className="m-0 font-serif font-medium text-xl text-ink-900">
											Book a demo
										</h3>
										<p className="m-0 mt-1 font-sans text-sm text-ink-500">
											We'll walk you through how Talash works for your business.
										</p>
									</div>
									<button
										type="button"
										onClick={() => setOpen(false)}
										className="text-ink-400 hover:text-ink-700 bg-transparent border-none cursor-pointer p-0 shrink-0 ml-4"
									>
										✕
									</button>
								</div>
								<form
									onSubmit={(e) => {
										e.preventDefault();
										if (valid) mut.mutate();
									}}
									className="flex flex-col gap-4"
								>
									<div className="flex flex-col gap-1">
										<label className="font-sans text-xs font-semibold text-ink-500">
											Your name
										</label>
										<input
											value={f.name}
											onChange={set("name")}
											placeholder="Fatima Khan"
											required
											className="w-full px-3 py-2.5 rounded-md border border-line font-sans text-sm text-ink-900 bg-transparent outline-none focus:border-primary-500"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<label className="font-sans text-xs font-semibold text-ink-500">
											Work email
										</label>
										<input
											type="email"
											value={f.email}
											onChange={set("email")}
											placeholder="fatima@yourbusinessapp.com"
											required
											className="w-full px-3 py-2.5 rounded-md border border-line font-sans text-sm text-ink-900 bg-transparent outline-none focus:border-primary-500"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<label className="font-sans text-xs font-semibold text-ink-500">
											Business name
										</label>
										<input
											value={f.businessName}
											onChange={set("businessName")}
											placeholder="Serenity Spa"
											required
											className="w-full px-3 py-2.5 rounded-md border border-line font-sans text-sm text-ink-900 bg-transparent outline-none focus:border-primary-500"
										/>
									</div>
									<div className="flex flex-col gap-1">
										<label className="font-sans text-xs font-semibold text-ink-500">
											Anything specific you'd like to see? (optional)
										</label>
										<textarea
											value={f.message}
											onChange={set("message")}
											rows={3}
											className="w-full px-3 py-2.5 rounded-md border border-line font-sans text-sm text-ink-900 bg-transparent outline-none focus:border-primary-500 resize-none"
										/>
									</div>
									{mut.error && (
										<p className="font-sans text-xs text-danger-fg">
											{(mut.error as Error).message}
										</p>
									)}
									<div className="flex gap-3 pt-1">
										<Button
											type="button"
											variant="ghost"
											onClick={() => setOpen(false)}
										>
											Cancel
										</Button>
										<Button type="submit" disabled={!valid || mut.isPending}>
											{mut.isPending ? "Sending…" : "Send request"}
										</Button>
									</div>
								</form>
							</>
						)}
					</div>
				</div>
			)}
		</>
	);
}
