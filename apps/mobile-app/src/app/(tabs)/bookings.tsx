import { StyleSheet, View } from "react-native";
import BookingDetailSheet from "@/components/BookingDetailSheet";
import ReviewSheet from "@/components/ReviewSheet";
import BookingsScreen from "@/components/screens/BookingsScreen";
import { useApp } from "@/context";

export default function BookingsTab() {
	const { modal } = useApp();
	return (
		<View className="flex-1">
			<BookingsScreen />
			{modal?.type === "review" && (
				<View style={StyleSheet.absoluteFill}>
					<ReviewSheet booking={modal.booking} />
				</View>
			)}
			{modal?.type === "bookingDetail" && (
				<View style={StyleSheet.absoluteFill}>
					<BookingDetailSheet booking={modal.booking} />
				</View>
			)}
		</View>
	);
}
