import { Calendar, Star, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "./Button";
import { TONES } from "./data";
import { Photo } from "./Photo";

const features = [
	{ label: "Bookings & calendar", icon: Calendar },
	{ label: "Team & branches", icon: Users },
	{ label: "Reviews & loyalty", icon: Star },
];

export function BusinessBanner() {
	return (
		<section className="max-w-[1200px] mx-auto px-4 md:px-8 py-14 md:py-20">
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center bg-surface rounded-xl border border-line shadow-md overflow-hidden">
				<div className="py-10 px-8 lg:py-12 lg:pl-12 lg:pr-0">
					<div className="t-eyebrow mb-3.5 text-gold-600">For business</div>
					<h2 className="m-0 font-serif font-normal text-[40px] leading-tight tracking-tight text-ink-900">
						Run a salon, spa or studio?
					</h2>
					<p className="mt-4 mb-0 font-sans text-lg leading-relaxed text-ink-600 max-w-[420px]">
						Manage your locations, services, team and bookings in one place —
						and reach customers actively searching for what you offer.
					</p>
					<div className="flex flex-wrap gap-5 md:gap-7 my-6">
						{features.map(({ label, icon: Icon }) => (
							<div
								key={label}
								className="flex items-center gap-2 text-sm text-ink-700 font-medium"
							>
								<Icon size={17} className="text-primary-600" />
								{label}
							</div>
						))}
					</div>
					<div className="flex gap-3">
						<Link href="/for-business" className="no-underline">
							<Button variant="dark" size="md" icon="ArrowRight">
								List your business
							</Button>
						</Link>
						<Link href="/for-business" className="no-underline">
							<Button variant="ghost" size="md">
								Learn more
							</Button>
						</Link>
					</div>
				</div>

				<div className="hidden lg:block relative h-[440px] p-6">
					<Photo tone={TONES.forest} height={392} className="shadow-lg" />
					<div className="absolute bottom-11 -left-1 bg-surface rounded-md shadow-lg p-3.5 px-4 w-[220px]">
						<div className="text-xs text-ink-400 font-semibold">This week</div>
						<div className="font-serif text-[34px] font-medium text-ink-900 mt-0.5">
							148{" "}
							<span className="text-base text-success-fg font-sans font-bold">
								bookings
							</span>
						</div>
						<div className="flex items-center gap-1.5 mt-1 text-sm text-success-fg">
							<TrendingUp size={15} />
							+22% vs last week
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
