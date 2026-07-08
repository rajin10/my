import {
	Building2,
	CalendarCheck,
	type LucideIcon,
	Sparkles,
	Star,
	Ticket,
	Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { TONES } from "@/components/data";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Photo } from "@/components/Photo";
import { DemoRequestButton } from "./DemoRequestButton";

export const metadata: Metadata = {
	title: "Talash for Business — Reach more customers",
	description:
		"List your salon, spa or studio on Talash and start taking bookings today.",
};

const FEATURES: {
	icon: LucideIcon;
	title: string;
	body: string;
}[] = [
	{
		icon: CalendarCheck,
		title: "Bookings & calendar",
		body: "Real-time availability, instant confirmations, and automated reminders — so you can focus on your craft.",
	},
	{
		icon: Building2,
		title: "Multi-branch support",
		body: "Manage all your locations from one dashboard. Each branch has its own staff, services, and schedule.",
	},
	{
		icon: Sparkles,
		title: "Service menu",
		body: "Build your full service catalogue with durations, pricing, and photos. Customers see exactly what to expect.",
	},
	{
		icon: Users,
		title: "Team management",
		body: "Add staff, assign roles, and track performance across every branch without a spreadsheet in sight.",
	},
	{
		icon: Star,
		title: "Reviews & reputation",
		body: "Collect verified reviews from real bookings and build social proof that converts browsers into customers.",
	},
	{
		icon: Ticket,
		title: "Coupons & rewards",
		body: "Run promotions, reward loyal customers, and drive repeat visits — all from within the dashboard.",
	},
];

const STEPS = [
	{
		n: 1,
		title: "Create your profile",
		body: "Sign up and add your business details, branches, and services in minutes.",
	},
	{
		n: 2,
		title: "Go live",
		body: "Your business becomes discoverable to thousands of customers actively searching for what you offer.",
	},
	{
		n: 3,
		title: "Grow your business",
		body: "Manage bookings, collect reviews, and run promotions from one place.",
	},
];

export default function ForBusinessPage() {
	return (
		<>
			<Nav />
			<main>
				{/* Hero */}
				<section className="max-w-[1200px] mx-auto px-4 md:px-8 pt-12 md:pt-18 pb-14 md:pb-20 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
					<div>
						<div className="t-eyebrow mb-4 text-gold-600">For business</div>
						<h1 className="m-0 font-serif font-normal text-4xl sm:text-5xl md:text-6xl leading-tight tracking-tight text-ink-900">
							Fill your calendar,
							<br />
							<span className="text-primary-700">every week.</span>
						</h1>
						<p className="mt-5 mb-0 font-sans text-base md:text-lg leading-relaxed text-ink-600 max-w-[460px]">
							Talash connects salons, spas, and studios with customers actively
							looking to book — and gives you the tools to run your business
							without the admin overhead.
						</p>
						<div className="flex flex-wrap gap-3 md:gap-3.5 mt-8 md:mt-9">
							<Link href="https://business.mahannankhan.info" className="no-underline">
								<Button variant="dark" size="lg" icon="ArrowRight">
									Start for free
								</Button>
							</Link>
							<DemoRequestButton />
						</div>
						<p className="mt-4 mb-0 font-sans text-sm text-ink-400">
							No credit card required · Set up in under 10 minutes
						</p>
					</div>
					<div className="hidden lg:block">
						<Photo
							tone={TONES.forest}
							height={440}
							radius="var(--radius-xl)"
							className="shadow-xl"
						/>
					</div>
				</section>

				{/* Features grid */}
				<section className="bg-surface border-t border-b border-line py-14 md:py-18">
					<div className="max-w-[1200px] mx-auto px-4 md:px-8">
						<div className="t-eyebrow text-center mb-3.5">
							Everything you need
						</div>
						<h2 className="m-0 mb-10 md:mb-12 text-center font-serif font-normal text-3xl md:text-[42px] tracking-tight text-ink-900">
							One dashboard. Total control.
						</h2>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
							{FEATURES.map((f) => {
								const Icon = f.icon;
								return (
									<div
										key={f.title}
										className="p-7 bg-paper rounded-lg border border-line"
									>
										<div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mb-4">
											<Icon size={24} className="text-primary-700" />
										</div>
										<h3 className="m-0 mb-2.5 font-serif font-medium text-xl text-ink-900">
											{f.title}
										</h3>
										<p className="m-0 font-sans text-sm leading-relaxed text-ink-600">
											{f.body}
										</p>
									</div>
								);
							})}
						</div>
					</div>
				</section>

				{/* How it works */}
				<section className="max-w-[1200px] mx-auto px-4 md:px-8 py-14 md:py-20">
					<div className="t-eyebrow text-center mb-3.5">Getting started</div>
					<h2 className="m-0 mb-10 md:mb-12 text-center font-serif font-normal text-3xl md:text-[42px] tracking-tight text-ink-900">
						Up and running in minutes
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-10">
						{STEPS.map((s) => (
							<div key={s.n} className="text-center">
								<div className="w-12 h-12 rounded-full bg-primary-900 text-white font-serif text-2xl font-medium flex items-center justify-center mx-auto mb-5">
									{s.n}
								</div>
								<h3 className="m-0 mb-2.5 font-serif font-medium text-xl text-ink-900">
									{s.title}
								</h3>
								<p className="m-0 font-sans text-sm leading-relaxed text-ink-600">
									{s.body}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* CTA */}
				<section className="bg-primary-900 px-4 md:px-8 py-14 md:py-18 text-center">
					<h2 className="m-0 mb-3.5 font-serif font-normal text-3xl md:text-5xl tracking-tight text-white">
						Ready to grow?
					</h2>
					<p className="m-0 mx-auto mb-9 font-sans text-lg leading-relaxed text-primary-200 max-w-[480px]">
						Join businesses across Bangladesh already using Talash to fill their
						calendars.
					</p>
					<Link href="https://business.mahannankhan.info" className="no-underline">
						<Button variant="light" size="lg" icon="ArrowRight">
							List your business — it's free
						</Button>
					</Link>
				</section>
			</main>
			<Footer />
		</>
	);
}
