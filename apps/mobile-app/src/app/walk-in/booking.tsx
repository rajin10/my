import { useLocalSearchParams } from "expo-router";
import WalkInBookingScreen from "@/components/screens/WalkInBookingScreen";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useWalkInContext } from "@/hooks/useWalkIn";

export default function WalkInBookingRoute() {
	const params = useLocalSearchParams<{
		branchId: string;
		session?: string;
		signature?: string;
	}>();

	const { data } = useWalkInContext(
		params.branchId
			? {
					branchId: params.branchId,
					session: params.session,
					signature: params.signature,
				}
			: undefined,
	);

	const palette =
		data?.vertical === "booking" ? (data.brandPalette ?? null) : null;

	return (
		<ThemeProvider palette={palette}>
			<WalkInBookingScreen />
		</ThemeProvider>
	);
}
