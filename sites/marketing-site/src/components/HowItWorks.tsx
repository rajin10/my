import { CalendarCheck, Search, Sparkles } from "lucide-react";

const steps = [
	{
		icon: Search,
		n: "01",
		title: "Search",
		body: "Find services by type, business, or neighbourhood — and see real ratings and photos.",
	},
	{
		icon: CalendarCheck,
		n: "02",
		title: "Book",
		body: "Pick a branch, date and time, apply a coupon, and confirm in seconds.",
	},
	{
		icon: Sparkles,
		n: "03",
		title: "Unwind",
		body: "Show up and enjoy. Earn loyalty points automatically every time a business confirms.",
	},
];

export function HowItWorks() {
	return (
		<section
			id="how-it-works"
			className="bg-cream border-t border-b border-cream-deep scroll-mt-24"
		>
			<div className="max-w-[1200px] mx-auto px-4 md:px-8 py-14 md:py-20">
				<div className="text-center mb-10 md:mb-12">
					<div className="t-eyebrow mb-3">How Talash works</div>
					<h2 className="m-0 font-serif font-normal text-3xl md:text-5xl leading-tight tracking-tight text-ink-900">
						Three steps to your next appointment
					</h2>
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-7">
					{steps.map((s) => {
						const IconComp = s.icon;
						return (
							<div
								key={s.n}
								className="relative p-8 bg-surface rounded-xl border border-line shadow-sm"
							>
								<div className="flex items-center justify-between">
									<span className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center">
										<IconComp size={26} className="text-primary-600" />
									</span>
									<span className="font-serif italic text-3xl text-gold-500">
										{s.n}
									</span>
								</div>
								<h3 className="mt-5 mb-0 font-serif font-medium text-2xl leading-snug text-ink-900">
									{s.title}
								</h3>
								<p className="mt-2.5 mb-0 font-sans text-base leading-relaxed text-ink-600">
									{s.body}
								</p>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
