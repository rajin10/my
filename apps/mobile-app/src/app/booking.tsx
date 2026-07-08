import BookingScreen from "@/components/screens/BookingScreen";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useApp } from "@/context";

export default function BookingRoute() {
	const { pendingBooking } = useApp();
	if (!pendingBooking) return null;
	// The booking flow is a sibling route of /business, so it needs its own reskin
	// boundary (#60): theme it to the venue being booked. null → Talash defaults.
	return (
		<ThemeProvider palette={pendingBooking.business.brandPalette ?? null}>
			<BookingScreen />
		</ThemeProvider>
	);
}
