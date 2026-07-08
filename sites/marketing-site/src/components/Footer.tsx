import { Camera, Send, ThumbsUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PLAY_STORE_URL } from "@/lib/app-links";
import { APP_VERSION } from "@/lib/version";

const discoverLinks = [
	{ label: "Search businesses", href: "/search" },
	{ label: "Hair & barber", href: "/search?category=Hair%20%26%20barber" },
	{ label: "Spa & massage", href: "/search?category=Spa%20%26%20massage" },
	{ label: "Fitness & yoga", href: "/search?category=Fitness%20%26%20yoga" },
];

const companyLinks = [
	{ label: "How it works", href: "/#how-it-works" },
	{ label: "Get the app", href: "/download" },
	{ label: "Privacy", href: "/privacy" },
	{ label: "Terms", href: "/terms" },
];

const businessLinks = [
	{ label: "List your business", href: "/for-business" },
	{ label: "Owner dashboard", href: "https://business.talash.bd" },
	{ label: "Book a demo", href: "/for-business" },
];

const socials = [Camera, Send, ThumbsUp];

export function Footer() {
	return (
		<footer className="bg-primary-950 text-white">
			<div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-12 md:pt-18 pb-10 grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 md:gap-10">
				<div className="col-span-2 md:col-span-1">
					<div className="flex items-center gap-2.5 mb-4">
						<Image src="/talash-mark-light.svg" width={30} height={30} alt="" />
						<span className="font-serif text-2xl font-semibold tracking-tight">
							Talash
						</span>
					</div>
					<p className="m-0 font-sans text-sm leading-relaxed text-primary-200 max-w-[280px]">
						The considered way to discover and book the services you love.
					</p>
					<div className="flex gap-3 mt-5">
						{socials.map((Icon, i) => (
							<span
								key={i}
								className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-primary-200"
								aria-hidden
							>
								<Icon size={18} />
							</span>
						))}
					</div>
					<a
						href={PLAY_STORE_URL}
						className="inline-block mt-5 font-sans text-sm font-semibold text-gold-300 no-underline hover:text-white"
						rel="noopener noreferrer"
					>
						Download on Google Play
					</a>
				</div>
				<FooterCol heading="Discover" items={discoverLinks} />
				<FooterCol heading="Company" items={companyLinks} />
				<FooterCol heading="For business" items={businessLinks} external />
			</div>
			<div className="border-t border-white/10">
				<div className="max-w-[1200px] mx-auto px-4 md:px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-3 font-sans text-sm text-primary-300">
					<span>© 2026 Talash. All rights reserved.</span>
					<div className="flex gap-6 items-center">
						<span className="text-primary-400">v{APP_VERSION}</span>
						<Link href="/privacy" className="text-primary-300 no-underline">
							Privacy
						</Link>
						<Link href="/terms" className="text-primary-300 no-underline">
							Terms
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}

function FooterCol({
	heading,
	items,
	external,
}: {
	heading: string;
	items: { label: string; href: string }[];
	external?: boolean;
}) {
	return (
		<div>
			<div className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-primary-300 mb-4">
				{heading}
			</div>
			<div className="flex flex-col gap-3">
				{items.map((it) =>
					external && it.href.startsWith("http") ? (
						<a
							key={it.label}
							href={it.href}
							className="no-underline font-sans text-sm text-primary-100"
							rel="noopener noreferrer"
						>
							{it.label}
						</a>
					) : (
						<Link
							key={it.label}
							href={it.href}
							className="no-underline font-sans text-sm text-primary-100"
						>
							{it.label}
						</Link>
					),
				)}
			</div>
		</div>
	);
}
