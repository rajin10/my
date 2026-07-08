import { router } from "expo-router";
import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import type { ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import { Colors, Radius } from "../../tokens";
import { StatusPill } from "../ui";

function DetailRow({
	icon,
	label,
	last,
}: {
	icon: keyof typeof Icons;
	label: string;
	last?: boolean;
}) {
	const Comp = (Icons as Record<string, ComponentType<LucideProps>>)[icon];
	return (
		<View
			className="flex-row items-center"
			style={{
				gap: 12,
				paddingVertical: 10,
				borderBottomWidth: last ? 0 : 1,
				borderBottomColor: "rgba(255,255,255,0.1)",
			}}
		>
			{Comp && <Comp size={18} color={Colors.primary300} strokeWidth={1.75} />}
			<Text className="text-white" style={{ fontSize: 15 }}>
				{label}
			</Text>
		</View>
	);
}

export default function ConfirmScreen() {
	const { confirmedBooking } = useApp();
	const insets = useSafeAreaInsets();

	if (!confirmedBooking) {
		router.replace("/(tabs)/bookings");
		return null;
	}
	const booking = confirmedBooking;

	return (
		<View className="flex-1 bg-primary-900">
			<View className="flex-1 items-center justify-center px-8">
				<View
					className="items-center justify-center border"
					style={{
						width: 76,
						height: 76,
						borderRadius: 38,
						backgroundColor: "rgba(255,255,255,0.1)",
						borderColor: "rgba(255,255,255,0.18)",
					}}
				>
					<Icons.Check size={36} color={Colors.primary200} strokeWidth={2} />
				</View>

				<Text
					className="text-white text-center"
					style={{
						marginTop: 26,
						fontSize: 32,
						fontWeight: "400",
						lineHeight: 37,
					}}
				>
					You're booked in.
				</Text>
				<Text
					className="text-primary-200 text-center"
					style={{ marginTop: 12, fontSize: 15.5, lineHeight: 25 }}
				>
					We've sent your request to {booking.business.name}. You'll be notified
					the moment they confirm.
				</Text>
				<View className="mt-5">
					<StatusPill status="Pending" />
				</View>

				<View
					className="w-full border"
					style={{
						marginTop: 30,
						backgroundColor: "rgba(255,255,255,0.06)",
						borderRadius: Radius.lg,
						borderColor: "rgba(255,255,255,0.12)",
						padding: 18,
					}}
				>
					<DetailRow icon="Scissors" label={booking.service.name} />
					<DetailRow
						icon="Calendar"
						label={`${booking.day.label || `${booking.day.wd} ${booking.day.n}`} · ${booking.slot}`}
					/>
					<DetailRow
						icon="MapPin"
						label={`${booking.branch.name} — ${booking.branch.city}`}
					/>
					<DetailRow
						icon={
							booking.payment
								? (booking.payment.icon as keyof typeof Icons)
								: "Wallet"
						}
						label={
							booking.payment
								? booking.payment.kind === "cash"
									? booking.payment.label
									: `${booking.payment.label} · ${booking.payment.detail}`
								: "Pay at business"
						}
						last
					/>
				</View>
			</View>

			<View
				className="px-6 gap-[10px]"
				style={{ paddingBottom: insets.bottom + 16 }}
			>
				<TouchableOpacity
					onPress={() => router.replace("/(tabs)/bookings")}
					className="items-center bg-white rounded-md"
					style={{ padding: 16 }}
				>
					<Text className="text-primary-900 font-bold" style={{ fontSize: 16 }}>
						View my bookings
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() => router.replace("/(tabs)")}
					className="items-center rounded-md"
					style={{ padding: 14 }}
				>
					<Text
						className="text-primary-200 font-semibold"
						style={{ fontSize: 15 }}
					>
						Back to search
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
