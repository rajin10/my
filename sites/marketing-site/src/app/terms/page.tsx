import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "Talash terms of service and conditions of use.",
};

const LAST_UPDATED = "June 2025";

export default function TermsPage() {
	return (
		<>
			<Nav />
			<main className="max-w-[760px] mx-auto px-4 md:px-8 py-16">
				<p className="font-sans text-sm text-ink-400 mb-3">
					Last updated: {LAST_UPDATED}
				</p>
				<h1 className="m-0 mb-8 font-serif font-normal text-4xl text-ink-900">
					Terms of Service
				</h1>

				<div className="font-sans text-base text-ink-700 leading-relaxed space-y-8">
					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							1. Acceptance of Terms
						</h2>
						<p>
							By accessing or using Talash ("the Platform"), you agree to be
							bound by these Terms of Service and our{" "}
							<Link href="/privacy" className="text-primary-700 underline">
								Privacy Policy
							</Link>
							. If you do not agree, please do not use the Platform.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							2. Description of Service
						</h2>
						<p>
							Talash is an online marketplace that connects customers with
							wellness and beauty service providers ("Businesses") in Bangladesh. We
							facilitate bookings but are not a party to the service agreement
							between you and the Business.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							3. User Accounts
						</h2>
						<p>
							You must provide accurate information when creating an account.
							You are responsible for maintaining the confidentiality of your
							account credentials and for all activity under your account.
							Notify us immediately of any unauthorised use.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							4. Bookings and Cancellations
						</h2>
						<p>
							When you make a booking through Talash, you enter into a direct
							agreement with the Business. Cancellation and refund policies are set
							by the individual Business and will be displayed before you confirm a
							booking. Talash is not responsible for Business cancellations or
							service quality.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							5. Prohibited Conduct
						</h2>
						<p>
							You agree not to: (a) use the Platform for any unlawful purpose;
							(b) submit false or misleading information; (c) attempt to gain
							unauthorised access to any part of the Platform; (d) post abusive,
							defamatory, or spam content in reviews.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							6. Intellectual Property
						</h2>
						<p>
							All content, trademarks, and software on the Platform are the
							property of Talash or its licensors. You may not reproduce,
							distribute, or create derivative works without our express written
							permission.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							7. Limitation of Liability
						</h2>
						<p>
							To the fullest extent permitted by law, Talash is not liable for
							any indirect, incidental, or consequential damages arising from
							your use of the Platform or services booked through it.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							8. Changes to Terms
						</h2>
						<p>
							We may update these Terms at any time. Continued use of the
							Platform after changes are posted constitutes acceptance of the
							revised Terms. We will notify registered users of material changes
							by email.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							9. Contact
						</h2>
						<p>
							Questions about these Terms? Email us at{" "}
							<a
								href="mailto:legal@mahannankhan.info"
								className="text-primary-700 underline"
							>
								legal@mahannankhan.info
							</a>
							.
						</p>
					</section>
				</div>
			</main>
			<Footer />
		</>
	);
}
