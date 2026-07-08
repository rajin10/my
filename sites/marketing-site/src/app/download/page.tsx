import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import {
	APP_STORE_URL,
	hasAppStoreLink,
	hasPlayStoreLink,
	PLAY_STORE_URL,
} from "@/lib/app-links";

export const metadata: Metadata = {
	title: "Get the Talash app",
	description:
		"Download the Talash app to discover businesses, book services, and manage your appointments on the go.",
};

export default function DownloadPage() {
	const play = hasPlayStoreLink();
	const ios = hasAppStoreLink();

	return (
		<>
			<Nav />
			<main className="max-w-[640px] mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
				<div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
					<Smartphone size={32} className="text-primary-700" />
				</div>
				<h1 className="m-0 font-serif font-normal text-4xl tracking-tight text-ink-900 mb-4">
					Get the Talash app
				</h1>
				<p className="m-0 font-sans text-base leading-relaxed text-ink-600 mb-10">
					Book salons, spas, and studios from your phone. Earn rewards, save
					favourites, and get reminders when your appointment is confirmed.
				</p>
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					{play && (
						<a
							href={PLAY_STORE_URL}
							className="no-underline"
							rel="noopener noreferrer"
						>
							<Button size="lg" icon="Smartphone">
								Google Play
							</Button>
						</a>
					)}
					{ios && (
						<a
							href={APP_STORE_URL}
							className="no-underline"
							rel="noopener noreferrer"
						>
							<Button size="lg" variant="ghost" icon="Smartphone">
								App Store
							</Button>
						</a>
					)}
					{!play && !ios && (
						<p className="font-sans text-sm text-ink-500 m-0">
							The app is coming soon to app stores. You can still book on the
							web.
						</p>
					)}
				</div>
				<p className="mt-10 font-sans text-sm text-ink-500">
					Prefer the browser?{" "}
					<Link
						href="/search"
						className="text-primary-700 font-semibold no-underline"
					>
						Search businesses on the web
					</Link>
				</p>
			</main>
			<Footer />
		</>
	);
}
