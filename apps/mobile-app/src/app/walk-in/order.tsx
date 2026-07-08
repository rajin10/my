import { useLocalSearchParams } from "expo-router";
import WalkInOrderScreen from "@/components/screens/WalkInOrderScreen";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useWalkInContext } from "@/hooks/useWalkIn";

export default function WalkInOrderRoute() {
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
		data?.vertical === "commerce" ? (data.brandPalette ?? null) : null;

	return (
		<ThemeProvider palette={palette}>
			<WalkInOrderScreen />
		</ThemeProvider>
	);
}
