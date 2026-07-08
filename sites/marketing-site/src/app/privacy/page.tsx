import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
	title: "Privacy Policy",
	description:
		"How Talash collects, uses, and protects your personal information.",
};

const LAST_UPDATED = "June 2025";

export default function PrivacyPage() {
	return (
		<>
			<Nav />
			<main className="max-w-[760px] mx-auto px-4 md:px-8 py-16">
				<p className="font-sans text-sm text-ink-400 mb-3">
					Last updated: {LAST_UPDATED}
				</p>
				<h1 className="m-0 mb-8 font-serif font-normal text-4xl text-ink-900">
					Privacy Policy
				</h1>

				<div className="font-sans text-base text-ink-700 leading-relaxed space-y-8">
					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							1. Information We Collect
						</h2>
						<p>
							We collect information you provide directly (name, email, phone
							number when you register or book), information generated through
							your use of the Platform (booking history, search queries, device
							and browser data), and information from third-party sign-in
							providers (Google).
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							2. How We Use Your Information
						</h2>
						<p>
							We use your information to: (a) provide, operate, and improve the
							Platform; (b) process bookings and send confirmations; (c) send
							service-related communications and, where you have opted in,
							promotional messages; (d) detect and prevent fraud; (e) comply
							with legal obligations.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							3. Sharing Your Information
						</h2>
						<p>
							We share your information with the Business you book with (so they
							can prepare your appointment), service providers who help us
							operate the Platform (hosting, email, analytics), and authorities
							when required by law. We do not sell your personal data.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							4. Cookies and Tracking
						</h2>
						<p>
							We use cookies and similar technologies for authentication,
							preferences, and analytics. You can manage cookie preferences
							through your browser settings. Some features may not function if
							cookies are disabled.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							5. Data Retention
						</h2>
						<p>
							We retain your personal data for as long as your account is active
							or as needed to provide services. You may request deletion of your
							account and associated data at any time by contacting us. We may
							retain certain data to comply with legal obligations.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							6. Your Rights
						</h2>
						<p>
							Depending on your location, you may have the right to access,
							correct, or delete your personal data, object to processing, and
							withdraw consent. To exercise these rights, contact us at{" "}
							<a
								href="mailto:privacy@talash.bd"
								className="text-primary-700 underline"
							>
								privacy@talash.bd
							</a>
							.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							7. Security
						</h2>
						<p>
							We implement industry-standard technical and organisational
							measures to protect your data. However, no transmission over the
							Internet is completely secure, and we cannot guarantee absolute
							security.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							8. Children's Privacy
						</h2>
						<p>
							The Platform is not directed at children under 13. We do not
							knowingly collect personal data from children. If you believe we
							have inadvertently collected such data, please contact us
							immediately.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							9. Changes to This Policy
						</h2>
						<p>
							We may update this Privacy Policy periodically. We will post the
							updated policy on this page with a new "Last updated" date and
							notify registered users by email of material changes.
						</p>
					</section>

					<section>
						<h2 className="font-serif font-normal text-2xl text-ink-900 mb-3">
							10. Contact
						</h2>
						<p>
							Questions about this Privacy Policy? Email{" "}
							<a
								href="mailto:privacy@talash.bd"
								className="text-primary-700 underline"
							>
								privacy@talash.bd
							</a>{" "}
							or see our{" "}
							<Link href="/terms" className="text-primary-700 underline">
								Terms of Service
							</Link>
							.
						</p>
					</section>
				</div>
			</main>
			<Footer />
		</>
	);
}
