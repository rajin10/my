"use client";
import type { Branch, Service, ValidateCouponResponse } from "@repo/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BrandThemeBoundary } from "@/components/BrandThemeBoundary";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
	return new Date(iso).toLocaleTimeString("en-BD", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-BD", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});
}

function todayIso() {
	return new Date().toISOString().slice(0, 10);
}

// ── step indicator ────────────────────────────────────────────────────────────

function Steps({ step }: { step: number }) {
	const labels = ["Service", "Date & time", "Confirm"];
	return (
		<div className="flex items-center gap-0 mb-8">
			{labels.map((label, i) => (
				<div key={label} className="flex items-center">
					<div className="flex items-center gap-2">
						<div
							className={[
								"w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-sans",
								i + 1 <= step
									? "bg-primary-700 text-white"
									: "bg-line text-ink-400",
							].join(" ")}
						>
							{i + 1 < step ? <CheckCircle size={14} /> : i + 1}
						</div>
						<span
							className={[
								"font-sans text-sm",
								i + 1 === step ? "font-semibold text-ink-900" : "text-ink-400",
							].join(" ")}
						>
							{label}
						</span>
					</div>
					{i < labels.length - 1 && (
						<div className="w-8 sm:w-14 h-px bg-line mx-2 sm:mx-3" />
					)}
				</div>
			))}
		</div>
	);
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BookPage({
	params,
}: {
	params: Promise<{ businessId: string }>;
}) {
	const { businessId } = use(params);
	const router = useRouter();
	const { user, isLoading: authLoading } = useAuth();

	const [step, setStep] = useState(1);
	const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
	const [selectedService, setSelectedService] = useState<Service | null>(null);
	const [selectedDate, setSelectedDate] = useState(todayIso());
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [_bookingId, setBookingId] = useState<string | null>(null);
	const [couponCode, setCouponCode] = useState("");
	const [couponResult, setCouponResult] =
		useState<ValidateCouponResponse | null>(null);

	// Auth guard
	useEffect(() => {
		if (!authLoading && !user) {
			router.replace(`/login?next=/book/${businessId}`);
		}
	}, [user, authLoading, router, businessId]);

	const businessQ = useQuery({
		queryKey: ["business", businessId],
		queryFn: () => api.businesses.get(businessId),
		staleTime: 300_000,
	});

	const branchesQ = useQuery({
		queryKey: ["branches", businessId],
		queryFn: () => api.branches.list(businessId, { limit: 50 }),
		enabled: !!businessId,
		staleTime: 120_000,
	});

	const branches = branchesQ.data?.data ?? [];
	const activeBranch = selectedBranch ?? branches[0] ?? null;

	const servicesQ = useQuery({
		queryKey: ["services", activeBranch?.id],
		queryFn: () => api.services.list(activeBranch?.id, { limit: 100 }),
		enabled: !!activeBranch?.id,
		staleTime: 120_000,
	});

	const availabilityQ = useQuery({
		queryKey: [
			"branch-availability",
			activeBranch?.id,
			selectedDate,
			selectedService?.id,
		],
		queryFn: () =>
			api.branches.getAvailability(activeBranch!.id, {
				date: selectedDate,
				serviceId: selectedService!.id,
			}),
		enabled: !!activeBranch?.id && !!selectedService?.id,
		staleTime: 60_000,
	});

	const services = servicesQ.data?.data ?? [];
	const slots = availabilityQ.data?.slots ?? [];
	const branchClosed = availabilityQ.data?.isClosed ?? false;

	const validateCoupon = useMutation({
		mutationFn: (code: string) => api.coupons.validate({ code, businessId }),
		onSuccess: (res) => setCouponResult(res),
	});

	const createBooking = useMutation({
		mutationFn: () =>
			api.bookings.create({
				serviceId: selectedService!.id,
				branchId: activeBranch!.id,
				businessId,
				slot: selectedSlot!,
				...(couponResult?.valid && couponResult.coupon
					? { couponCode: couponResult.coupon.code }
					: {}),
			}),
		onSuccess: (res) => {
			setBookingId(res.data.id);
			setStep(4);
		},
	});

	const business = businessQ.data?.data;
	// Single-tenant: render the booking flow inside the venue's brand boundary
	// (mirrors the detail page #65 and mobile booking.tsx #60). `null` → Talash
	// defaults. Scoped to this route, so it never leaks into cross-venue pages.
	const palette = business?.brandPalette ?? null;

	// ── loading / auth ─────────────────────────────────────────────────────────
	if (authLoading || !user) {
		return (
			<BrandThemeBoundary palette={palette}>
				<Nav />
				<main className="max-w-[700px] mx-auto px-4 py-12">
					<div className="h-48 rounded-xl bg-line animate-pulse" />
				</main>
			</BrandThemeBoundary>
		);
	}

	// ── success ────────────────────────────────────────────────────────────────
	if (step === 4) {
		return (
			<BrandThemeBoundary palette={palette}>
				<Nav />
				<main className="max-w-[520px] mx-auto px-4 py-20 text-center">
					<div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-6">
						<CheckCircle size={32} className="text-success-fg" />
					</div>
					<h1 className="m-0 mb-2 font-serif font-normal text-3xl text-ink-900">
						Booking confirmed!
					</h1>
					<p className="m-0 mb-2 font-sans text-base text-ink-600">
						{selectedService?.name} at {business?.name}
					</p>
					<p className="m-0 mb-8 font-sans text-sm text-ink-500">
						{selectedSlot
							? `${formatDate(selectedSlot)}, ${formatTime(selectedSlot)}`
							: ""}
					</p>
					<div className="flex flex-col sm:flex-row gap-3 justify-center">
						<Link href="/account" className="no-underline">
							<Button variant="dark">View my bookings</Button>
						</Link>
						<Link href="/" className="no-underline">
							<Button variant="ghost">Back to home</Button>
						</Link>
					</div>
				</main>
				<Footer />
			</BrandThemeBoundary>
		);
	}

	return (
		<BrandThemeBoundary palette={palette}>
			<Nav />
			<main className="max-w-[700px] mx-auto px-4 md:px-8 py-8 pb-16">
				<Link
					href={`/businesses/${businessId}`}
					className="inline-flex items-center gap-1.5 no-underline font-sans text-sm font-semibold text-primary-700 mb-6"
				>
					<ArrowLeft size={16} />
					{business?.name ?? "Back"}
				</Link>

				<h1 className="m-0 mb-1.5 font-serif font-normal text-3xl text-ink-900">
					Book an appointment
				</h1>
				{business && (
					<div className="flex items-center gap-1.5 text-ink-500 text-sm mb-7">
						<MapPin size={14} />
						{business.city} · {business.category}
					</div>
				)}

				<Steps step={step} />

				{/* ── Step 1: Service ─────────────────────────────────────── */}
				{step === 1 && (
					<div>
						{branches.length > 1 && (
							<div className="mb-5">
								<label className="font-sans text-sm font-semibold text-ink-700 block mb-2">
									Branch
								</label>
								<div className="flex flex-wrap gap-2">
									{branches.map((b) => (
										<button
											key={b.id}
											type="button"
											onClick={() => {
												setSelectedBranch(b);
												setSelectedService(null);
											}}
											className={[
												"px-4 py-2 rounded-md border font-sans text-sm font-medium cursor-pointer transition-colors",
												(selectedBranch?.id ?? branches[0]?.id) === b.id
													? "border-primary-700 bg-primary-50 text-primary-800"
													: "border-line bg-surface text-ink-700 hover:border-ink-400",
											].join(" ")}
										>
											{b.name}
										</button>
									))}
								</div>
							</div>
						)}

						<label className="font-sans text-sm font-semibold text-ink-700 block mb-2">
							Select a service
						</label>

						{servicesQ.isLoading ? (
							<div className="flex flex-col gap-2.5">
								{[1, 2, 3].map((i) => (
									<div
										key={i}
										className="h-16 rounded-lg bg-line animate-pulse"
									/>
								))}
							</div>
						) : services.length === 0 ? (
							<p className="font-sans text-sm text-ink-500 py-6 text-center">
								No services available for this branch.
							</p>
						) : (
							<div className="flex flex-col gap-2.5">
								{services.map((s) => (
									<button
										key={s.id}
										type="button"
										onClick={() => setSelectedService(s)}
										className={[
											"w-full text-left p-4 rounded-lg border cursor-pointer transition-colors",
											selectedService?.id === s.id
												? "border-primary-700 bg-primary-50"
												: "border-line bg-surface hover:border-ink-400",
										].join(" ")}
									>
										<div className="flex items-center justify-between">
											<span className="font-sans font-semibold text-ink-900">
												{s.name}
											</span>
											<span className="font-sans font-bold text-ink-900">
												৳{s.price}
											</span>
										</div>
										<div className="flex items-center gap-1.5 mt-1">
											<Clock size={13} className="text-ink-400" />
											<span className="font-sans text-xs text-ink-500">
												{s.duration} min
											</span>
											{s.category && (
												<>
													<span className="text-ink-300">·</span>
													<span className="font-sans text-xs text-ink-500">
														{s.category}
													</span>
												</>
											)}
										</div>
										{s.description && (
											<p className="m-0 mt-1.5 font-sans text-xs text-ink-500 leading-relaxed">
												{s.description}
											</p>
										)}
									</button>
								))}
							</div>
						)}

						<div className="mt-6 flex justify-end">
							<Button
								disabled={!selectedService}
								onClick={() => setStep(2)}
								icon="ArrowRight"
							>
								Continue
							</Button>
						</div>
					</div>
				)}

				{/* ── Step 2: Date & time ─────────────────────────────────── */}
				{step === 2 && (
					<div>
						<button
							type="button"
							onClick={() => setStep(1)}
							className="bg-transparent border-none font-sans text-sm text-ink-500 cursor-pointer p-0 mb-5 flex items-center gap-1"
						>
							<ArrowLeft size={14} /> Change service
						</button>

						<div className="bg-primary-50 border border-primary-200 rounded-lg p-3.5 mb-5 flex items-center justify-between">
							<div>
								<div className="font-sans text-sm font-semibold text-ink-900">
									{selectedService?.name}
								</div>
								<div className="font-sans text-xs text-ink-500 mt-0.5">
									{selectedService?.duration} min · ৳{selectedService?.price}
								</div>
							</div>
						</div>

						<div className="mb-6">
							<label className="font-sans text-sm font-semibold text-ink-700 block mb-2">
								Date
							</label>
							<input
								type="date"
								value={selectedDate}
								min={todayIso()}
								onChange={(e) => {
									setSelectedDate(e.target.value);
									setSelectedSlot(null);
								}}
								className="px-3 py-2.5 border border-line rounded-md font-sans text-sm text-ink-900 bg-surface outline-none focus:border-primary-600"
							/>
						</div>

						<div>
							<label className="font-sans text-sm font-semibold text-ink-700 block mb-2">
								Available times on{" "}
								{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
									"en-BD",
									{ weekday: "long", month: "long", day: "numeric" },
								)}
							</label>
							{slots.length === 0 ? (
								<p className="font-sans text-sm text-ink-500 py-4">
									{branchClosed
										? "This branch is closed on the selected day. Please pick another date."
										: "No slots available for this date. Please select a future date."}
								</p>
							) : (
								<div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
									{slots.map((slot) => (
										<button
											key={slot}
											type="button"
											onClick={() => setSelectedSlot(slot)}
											className={[
												"py-2.5 rounded-md border font-sans text-sm font-medium cursor-pointer transition-colors",
												selectedSlot === slot
													? "border-primary-700 bg-primary-700 text-white"
													: "border-line bg-surface text-ink-700 hover:border-primary-600",
											].join(" ")}
										>
											{formatTime(slot)}
										</button>
									))}
								</div>
							)}
						</div>

						<div className="mt-6 flex justify-end">
							<Button
								disabled={!selectedSlot}
								onClick={() => setStep(3)}
								icon="ArrowRight"
							>
								Review booking
							</Button>
						</div>
					</div>
				)}

				{/* ── Step 3: Confirm ─────────────────────────────────────── */}
				{step === 3 && (
					<div>
						<button
							type="button"
							onClick={() => setStep(2)}
							className="bg-transparent border-none font-sans text-sm text-ink-500 cursor-pointer p-0 mb-5 flex items-center gap-1"
						>
							<ArrowLeft size={14} /> Change time
						</button>

						<div className="bg-surface rounded-xl border border-line p-6 mb-6">
							<h3 className="m-0 mb-4 font-serif font-normal text-xl text-ink-900">
								Booking summary
							</h3>
							<div className="flex flex-col gap-3 text-sm font-sans">
								<div className="flex justify-between">
									<span className="text-ink-500">Business</span>
									<span className="font-semibold text-ink-900">
										{business?.name}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-ink-500">Branch</span>
									<span className="font-semibold text-ink-900">
										{activeBranch?.name}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-ink-500">Service</span>
									<span className="font-semibold text-ink-900">
										{selectedService?.name}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-ink-500">Date</span>
									<span className="font-semibold text-ink-900">
										{selectedSlot ? formatDate(selectedSlot) : "—"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-ink-500">Time</span>
									<span className="font-semibold text-ink-900">
										{selectedSlot ? formatTime(selectedSlot) : "—"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-ink-500">Duration</span>
									<span className="font-semibold text-ink-900">
										{selectedService?.duration} min
									</span>
								</div>
								<div className="h-px bg-line my-1" />
								{couponResult?.valid && couponResult.discount != null && (
									<div className="flex justify-between">
										<span className="text-ink-500">Discount</span>
										<span className="font-semibold text-success-fg">
											-৳{couponResult.discount}
										</span>
									</div>
								)}
								<div className="flex justify-between text-base">
									<span className="font-semibold text-ink-900">Total</span>
									<span className="font-bold text-ink-900">
										৳
										{couponResult?.valid && couponResult.discount != null
											? (selectedService?.price ?? 0) - couponResult.discount
											: selectedService?.price}
									</span>
								</div>
							</div>
						</div>

						{/* Coupon */}
						<div className="mb-6">
							<label className="font-sans text-sm font-semibold text-ink-700 block mb-2">
								Have a promo code?
							</label>
							<div className="flex gap-2">
								<input
									type="text"
									value={couponCode}
									onChange={(e) => {
										setCouponCode(e.target.value.toUpperCase());
										setCouponResult(null);
									}}
									placeholder="e.g. WELCOME20"
									className="flex-1 px-3 py-2.5 border border-line rounded-md font-mono text-sm text-ink-900 bg-surface outline-none focus:border-primary-600 uppercase"
								/>
								<Button
									variant="ghost"
									onClick={() => {
										if (couponCode.trim())
											validateCoupon.mutate(couponCode.trim());
									}}
									disabled={!couponCode.trim() || validateCoupon.isPending}
								>
									{validateCoupon.isPending ? "Checking…" : "Apply"}
								</Button>
							</div>
							{couponResult && !couponResult.valid && (
								<p className="font-sans text-xs text-danger-fg mt-1.5">
									{couponResult.message ?? "Invalid coupon code."}
								</p>
							)}
							{couponResult?.valid && (
								<p className="font-sans text-xs text-success-fg mt-1.5 font-semibold">
									✓ Coupon applied
									{couponResult.coupon?.type === "Percentage"
										? ` — ${couponResult.coupon.value}% off`
										: couponResult.discount != null
											? ` — ৳${couponResult.discount} off`
											: ""}
								</p>
							)}
						</div>

						{createBooking.isError && (
							<p className="text-danger text-sm mb-4">
								{(createBooking.error as Error).message}
							</p>
						)}

						<div className="flex gap-3">
							<Button
								variant="dark"
								size="lg"
								disabled={createBooking.isPending}
								onClick={() => createBooking.mutate()}
							>
								{createBooking.isPending ? "Confirming…" : "Confirm booking"}
							</Button>
							<Button
								variant="ghost"
								size="lg"
								onClick={() => {
									setStep(1);
									setCouponCode("");
									setCouponResult(null);
								}}
							>
								Start over
							</Button>
						</div>
					</div>
				)}
			</main>
			<Footer />
		</BrandThemeBoundary>
	);
}
