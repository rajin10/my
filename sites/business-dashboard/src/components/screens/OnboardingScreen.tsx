"use client";

import { Check, MapPin, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "../../context/toast";
import {
	useCreateBranch,
	useCreateService,
	useCreateBusiness,
} from "../../hooks/useOwnerData";
import { cn } from "../../lib/cn";
import { Button, Card, Field, inputClass } from "../primitives";

const STEPS = [
	{ id: "business", label: "Your business", sub: "Tell customers who you are." },
	{ id: "branch", label: "First branch", sub: "Where can customers find you?" },
	{
		id: "service",
		label: "First service",
		sub: "Add something customers can book.",
	},
] as const;

const CATEGORIES = ["Spa", "Salon", "Massage", "Wellness", "Beauty", "Nails"];

export function OnboardingScreen() {
	const router = useRouter();
	const { flash } = useToast();
	const createBusiness = useCreateBusiness();
	const createBranch = useCreateBranch();
	const createService = useCreateService();

	const [step, setStep] = useState(0);
	const [businessId, setBusinessId] = useState<string | null>(null);
	const [branchId, setBranchId] = useState<string | null>(null);

	const [business, setBusiness] = useState({
		name: "",
		category: CATEGORIES[0],
		city: "",
		description: "",
	});
	const [branch, setBranch] = useState({
		name: "",
		address: "",
		city: "",
	});
	const [service, setService] = useState({
		name: "",
		category: "Spa",
		duration: "60",
		price: "",
	});

	const isPending =
		createBusiness.isPending || createBranch.isPending || createService.isPending;

	function handleBusinessNext() {
		if (!business.name.trim() || !business.city.trim()) return;
		createBusiness.mutate(
			{
				name: business.name.trim(),
				category: business.category,
				city: business.city.trim(),
				vertical: "booking",
				description: business.description.trim() || undefined,
				status: "Draft",
			},
			{
				onSuccess: (res) => {
					const created = res.data ?? (res as unknown as { id: string });
					setBusinessId(created.id);
					setBranch((b) => ({ ...b, city: b.city || business.city.trim() }));
					setStep(1);
				},
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function handleBranchNext() {
		if (
			!businessId ||
			!branch.name.trim() ||
			!branch.address.trim() ||
			!branch.city.trim()
		)
			return;
		createBranch.mutate(
			{
				businessId,
				name: branch.name.trim(),
				address: branch.address.trim(),
				city: branch.city.trim(),
			},
			{
				onSuccess: (res) => {
					const created = res.data ?? (res as unknown as { id: string });
					setBranchId(created.id);
					setStep(2);
				},
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function handleFinish() {
		if (!branchId || !service.name.trim() || !service.price) return;
		createService.mutate(
			{
				branchId,
				name: service.name.trim(),
				category: service.category,
				duration: Number(service.duration) || 30,
				price: Number(service.price) || 0,
			},
			{
				onSuccess: () => {
					flash("You're all set — welcome to Talash", "Sparkles");
					router.replace("/overview");
				},
				onError: (e: Error) => flash(e.message),
			},
		);
	}

	function handleBack() {
		if (step === 0) return;
		setStep((s) => s - 1);
	}

	const current = STEPS[step];

	return (
		<div className="min-h-[calc(100vh-4rem)] flex flex-col items-center py-8 md:py-12 px-4">
			<div className="w-full max-w-lg">
				<div className="flex items-center gap-2.5 mb-8">
					<div className="w-9 h-9 rounded-md bg-primary-700 flex items-center justify-center">
						<Sparkles size={18} className="text-white" />
					</div>
					<span className="font-serif text-xl font-medium text-ink-900">
						Talash
					</span>
				</div>

				<div className="flex gap-2 mb-6">
					{STEPS.map((s, i) => (
						<div
							key={s.id}
							className={cn(
								"flex-1 h-1 rounded-full transition-colors",
								i <= step ? "bg-primary-600" : "bg-line",
							)}
						/>
					))}
				</div>

				<p className="font-sans text-xs font-bold tracking-wide uppercase text-primary-700 mb-2">
					Step {step + 1} of {STEPS.length}
				</p>
				<h1 className="font-serif text-3xl font-medium text-ink-900 m-0 mb-2">
					{current.label}
				</h1>
				<p className="font-sans text-sm text-ink-500 m-0 mb-8">{current.sub}</p>

				<Card className="mb-6 p-5">
					{step === 0 && (
						<div className="flex flex-col gap-4">
							<Field label="Business name">
								<input
									value={business.name}
									onChange={(e) => setBusiness({ ...business, name: e.target.value })}
									placeholder="e.g. Aanya Spa"
									className={inputClass}
								/>
							</Field>
							<Field label="Category">
								<select
									value={business.category}
									onChange={(e) =>
										setBusiness({ ...business, category: e.target.value })
									}
									className={cn(inputClass, "cursor-pointer")}
								>
									{CATEGORIES.map((c) => (
										<option key={c}>{c}</option>
									))}
								</select>
							</Field>
							<Field label="City">
								<input
									value={business.city}
									onChange={(e) => setBusiness({ ...business, city: e.target.value })}
									placeholder="e.g. Dhaka"
									className={inputClass}
								/>
							</Field>
							<Field
								label="Short description"
								hint="Optional — shown on your public profile."
							>
								<textarea
									value={business.description}
									onChange={(e) =>
										setBusiness({ ...business, description: e.target.value })
									}
									placeholder="What makes your place special?"
									rows={3}
									className={cn(inputClass, "resize-none")}
								/>
							</Field>
						</div>
					)}

					{step === 1 && (
						<div className="flex flex-col gap-4">
							<div className="flex items-center gap-2 text-sm text-ink-500 mb-1">
								<MapPin size={15} className="text-primary-600" />
								<span>At least one branch is required to accept bookings.</span>
							</div>
							<Field label="Branch name">
								<input
									value={branch.name}
									onChange={(e) =>
										setBranch({ ...branch, name: e.target.value })
									}
									placeholder="e.g. Gulshan"
									className={inputClass}
								/>
							</Field>
							<Field label="Address">
								<input
									value={branch.address}
									onChange={(e) =>
										setBranch({ ...branch, address: e.target.value })
									}
									placeholder="Street address or landmark"
									className={inputClass}
								/>
							</Field>
							<Field label="City">
								<input
									value={branch.city}
									onChange={(e) =>
										setBranch({ ...branch, city: e.target.value })
									}
									placeholder="e.g. Dhaka"
									className={inputClass}
								/>
							</Field>
						</div>
					)}

					{step === 2 && (
						<div className="flex flex-col gap-4">
							<Field label="Service name">
								<input
									value={service.name}
									onChange={(e) =>
										setService({ ...service, name: e.target.value })
									}
									placeholder="e.g. Signature massage"
									className={inputClass}
								/>
							</Field>
							<div className="grid grid-cols-2 gap-3.5">
								<Field label="Category">
									<select
										value={service.category}
										onChange={(e) =>
											setService({ ...service, category: e.target.value })
										}
										className={cn(inputClass, "cursor-pointer")}
									>
										{["Spa", "Massage", "Face", "Hair", "Nails"].map((c) => (
											<option key={c}>{c}</option>
										))}
									</select>
								</Field>
								<Field label="Duration (min)">
									<input
										value={service.duration}
										onChange={(e) =>
											setService({ ...service, duration: e.target.value })
										}
										inputMode="numeric"
										className={inputClass}
									/>
								</Field>
							</div>
							<Field label="Price (৳)">
								<input
									value={service.price}
									onChange={(e) =>
										setService({ ...service, price: e.target.value })
									}
									inputMode="numeric"
									placeholder="2400"
									className={inputClass}
								/>
							</Field>
						</div>
					)}
				</Card>

				<div className="flex gap-3">
					{step > 0 && (
						<Button variant="ghost" onClick={handleBack} disabled={isPending}>
							Back
						</Button>
					)}
					<Button
						className="flex-1"
						icon={step === 2 ? "Check" : undefined}
						iconRight={step !== 2 ? "ArrowRight" : undefined}
						disabled={
							isPending ||
							(step === 0 && (!business.name.trim() || !business.city.trim())) ||
							(step === 1 &&
								(!branch.name.trim() ||
									!branch.address.trim() ||
									!branch.city.trim())) ||
							(step === 2 && (!service.name.trim() || !service.price))
						}
						onClick={() => {
							if (step === 0) handleBusinessNext();
							else if (step === 1) handleBranchNext();
							else handleFinish();
						}}
					>
						{isPending ? "Saving…" : step === 2 ? "Finish setup" : "Continue"}
					</Button>
				</div>

				{step === 2 && (
					<p className="font-sans text-xs text-ink-400 text-center mt-6 flex items-center justify-center gap-1.5">
						<Check size={14} className="text-primary-600" />
						Your business starts as Draft — go live from Business settings when ready.
					</p>
				)}
			</div>
		</div>
	);
}
