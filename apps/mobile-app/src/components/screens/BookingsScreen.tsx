import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as Icons from "lucide-react-native";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context";
import type { Booking } from "../../data";
import { t } from "../../lib/i18n";
import { Colors, Radius, Shadow } from "../../tokens";
import { ScreenContainer } from "../ScreenContainer";
import { SignInPrompt } from "../SignInPrompt";
import { toast } from "../Toast";
import { EmptyState, StatusPill } from "../ui";

function SwipeAction({ onPress }: { onPress: () => void }) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={{
				width: 80,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: Colors.dangerBg,
				borderRadius: Radius.lg,
				marginLeft: 8,
			}}
		>
			<Icons.X size={20} color={Colors.dangerFg} strokeWidth={2} />
			<Text
				style={{
					fontSize: 11.5,
					fontWeight: "700",
					color: Colors.dangerFg,
					marginTop: 3,
				}}
			>
				Cancel
			</Text>
		</TouchableOpacity>
	);
}

function BookingRow({
	b,
	onCancel,
}: {
	b: Booking;
	onCancel: (id: string) => void;
}) {
	const { reviewed, setModal } = useApp();
	const isReviewed = reviewed.has(b.id);

	function handleCancel() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		Alert.alert(
			"Cancel booking?",
			`Cancel your ${b.service.name} at ${b.business.name}?`,
			[
				{ text: "Keep it", style: "cancel" },
				{
					text: "Yes, cancel",
					style: "destructive",
					onPress: () => {
						onCancel(b.id);
						toast.show({ message: "Booking cancelled", tone: "info" });
					},
				},
			],
		);
	}

	const canCancel = b.status === "Confirmed" || b.status === "Pending";

	const card = (
		<View
			style={[
				{
					backgroundColor: Colors.surface,
					borderRadius: Radius.lg,
					borderWidth: 1,
					borderColor: Colors.line,
					overflow: "hidden",
				},
				Shadow.sm,
			]}
			accessible={false}
		>
			<TouchableOpacity
				onPress={() => {
					Haptics.selectionAsync();
					setModal({ type: "bookingDetail", booking: b });
				}}
				style={{ flexDirection: "row", gap: 14, padding: 14 }}
				activeOpacity={0.85}
				accessibilityRole="button"
				accessibilityLabel={`${b.service.name} at ${b.business.name}, ${b.day.label}, ${b.slot}`}
			>
				<View
					style={{
						width: 60,
						height: 60,
						borderRadius: Radius.md,
						backgroundColor: b.business.tone[1],
						overflow: "hidden",
					}}
				>
					<View
						style={[
							StyleSheet.absoluteFill,
							{ backgroundColor: b.business.tone[0], opacity: 0.6 },
						]}
					/>
				</View>
				<View style={{ flex: 1, minWidth: 0 }}>
					<View
						style={{
							flexDirection: "row",
							justifyContent: "space-between",
							alignItems: "flex-start",
							gap: 8,
						}}
					>
						<Text
							style={{
								fontSize: 15.5,
								fontWeight: "700",
								color: Colors.ink900,
								flex: 1,
							}}
						>
							{b.service.name}
						</Text>
						<StatusPill status={b.status} size="sm" />
					</View>
					<Text style={{ fontSize: 13.5, color: Colors.ink500, marginTop: 3 }}>
						{b.business.name}
					</Text>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 12,
							marginTop: 8,
						}}
					>
						<View
							style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
						>
							<Icons.Calendar
								size={13}
								color={Colors.ink600}
								strokeWidth={1.75}
							/>
							<Text style={{ fontSize: 13, color: Colors.ink600 }}>
								{b.day.label || `${b.day.wd} ${b.day.n}`}
							</Text>
						</View>
						<View
							style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
						>
							<Icons.Clock size={13} color={Colors.ink600} strokeWidth={1.75} />
							<Text style={{ fontSize: 13, color: Colors.ink600 }}>
								{b.slot}
							</Text>
						</View>
					</View>
				</View>
			</TouchableOpacity>

			{b.status === "Completed" && (
				<View
					style={{
						flexDirection: "row",
						borderTopWidth: 1,
						borderTopColor: Colors.lineSoft,
					}}
				>
					{isReviewed ? (
						<View
							style={{
								flex: 1,
								padding: 12,
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "center",
								gap: 6,
							}}
						>
							<Icons.Check size={15} color={Colors.success} strokeWidth={2} />
							<Text
								style={{
									fontSize: 14,
									fontWeight: "600",
									color: Colors.ink400,
								}}
							>
								Review submitted
							</Text>
						</View>
					) : (
						<TouchableOpacity
							onPress={() => {
								Haptics.selectionAsync();
								setModal({ type: "review", booking: b });
							}}
							style={{
								flex: 1,
								padding: 12,
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "center",
								gap: 6,
							}}
							accessibilityRole="button"
							accessibilityLabel="Leave a review"
						>
							<Icons.Star
								size={15}
								color={Colors.primary700}
								strokeWidth={1.75}
							/>
							<Text
								style={{
									fontSize: 14,
									fontWeight: "600",
									color: Colors.primary700,
								}}
							>
								Leave a review
							</Text>
						</TouchableOpacity>
					)}
				</View>
			)}
			{b.status === "Confirmed" && (
				<View style={{ borderTopWidth: 1, borderTopColor: Colors.lineSoft }}>
					<TouchableOpacity
						onPress={handleCancel}
						style={{ padding: 12, alignItems: "center" }}
						accessibilityRole="button"
						accessibilityLabel="Cancel booking"
					>
						<Text
							style={{
								fontSize: 14,
								fontWeight: "600",
								color: Colors.dangerFg,
							}}
						>
							Cancel booking
						</Text>
					</TouchableOpacity>
				</View>
			)}
			{b.status === "Pending" && (
				<View style={{ borderTopWidth: 1, borderTopColor: Colors.lineSoft }}>
					<TouchableOpacity
						onPress={handleCancel}
						style={{ padding: 12, alignItems: "center" }}
						accessibilityRole="button"
						accessibilityLabel="Cancel booking"
					>
						<Text
							style={{
								fontSize: 14,
								fontWeight: "600",
								color: Colors.dangerFg,
							}}
						>
							Cancel booking
						</Text>
					</TouchableOpacity>
				</View>
			)}
		</View>
	);

	if (canCancel) {
		return (
			<Swipeable
				renderRightActions={() => <SwipeAction onPress={handleCancel} />}
				rightThreshold={60}
				friction={2}
				overshootRight={false}
			>
				{card}
			</Swipeable>
		);
	}
	return card;
}

export default function BookingsScreen() {
	const {
		bookings,
		cancelBooking,
		fetchMoreBookings,
		hasMoreBookings,
		isAuthed,
		authLoading,
	} = useApp();
	const insets = useSafeAreaInsets();
	const [tab, setTab] = useState<"Upcoming" | "Past">("Upcoming");
	const qc = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);

	const upcoming = bookings.filter(
		(b) => b.status === "Pending" || b.status === "Confirmed",
	);
	const past = bookings.filter(
		(b) => b.status === "Cancelled" || b.status === "Completed",
	);
	const list = tab === "Upcoming" ? upcoming : past;

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await qc.invalidateQueries({ queryKey: ["bookings"] });
		setRefreshing(false);
	}, [qc]);

	if (authLoading) {
		return (
			<ScreenContainer>
				<View className="flex-1 items-center justify-center bg-paper">
					<ActivityIndicator size="large" color={Colors.primary600} />
				</View>
			</ScreenContainer>
		);
	}

	if (!isAuthed) {
		return (
			<ScreenContainer>
				<View className="flex-1 bg-paper">
					<View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
						<Text
							style={{
								fontSize: 32,
								fontWeight: "400",
								letterSpacing: -0.5,
								color: Colors.ink900,
							}}
						>
							{t("bookings.title")}
						</Text>
					</View>
					<SignInPrompt
						icon="Calendar"
						title="Sign in to see bookings"
						body="Your upcoming and past appointments appear here once you are signed in with Google."
					/>
				</View>
			</ScreenContainer>
		);
	}

	return (
		<ScreenContainer>
			<View className="flex-1 bg-paper">
				<View
					style={{
						paddingTop: insets.top + 12,
						paddingHorizontal: 16,
						paddingBottom: 10,
					}}
				>
					<Text
						style={{
							fontSize: 32,
							fontWeight: "400",
							letterSpacing: -0.5,
							color: Colors.ink900,
						}}
					>
						{t("bookings.title")}
					</Text>
				</View>

				<View
					style={{
						flexDirection: "row",
						gap: 6,
						paddingHorizontal: 16,
						paddingBottom: 16,
					}}
				>
					{(["Upcoming", "Past"] as const).map((tabKey) => {
						const on = tabKey === tab;
						const label =
							tabKey === "Upcoming"
								? t("bookings.upcoming")
								: t("bookings.past");
						return (
							<TouchableOpacity
								key={tabKey}
								onPress={() => {
									Haptics.selectionAsync();
									setTab(tabKey);
								}}
								style={{
									flex: 1,
									paddingVertical: 10,
									borderRadius: Radius.pill,
									backgroundColor: on ? Colors.primary900 : Colors.primary50,
									alignItems: "center",
								}}
								accessibilityRole="tab"
								accessibilityState={{ selected: on }}
								accessibilityLabel={label}
							>
								<Text
									style={{
										fontSize: 14.5,
										fontWeight: "600",
										color: on ? "#fff" : Colors.ink600,
									}}
								>
									{label}
									{tabKey === "Upcoming" && upcoming.length
										? ` · ${upcoming.length}`
										: ""}
								</Text>
							</TouchableOpacity>
						);
					})}
				</View>

				{list.length === 0 ? (
					<EmptyState
						icon={tab === "Upcoming" ? "Calendar" : "Clock"}
						title={
							tab === "Upcoming"
								? t("bookings.empty.upcoming")
								: t("bookings.empty.past")
						}
						body={
							tab === "Upcoming"
								? "When you book a service, it'll appear here so you can keep track of it."
								: "Past and cancelled bookings will show up here."
						}
						cta={tab === "Upcoming" ? t("common.findService") : undefined}
						onCta={
							tab === "Upcoming" ? () => router.navigate("/(tabs)") : undefined
						}
					/>
				) : (
					<FlatList
						data={list}
						keyExtractor={(b) => b.id}
						renderItem={({ item }) => (
							<BookingRow b={item} onCancel={cancelBooking} />
						)}
						contentContainerStyle={{
							gap: 12,
							paddingHorizontal: 16,
							paddingBottom: 24,
						}}
						showsVerticalScrollIndicator={false}
						onEndReached={() => {
							if (hasMoreBookings) fetchMoreBookings();
						}}
						onEndReachedThreshold={0.3}
						ListFooterComponent={
							hasMoreBookings ? (
								<View style={{ paddingVertical: 16, alignItems: "center" }}>
									<Text style={{ fontSize: 13.5, color: Colors.ink400 }}>
										Loading more…
									</Text>
								</View>
							) : null
						}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								tintColor={Colors.primary600}
								colors={[Colors.primary600]}
							/>
						}
					/>
				)}
			</View>
		</ScreenContainer>
	);
}
