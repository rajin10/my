import { useNetworkStatus } from "@repo/mobile-query";
import { useLanFallbackEligible, WalkInLanBanner } from "@repo/walk-in-sync";
import { usePathname } from "expo-router";

/** Amber on shop LAN without internet; red when fully offline during walk-in. */
export function WalkInConnectivityBanner() {
	const pathname = usePathname();
	const lanEligible = useLanFallbackEligible();
	const { isOnline } = useNetworkStatus();

	if (!pathname.startsWith("/walk-in")) return null;
	if (isOnline) return null;

	if (lanEligible) {
		return (
			<WalkInLanBanner message="Connected to shop · no internet" tone="lan" />
		);
	}

	return (
		<WalkInLanBanner
			message="No connection — connect to shop Wi‑Fi or use mobile data"
			tone="offline"
		/>
	);
}
