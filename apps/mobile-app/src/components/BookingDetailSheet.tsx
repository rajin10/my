import { useQuery } from "@tanstack/react-query";
import type { LucideProps } from "lucide-react-native";
import * as Icons from "lucide-react-native";
import type { ComponentType } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context";
import type { Booking } from "../data";
import { api } from "../lib/api";
import { formatMoney } from "../lib/format";
import { Colors } from "../tokens";
import { Button, StatusPill } from "./ui";

export default function BookingDetailSheet({
	booking: b,
}: {
	booking: Booking;
}) {
	// Background refresh — keeps status fresh after push notifications or time passing.
	const freshQuery = useQuery({
		queryKey: ["booking", b.id],
		queryFn: () => api.bookings.get(b.id),
		staleTime: 0,
	});
	// `bookings.get` returns a SingleResponse envelope — read `.data.status`.
	const status = (freshQuery.data?.data?.status ??
		b.status) as Booking["status"];

	const { setModal, cancelBooking, openBusiness, reviewed } = useApp();
	const insets = useSafeAreaInsets();

	const canCancel = status === "Confirmed" || status === "Pending";
	const canReview = status === "Completed" && !reviewed.has(b.id);

	return (
		<View className="absolute inset-0 justify-end" style={{ zIndex: 70 }}>
			<TouchableOpacity
				className="absolute inset-0 bg-[rgba(8,54,44,0.40)]"
				onPress={() => setModal(null)}
				activeOpacity={1}
			/>
			<View
				className="bg-surface rounded-tl-xl rounded-tr-xl"
				style={[
					{
						paddingHorizontal: 20,
						paddingTop: 20,
						paddingBottom: insets.bottom + 28,
					},
					{
						shadowColor: "#08362C",
						shadowOffset: { width: 0, height: -4 },
						shadowOpacity: 0.12,
						shadowRadius: 24,
						elevation: 12,
					},
				]}
			>
				<View
					className="self-center bg-line-strong"
					style={{ width: 40, height: 4, borderRadius: 2, marginBottom: 18 }}
				/>

				{/* Header */}
				<View
					className="flex-row items-start justify-between"
					style={{ marginBottom: 16 }}
				>
					<View className="flex-1 min-w-0 mr-3">
						<Text
							style={{
								fontSize: 11.5,
								fontWeight: "700",
								color: Colors.primary600,
								letterSpacing: 1.5,
								textTransform: "uppercase",
								marginBottom: 4,
							}}
						>
							{b.service.name}
						</Text>
						<Text
							style={{
								fontSize: 22,
								fontWeight: "400",
								letterSpacing: -0.3,
								color: Colors.ink900,
								lineHeight: 27,
							}}
						>
							{b.business.name}
						</Text>
					</View>
					<StatusPill status={status} />
				</View>

				{/* Details grid */}
				<View
					className="bg-paper rounded-lg"
					style={{
						padding: 16,
						gap: 12,
						marginBottom: 16,
						borderWidth: 1,
						borderColor: Colors.line,
					}}
				>
					<Row
						icon="Calendar"
						label="Date"
						value={b.day.label ?? `${b.day.wd} ${b.day.n}`}
					/>
					<Row icon="Clock" label="Time" value={b.slot} />
					{b.branch.address && (
						<Row
							icon="MapPin"
							label="Branch"
							value={`${b.branch.name}${b.branch.address ? ` · ${b.branch.address}` : ""}`}
						/>
					)}
					<Row icon="CreditCard" label="Total" value={formatMoney(b.total)} />
					{b.discount > 0 && (
						<Row
							icon="Tag"
							label="Discount"
							value={`-${formatMoney(b.discount)}${b.coupon ? ` (${b.coupon})` : ""}`}
							accent={Colors.primary700}
						/>
					)}
				</View>

				{/* Actions */}
				<View style={{ gap: 10 }}>
					{canReview && (
						<Button
							full
							onPress={() => setModal({ type: "review", booking: b })}
						>
							Leave a review
						</Button>
					)}
					<Button
						variant="subtle"
						full
						onPress={() => {
							setModal(null);
							openBusiness(b.business);
						}}
					>
						View business
					</Button>
					{canCancel && (
						<Button
							variant="ghost"
							full
							onPress={() => {
								Alert.alert(
									"Cancel booking",
									"Are you sure you want to cancel this booking?",
									[
										{ text: "Keep", style: "cancel" },
										{
											text: "Cancel booking",
											style: "destructive",
											onPress: () => {
												setModal(null);
												cancelBooking(b.id);
											},
										},
									],
								);
							}}
						>
							Cancel booking
						</Button>
					)}
				</View>
			</View>
		</View>
	);
}

function Row({
	icon,
	label,
	value,
	accent,
}: {
	icon: keyof typeof Icons;
	label: string;
	value: string;
	accent?: string;
}) {
	const LucideIcon = (Icons as Record<string, ComponentType<LucideProps>>)[
		icon
	];
	return (
		<View className="flex-row items-center" style={{ gap: 10 }}>
			<LucideIcon size={15} color={Colors.ink400} strokeWidth={1.75} />
			<Text style={{ width: 60, fontSize: 13, color: Colors.ink500 }}>
				{label}
			</Text>
			<Text
				style={{
					flex: 1,
					fontSize: 13.5,
					fontWeight: "600",
					color: accent ?? Colors.ink900,
				}}
				numberOfLines={1}
			>
				{value}
			</Text>
		</View>
	);
}
