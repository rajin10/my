import Link from "next/link";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export default function NotFound() {
	return (
		<>
			<Nav />
			<main className="max-w-[640px] mx-auto px-4 md:px-8 py-20 md:py-28 text-center">
				<p className="t-eyebrow mb-3">404</p>
				<h1 className="m-0 font-serif font-normal text-4xl tracking-tight text-ink-900 mb-4">
					Page not found
				</h1>
				<p className="m-0 font-sans text-base text-ink-500 mb-8">
					The page you are looking for may have moved or no longer exists.
				</p>
				<Link href="/" className="no-underline">
					<Button icon="ArrowLeft">Back to home</Button>
				</Link>
			</main>
			<Footer />
		</>
	);
}
