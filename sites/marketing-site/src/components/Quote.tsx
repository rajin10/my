import { Quote as QuoteIcon } from "lucide-react";

export function Quote() {
	return (
		<section className="bg-primary-900 text-white relative overflow-hidden">
			<div className="absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full bg-[radial-gradient(circle,rgba(201,160,99,0.18),transparent_70%)]" />
			<div className="max-w-[920px] mx-auto px-8 py-24 text-center relative">
				<QuoteIcon size={40} className="text-gold-300 mx-auto mb-5" />
				<blockquote className="m-0 font-serif font-normal text-4xl leading-snug tracking-tight">
					I found a spa two streets away I never knew existed, booked it on my
					lunch break, and earned points doing it.{" "}
					<span className="italic text-primary-300">
						Talash just gets out of the way.
					</span>
				</blockquote>
				<div className="mt-7 flex items-center justify-center gap-3">
					<div className="w-11 h-11 rounded-full bg-primary-700 flex items-center justify-center font-serif text-lg text-primary-200">
						R
					</div>
					<div className="text-left">
						<div className="text-base font-semibold">Riya Menon</div>
						<div className="text-sm text-primary-300">
							Talash member · Dhaka
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
