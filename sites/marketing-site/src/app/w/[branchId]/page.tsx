import Link from "next/link";
import { MOBILE_DEEP_LINK_SCHEME } from "@/lib/app-links";

type Props = {
	params: Promise<{ branchId: string }>;
	searchParams: Promise<{ s?: string; sig?: string }>;
};

export default async function WalkInRedirectPage({
	params,
	searchParams,
}: Props) {
	const { branchId } = await params;
	const { s: session, sig: signature } = await searchParams;

	const query = new URLSearchParams({ branchId });
	if (session) query.set("session", session);
	if (signature) query.set("signature", signature);

	const deepLink = `${MOBILE_DEEP_LINK_SCHEME}walk-in?${query.toString()}`;
	const playStore =
		process.env.NEXT_PUBLIC_PLAY_STORE_URL ??
		"https://play.google.com/store/apps/details?id=talash.bd";

	return (
		<main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 px-6 py-16 text-center">
			<h1 className="font-serif text-2xl text-ink-900">Open in Talash</h1>
			<p className="text-sm text-ink-600">
				Scan or tap below to book or order at this shop in the Talash app.
			</p>
			<a
				href={deepLink}
				className="inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white"
			>
				Open app
			</a>
			<Link
				href={playStore}
				className="text-sm text-primary underline-offset-2 hover:underline"
			>
				Get the app on Google Play
			</Link>
		</main>
	);
}
