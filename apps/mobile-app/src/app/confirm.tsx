import ConfirmScreen from "@/components/screens/ConfirmScreen";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useApp } from "@/context";

export default function ConfirmRoute() {
	const { confirmedBooking } = useApp();
	if (!confirmedBooking) return null;
	// Confirmation is a sibling route too — keep the venue reskin through to the
	// end of the booking flow (#60). null → Talash defaults.
	return (
		<ThemeProvider palette={confirmedBooking.business.brandPalette ?? null}>
			<ConfirmScreen />
		</ThemeProvider>
	);
}
